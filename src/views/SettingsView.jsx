import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { getLiveDays, hashPinSecure, verifyPinSecure, hasPinV2, hasLegacyPinOnly, savePinHash, getPinHash, clearPin } from '../utils';
import { DollarSign, Lock, Info, Save, CheckCircle2, Shield, Database, Eye, EyeOff } from 'lucide-react';
import './SettingsView.css';

const DEFAULT_PRICES = { basic: 5, pro: 15, premium: 30 };
const PRICES_KEY = 'abasto_plan_prices';

export default function SettingsView() {
  const [prices, setPrices] = useState(() => {
    try {
      const stored = localStorage.getItem(PRICES_KEY);
      return stored ? { ...DEFAULT_PRICES, ...JSON.parse(stored) } : { ...DEFAULT_PRICES };
    } catch {
      return { ...DEFAULT_PRICES };
    }
  });
  const [pricesSaved, setPricesSaved] = useState(false);

  const [pinSection, setPinSection] = useState({
    currentPin: '',
    newPin: '',
    confirmPin: '',
    step: 'idle',
    error: '',
    showCurrent: false,
    showNew: false,
    showConfirm: false,
  });

  const [dbStatus, setDbStatus] = useState({
    connected: false,
    counts: { licenses: 0, devices: 0, logs: 0 },
  });

  const [licenses, setLicenses] = useState([]);

  useEffect(() => {
    const checkDb = async () => {
      try {
        const [licRes, devRes, logRes, allLic] = await Promise.all([
          supabase.from('cloud_licenses').select('*', { count: 'exact', head: true }),
          supabase.from('account_devices').select('*', { count: 'exact', head: true }),
          supabase.from('license_audit_logs').select('*', { count: 'exact', head: true }),
          supabase.from('cloud_licenses').select('plan, license_tier, license_type, active'),
        ]);

        const connected = !licRes.error && !devRes.error;
        setDbStatus({
          connected,
          counts: {
            licenses: licRes.count || 0,
            devices: devRes.count || 0,
            logs: logRes.count || 0,
          },
        });
        if (allLic.data) setLicenses(allLic.data);
      } catch {
        setDbStatus({ connected: false, counts: { licenses: 0, devices: 0, logs: 0 } });
      }
    };
    checkDb();
  }, []);

  const savePrices = () => {
    localStorage.setItem(PRICES_KEY, JSON.stringify(prices));
    setPricesSaved(true);
    setTimeout(() => setPricesSaved(false), 2000);
  };

  const updatePin = (field, value) => {
    setPinSection(prev => ({ ...prev, [field]: value, error: '' }));
  };

  const toggleShow = (field) => {
    setPinSection(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const verifyCurrentPin = async () => {
    if (!pinSection.currentPin) {
      setPinSection(prev => ({ ...prev, error: 'Ingresa tu PIN actual.' }));
      return;
    }
    const stored = getPinHash();
    const matches = stored ? await verifyPinSecure(pinSection.currentPin, stored) : true;
    if (!stored || matches) {
      setPinSection(prev => ({ ...prev, step: 'verifying', error: '' }));
    } else {
      setPinSection(prev => ({ ...prev, error: 'PIN incorrecto. Inténtalo de nuevo.' }));
    }
  };

  const saveNewPin = async () => {
    if (pinSection.newPin.length < 6) {
      setPinSection(prev => ({ ...prev, error: 'El PIN debe tener al menos 6 dígitos.' }));
      return;
    }
    if (pinSection.newPin !== pinSection.confirmPin) {
      setPinSection(prev => ({ ...prev, error: 'Los PINs no coinciden.' }));
      return;
    }
    const hashed = await hashPinSecure(pinSection.newPin);
    savePinHash(hashed);
    setPinSection(prev => ({ ...prev, step: 'success', error: '' }));
  };

  const resetPinSection = () => {
    setPinSection({
      currentPin: '',
      newPin: '',
      confirmPin: '',
      step: 'idle',
      error: '',
      showCurrent: false,
      showNew: false,
      showConfirm: false,
    });
  };

  const computeMrr = () => {
    const active = licenses.filter(l => l.active !== false && l.license_type !== 'permanent');
    let total = 0;
    for (const l of active) {
      const tier = l.plan || l.license_tier || 'basic';
      total += prices[tier] || 0;
    }
    return total;
  };

  const mrr = computeMrr();

  return (
    <div className="settings-container">
      <h1>Configuración</h1>

      {/* Panel 1: Precios por Plan */}
      <div className="glass-panel settings-panel">
        <div className="section-title">
          <DollarSign size={16} />
          Precios por Plan
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-0.5rem' }}>
          Define el precio mensual por nivel para calcular el MRR estimado.
        </p>
        <div className="price-inputs">
          <div className="form-group">
            <label>Precio Basic ($/mes)</label>
            <input
              className="glass-input"
              type="number"
              min={0}
              value={prices.basic}
              onChange={e => setPrices(prev => ({ ...prev, basic: Number(e.target.value) }))}
            />
          </div>
          <div className="form-group">
            <label>Precio Pro ($/mes)</label>
            <input
              className="glass-input"
              type="number"
              min={0}
              value={prices.pro}
              onChange={e => setPrices(prev => ({ ...prev, pro: Number(e.target.value) }))}
            />
          </div>
          <div className="form-group">
            <label>Precio Premium ($/mes)</label>
            <input
              className="glass-input"
              type="number"
              min={0}
              value={prices.premium}
              onChange={e => setPrices(prev => ({ ...prev, premium: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div className="mrr-est">
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
              MRR Estimado
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Basado en {licenses.filter(l => l.active !== false && l.license_type !== 'permanent').length} licencias activas
            </div>
          </div>
          <div className="mrr-est-val">${mrr.toLocaleString('es-MX')}/mo</div>
        </div>

        <button
          className="glass-button primary"
          onClick={savePrices}
          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          {pricesSaved ? (
            <>
              <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
              Guardado
            </>
          ) : (
            <>
              <Save size={15} />
              Guardar Precios
            </>
          )}
        </button>
      </div>

      {/* Panel 2: Seguridad - Cambiar PIN */}
      <div className="glass-panel settings-panel">
        <div className="section-title">
          <Shield size={16} />
          Seguridad — Cambiar PIN
        </div>

        {pinSection.step === 'success' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', padding: '0.75rem', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
            <CheckCircle2 size={18} />
            PIN actualizado correctamente
            <button
              className="glass-button"
              style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
              onClick={resetPinSection}
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="pin-fields">
            {pinSection.step === 'idle' && (
              <>
                <div className="form-group">
                  <label>PIN actual</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="glass-input"
                      type={pinSection.showCurrent ? 'text' : 'password'}
                      placeholder="••••••"
                      value={pinSection.currentPin}
                      onChange={e => updatePin('currentPin', e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && verifyCurrentPin()}
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}
                      onClick={() => toggleShow('showCurrent')}
                    >
                      {pinSection.showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                {pinSection.error && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{pinSection.error}</div>
                )}
                <button className="glass-button primary" onClick={verifyCurrentPin} style={{ alignSelf: 'flex-start' }}>
                  <Lock size={14} />
                  Verificar
                </button>
              </>
            )}

            {pinSection.step === 'verifying' && (
              <>
                <div className="form-group">
                  <label>Nuevo PIN (6 dígitos)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="glass-input"
                      type={pinSection.showNew ? 'text' : 'password'}
                      placeholder="••••••"
                      maxLength={8}
                      value={pinSection.newPin}
                      onChange={e => updatePin('newPin', e.target.value.replace(/\D/g, ''))}
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}
                      onClick={() => toggleShow('showNew')}
                    >
                      {pinSection.showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Confirmar PIN</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="glass-input"
                      type={pinSection.showConfirm ? 'text' : 'password'}
                      placeholder="••••••"
                      maxLength={8}
                      value={pinSection.confirmPin}
                      onChange={e => updatePin('confirmPin', e.target.value.replace(/\D/g, ''))}
                      onKeyDown={e => e.key === 'Enter' && saveNewPin()}
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}
                      onClick={() => toggleShow('showConfirm')}
                    >
                      {pinSection.showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                {pinSection.error && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{pinSection.error}</div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="glass-button primary" onClick={saveNewPin} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Save size={14} />
                    Actualizar PIN
                  </button>
                  <button className="glass-button" onClick={resetPinSection}>
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Panel 3: Sistema e Información */}
      <div className="glass-panel settings-panel">
        <div className="section-title">
          <Info size={16} />
          Sistema e Información
        </div>

        <div>
          <div className="info-row">
            <span style={{ color: 'var(--text-muted)' }}>Versión</span>
            <span className="badge badge-primary">2.0.0</span>
          </div>
          <div className="info-row">
            <span style={{ color: 'var(--text-muted)' }}>Estado Supabase</span>
            <span className={`badge ${dbStatus.connected ? 'badge-success' : 'badge-danger'}`}>
              <Database size={11} style={{ marginRight: '4px' }} />
              {dbStatus.connected ? 'Conectado' : 'Sin conexión'}
            </span>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>
          Tablas
        </div>
        <div className="db-cards">
          <div className="db-card">
            <div className="db-card-count">{dbStatus.counts.licenses.toLocaleString()}</div>
            <div className="db-card-label">Licencias</div>
          </div>
          <div className="db-card">
            <div className="db-card-count">{dbStatus.counts.devices.toLocaleString()}</div>
            <div className="db-card-label">Dispositivos</div>
          </div>
          <div className="db-card">
            <div className="db-card-count">{dbStatus.counts.logs.toLocaleString()}</div>
            <div className="db-card-label">Registros</div>
          </div>
        </div>
      </div>
    </div>
  );
}
