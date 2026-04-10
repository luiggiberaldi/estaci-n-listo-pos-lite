import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { X, Shield, Clock, MonitorSmartphone, PlusCircle, Save, MessageCircle, Info, Smartphone, MonitorOff, AlertTriangle } from 'lucide-react';
import './ClientModal.css';

export default function ClientModal({ client, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    business_name: client.business_name || '',
    phone: client.phone || '',
    plan_tier: client.plan_tier || 'basic',
    max_devices: client.max_devices || 2,
    active: client.active ?? true,
    license_type: client.license_type || 'trial',
    valid_until: client.valid_until || (() => {
      const start = client.updated_at ? new Date(client.updated_at) : new Date();
      start.setDate(start.getDate() + (client.days_remaining || 7));
      return start.toISOString();
    })()
  });

  const [activeTab, setActiveTab] = useState('license');

  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [mrrAmount, setMrrAmount] = useState('');
  const [showMrrInput, setShowMrrInput] = useState(false);

  const planPrices = JSON.parse(localStorage.getItem('abasto_plan_prices') || '{"basic":5,"pro":15,"premium":30}');

  const getComputedDays = () => {
    if (formData.license_type === 'permanent') return '∞';
    if (!formData.valid_until) return 0;
    const diffDays = Math.ceil((new Date(formData.valid_until) - new Date()) / 86400000);
    return diffDays > 0 ? diffDays : 0;
  };

  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);

  useEffect(() => {
    async function fetchDevices() {
      try {
        const { data, error } = await supabase
          .from('account_devices')
          .select('id, device_id, device_alias, last_seen')
          .eq('email', client.email)
          .order('last_seen', { ascending: false });

        if (error) throw error;
        setDevices(data || []);
      } catch (err) {
        console.error("Error fetching devices", err);
      } finally {
        setDevicesLoading(false);
      }
    }
    fetchDevices();
  }, [client.email]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    setHistoryLoading(true);
    supabase.from('license_audit_logs')
      .select('*')
      .eq('email', client.email)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setHistoryLogs(data || []);
        setHistoryLoading(false);
      });
  }, [activeTab, client.email]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const addDays = (days) => {
    setFormData(prev => {
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + days);
      return {
        ...prev,
        license_type: 'days',
        valid_until: baseDate.toISOString()
      };
    });
    setShowMrrInput(true);
    setMrrAmount(String(planPrices[formData.plan_tier] || 0));
  };

  const makePermanent = () => {
    setFormData(prev => {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 10);
      return {
        ...prev,
        license_type: 'permanent',
        valid_until: d.toISOString()
      };
    });
    setShowMrrInput(true);
    setMrrAmount(String(planPrices[formData.plan_tier] || 0));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const computedDays = getComputedDays();

      // FIX 6: Calcular días actuales desde valid_until (no desde days_remaining stale en DB)
      const currentDays = client.license_type === 'permanent'
        ? 3650
        : Math.max(0, Math.ceil((new Date(client.valid_until) - new Date()) / 86400000));

      if (computedDays !== '∞' && computedDays > currentDays) {
        await supabase.from('license_audit_logs').insert({
          email: client.email,
          action: 'DAYS_ADDED_MANUAL',
          days_added: computedDays - currentDays,
          mrr_value: parseFloat(mrrAmount) || 0
        });
      }

      const { error } = await supabase
        .from('cloud_licenses')
        .update({
          business_name: formData.business_name,
          phone: formData.phone,
          valid_until: formData.valid_until,
          days_remaining: computedDays === '∞' ? 3650 : computedDays,
          plan_tier: formData.plan_tier,
          max_devices: parseInt(formData.max_devices),
          active: formData.active,
          license_type: formData.license_type,
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id);

      if (error) throw error;
      setShowMrrInput(false);
      onUpdate();
      onClose();
    } catch (err) {
      console.error("Error saving client", err);
      alert("Error al guardar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const unlinkDevice = async (deviceId) => {
    if (!confirm('¿Desvincular este dispositivo? El usuario tendrá que volver a iniciar sesión.')) return;
    try {
      const { error } = await supabase.from('account_devices').delete().match({ email: client.email, device_id: deviceId });
      if (error) throw error;
      setDevices(prev => prev.filter(d => d.device_id !== deviceId));
    } catch (err) {
      alert("Error desvinculando dispositivo: " + err.message);
    }
  };

  const getWhatsAppLink = () => {
    if (!formData.phone) return null;
    const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
    let msg = `Hola *${formData.business_name || 'Cliente'}*, nos comunicamos desde la Estación Maestra Abasto.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  const getInitial = () => {
    return formData.business_name ? formData.business_name.charAt(0).toUpperCase() : client.email.charAt(0).toUpperCase();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel fade-in-up">

        {/* Cabecera Enriquecida */}
        <header className="modal-header">
          <div className="header-info-group">
            <div className="client-avatar">{getInitial()}</div>
            <div className="header-text">
              <h2>{formData.business_name || client.email.split('@')[0]}</h2>
              <p>{client.email}</p>
            </div>
          </div>

          <div className="header-actions">
            <div className="status-badge" title="Activar/Suspender Acceso">
              <label className="toggle-switch">
                <input type="checkbox" name="active" checked={formData.active} onChange={handleChange} />
                <span className="slider"></span>
              </label>
              <div style={{ fontSize: '0.75rem', marginTop: '4px', color: formData.active ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                {formData.active ? 'Activa' : 'Suspendida'}
              </div>
            </div>

            {formData.phone && (
              <a
                href={getWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="icon-button"
                style={{ color: '#25D366', background: 'rgba(37, 211, 102, 0.1)' }}
                title="Contactar al Cliente"
              >
                <MessageCircle size={22} />
              </a>
            )}

            <button className="icon-button" onClick={onClose} title="Cerrar"><X size={24} /></button>
          </div>
        </header>

        {/* Tabs */}
        <div className="modal-tabs">
          <button className={`modal-tab ${activeTab === 'license' ? 'active' : ''}`} onClick={() => setActiveTab('license')}>
            Licencia
          </button>
          <button className={`modal-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            Historial {historyLogs.length > 0 && <span className="tab-count">{historyLogs.length}</span>}
          </button>
        </div>

        {/* License Tab */}
        {activeTab === 'license' && (
          <div className="modal-body-grid fade-in">

            {/* COLUMNA IZQUIERDA: Info General y Hardware */}
            <div className="col-left">
              <div className="info-card">
                <div className="section-title"><Info size={18} /> Perfil y Contacto</div>
                <div className="form-group row">
                  <div style={{ flex: 1 }}>
                    <label>Nombre del Negocio</label>
                    <input type="text" name="business_name" className="glass-input" value={formData.business_name} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Teléfono (WhatsApp)</label>
                  <input type="text" name="phone" className="glass-input" placeholder="Ej: +584141234567" value={formData.phone} onChange={handleChange} />
                </div>
              </div>

              <div className="info-card" style={{ flex: 1 }}>
                <div className="section-title"><MonitorSmartphone size={18} /> Estaciones Físicas (Cupos: {formData.max_devices})</div>
                <div className="form-group">
                  <label>Límite simultáneo asignado</label>
                  <input type="number" name="max_devices" min="1" max="20" className="glass-input" style={{ width: '80px', display: 'inline-block' }} value={formData.max_devices} onChange={handleChange} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '10px' }}>PC's o Teléfonos.</span>

                  {!devicesLoading && devices.length > parseInt(formData.max_devices || 1) && (
                    <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>
                        <strong>¡Límite excedido!</strong> Tiene <strong>{devices.length}</strong> dispositivo(s) conectado(s) pero el límite es de <strong>{formData.max_devices}</strong>. El cliente sufrirá bloqueos hasta que expulses el exceso desde esta pantalla.
                      </span>
                    </div>
                  )}
                </div>

                {/* Lista de Hardware Vinculado */}
                <div style={{ marginTop: '1.5rem' }}>
                  {devicesLoading ? (
                    <p style={{ color: 'var(--text-muted)' }}>Buscando conexiones...</p>
                  ) : devices.length === 0 ? (
                    <div className="empty-devices">
                      <div className="empty-devices-icon"><MonitorOff size={24} /></div>
                      <div>Ningún dispositivo está conectado a esta licencia.</div>
                    </div>
                  ) : (
                    <div className="devices-list">
                      {devices.map(dev => (
                        <div key={dev.id} className="device-card">
                          <div className="device-info">
                            <div className="device-icon-wrapper"><Smartphone size={20} /></div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{dev.device_alias || 'Bodega/Caja'}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(dev.last_seen).toLocaleString()}</div>
                            </div>
                          </div>
                          <button className="glass-button danger-zone" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => unlinkDevice(dev.device_id)}>
                            Expulsar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: Suscripción y Estado */}
            <div className="col-right">
              <div className="info-card">
                <div className="section-title"><Clock size={18} /> Ciclo de Vida</div>

                {/* Visual Display de Días */}
                <div className="days-counter-display">
                  <div>
                    <div className="days-number">
                      {getComputedDays()}
                    </div>
                    <div className="days-label">
                      {formData.license_type === 'permanent' ? 'Licencia de por vida' : 'Días restantes de acceso'}
                    </div>
                  </div>
                  {formData.license_type !== 'permanent' && getComputedDays() <= 3 && (
                    <div style={{ color: 'var(--danger)', fontWeight: 'bold', background: 'rgba(239, 68, 68, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
                      ¡Pronto a vencer!
                    </div>
                  )}
                </div>

                {/* Botones Rápidos */}
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>Establecer saldo (Renovación rápida)</label>
                  <div className="quick-buttons">
                    <button className="quick-btn" onClick={() => addDays(7)}>7 Días</button>
                    <button className="quick-btn" onClick={() => addDays(30)}>1 Mes</button>
                    <button className="quick-btn" onClick={makePermanent}>Permanente</button>
                  </div>
                  {showMrrInput && (
                    <div className="mrr-input-row">
                      <label>Monto cobrado (USD) — se registrará en el historial</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="glass-input"
                        value={mrrAmount}
                        onChange={e => setMrrAmount(e.target.value)}
                        placeholder="0.00"
                        style={{ width: '140px' }}
                      />
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Modificar Fecha de Expiración (Corte)</label>
                  <input
                    type="datetime-local"
                    name="valid_until"
                    className="glass-input"
                    value={formData.valid_until ? formData.valid_until.slice(0, 16) : ''}
                    onChange={(e) => setFormData(p => ({ ...p, valid_until: new Date(e.target.value).toISOString(), license_type: 'days' }))}
                    disabled={formData.license_type === 'permanent'}
                  />
                  <div style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)' }}>El sistema detendrá el acceso en esta fecha exacta.</div>
                </div>
              </div>

              <div className="info-card">
                <div className="section-title"><Shield size={18} /> Categoría del Nivel</div>
                <div className="form-group">
                  <label>Nivel de Funciones (Tier)</label>
                  <select name="plan_tier" className="glass-input" value={formData.plan_tier} onChange={handleChange}>
                    <option value="basic">Standard (Basic)</option>
                    <option value="pro">Tienda Múltiple (Pro)</option>
                    <option value="premium">Empresarial (Premium)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Comportamiento en Sistema</label>
                  <select name="license_type" className="glass-input" value={formData.license_type} onChange={handleChange}>
                    <option value="trial">Prueba (Trial Automático)</option>
                    <option value="days">Pago Recurrente (Por Días)</option>
                    <option value="permanent">Vitalicio (Permanent)</option>
                  </select>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="history-tab fade-in">
            {historyLoading ? (
              <div className="empty-state"><p>Cargando historial...</p></div>
            ) : historyLogs.length === 0 ? (
              <div className="empty-state">
                <Clock size={40} />
                <p>Sin movimientos registrados aún.</p>
              </div>
            ) : (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Acción</th>
                    <th>Días</th>
                    <th>Cobrado</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map((log, i) => (
                    <tr key={i}>
                      <td>{new Date(log.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td><span className="badge primary">{log.action}</span></td>
                      <td>{log.days_added > 0 ? `+${log.days_added}` : log.days_added}</td>
                      <td style={{ color: log.mrr_value > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {log.mrr_value > 0 ? `$${Number(log.mrr_value).toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="modal-footer">
          <button className="glass-button" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="glass-button primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Sincronizando...' : <><Save size={18} /> Guardar Cambios</>}
          </button>
        </footer>
      </div>
    </div>
  );
}
