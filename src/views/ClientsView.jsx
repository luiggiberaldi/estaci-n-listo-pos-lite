import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { MoreVertical, CheckCircle2, XCircle, Users, Search, MessageCircle, Monitor, X, Save, Download } from 'lucide-react';
import ClientModal from '../components/ClientModal';
import './ClientsView.css';

// Calcula días restantes en tiempo real desde valid_until
function getLiveDays(client) {
  if (client.license_type === 'permanent') return Infinity;
  if (!client.valid_until) return client.days_remaining || 0;
  const diff = Math.ceil((new Date(client.valid_until) - new Date()) / 86400000);
  return diff > 0 ? diff : 0;
}

const EMPTY_NEW_CLIENT = {
  email: '',
  business_name: '',
  phone: '',
  plan_tier: 'basic',
  max_devices: 1,
  license_type: 'trial',
  days: 7,
};

export default function ClientsView() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [massActionLoading, setMassActionLoading] = useState(false);

  // Filter & sort state
  const [filters, setFilters] = useState({ status: 'all', plan: 'all', type: 'all', maxDays: '' });
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', dir: 'desc' });

  // Estado para modal de nuevo cliente
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientData, setNewClientData] = useState(EMPTY_NEW_CLIENT);
  const [newClientLoading, setNewClientLoading] = useState(false);
  const [newClientError, setNewClientError] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cloud_licenses')
        .select('id, email, business_name, plan_tier, active, days_remaining, max_devices, phone, license_type, created_at, updated_at, valid_until')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
      setSelectedIds([]);
    } catch (err) {
      console.error("Error fetching clients", err);
    } finally {
      setLoading(false);
    }
  }

  // === FILTER + SORT LOGIC ===
  const filteredClients = clients.filter(c => {
    const live = getLiveDays(c);
    if (search && !c.email.toLowerCase().includes(search.toLowerCase()) &&
        !(c.business_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.status === 'active' && !c.active) return false;
    if (filters.status === 'inactive' && c.active) return false;
    if (filters.status === 'expired' && (live > 0 || c.license_type === 'permanent')) return false;
    if (filters.plan !== 'all' && c.plan_tier !== filters.plan) return false;
    if (filters.type !== 'all' && c.license_type !== filters.type) return false;
    if (filters.maxDays && live > parseInt(filters.maxDays) && c.license_type !== 'permanent') return false;
    return true;
  }).sort((a, b) => {
    if (sortConfig.key === 'days') {
      const da = getLiveDays(a), db = getLiveDays(b);
      return sortConfig.dir === 'asc' ? da - db : db - da;
    }
    if (sortConfig.key === 'valid_until') {
      return sortConfig.dir === 'asc'
        ? new Date(a.valid_until) - new Date(b.valid_until)
        : new Date(b.valid_until) - new Date(a.valid_until);
    }
    return sortConfig.dir === 'asc'
      ? new Date(a.created_at) - new Date(b.created_at)
      : new Date(b.created_at) - new Date(a.created_at);
  });

  const toggleSort = (key) => {
    setSortConfig(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon">{sortConfig.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({ status: 'all', plan: 'all', type: 'all', maxDays: '' });
    setSearch('');
  };

  // === SELECTION LOGIC ===
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredClients.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // === MASS ACTIONS ===
  const handleMassAddDays = async (days) => {
    const confirmList = clients.filter(c => selectedIds.includes(c.id)).map(c => c.business_name || c.email).join(', ');
    if (!confirm(`¿Agregar ${days} días a:\n${confirmList}?`)) return;

    setMassActionLoading(true);
    try {
      const targets = clients.filter(c => selectedIds.includes(c.id));
      for (const client of targets) {
        // FIX: Calcular nueva valid_until desde MAX(ahora, valid_until actual) + días
        const baseDate = new Date(Math.max(Date.now(), new Date(client.valid_until || 0)));
        baseDate.setDate(baseDate.getDate() + days);

        await supabase
          .from('cloud_licenses')
          .update({
            days_remaining: getLiveDays(client) + days,
            license_type: 'days',
            valid_until: baseDate.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', client.id);
      }
      await fetchClients();
    } catch (err) {
      alert("Error en acción masiva: " + err.message);
    } finally {
      setMassActionLoading(false);
    }
  };

  const handleMassSuspend = async (activeState) => {
    const status = activeState ? 'Activar' : 'Suspender';
    if (!confirm(`¿${status} el acceso de los ${selectedIds.length} clientes seleccionados?`)) return;

    setMassActionLoading(true);
    try {
      await supabase
        .from('cloud_licenses')
        .update({
          active: activeState,
          updated_at: new Date().toISOString()
        })
        .in('id', selectedIds);

      await fetchClients();
    } catch (err) {
      alert("Error en acción masiva: " + err.message);
    } finally {
      setMassActionLoading(false);
    }
  };

  // === EXPORT CSV ===
  const exportCSV = () => {
    const headers = ['Email', 'Negocio', 'Plan', 'Estado', 'Días Restantes', 'Vence el', 'Dispositivos Máx', 'Tipo'];
    const rows = filteredClients.map(c => [
      c.email,
      c.business_name || '',
      c.plan_tier,
      c.active ? 'Activa' : 'Inactiva',
      getLiveDays(c) === Infinity ? 'Permanente' : getLiveDays(c),
      c.valid_until ? new Date(c.valid_until).toLocaleDateString('es-ES') : '',
      c.max_devices,
      c.license_type
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_abasto_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // === NUEVO CLIENTE ===
  const handleNewClientChange = (e) => {
    const { name, value } = e.target;
    setNewClientData(prev => ({ ...prev, [name]: value }));
    setNewClientError('');
  };

  const handleCreateClient = async () => {
    if (!newClientData.email.trim()) {
      setNewClientError('El email es obligatorio.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClientData.email.trim())) {
      setNewClientError('El email no tiene un formato válido.');
      return;
    }

    setNewClientLoading(true);
    try {
      const days = parseInt(newClientData.days) || 7;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + days);

      const { error } = await supabase.from('cloud_licenses').insert({
        email: newClientData.email.trim().toLowerCase(),
        business_name: newClientData.business_name.trim(),
        phone: newClientData.phone.trim(),
        plan_tier: newClientData.plan_tier,
        max_devices: parseInt(newClientData.max_devices) || 1,
        license_type: newClientData.license_type,
        days_remaining: days,
        valid_until: validUntil.toISOString(),
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setShowNewClientModal(false);
      setNewClientData(EMPTY_NEW_CLIENT);
      await fetchClients();
    } catch (err) {
      setNewClientError(err.message || 'Error al crear el cliente.');
    } finally {
      setNewClientLoading(false);
    }
  };

  // === RENDER HELPERS ===
  const getWhatsAppLink = (client) => {
    if (!client.phone) return null;
    const cleanPhone = client.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 7) return null;
    const liveDays = getLiveDays(client);
    let msg = `Hola *${client.business_name || 'Cliente'}*, `;
    if (client.license_type !== 'permanent' && liveDays <= 3 && liveDays > 0) {
      msg += `te informamos que tu Licencia de *Abasto* expira en ${liveDays} días. ¿Deseas renovarla hoy?`;
    } else if (liveDays <= 0 && client.license_type !== 'permanent') {
      msg += `tu Licencia de *Abasto* se encuentra suspendida. Contáctanos para restaurar el servicio.`;
    } else {
      msg += `somos del equipo de Abasto. ¡Gracias por usar nuestra plataforma!`;
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  const getInitial = (client) => {
    return client.business_name ? client.business_name.charAt(0).toUpperCase() : client.email.charAt(0).toUpperCase();
  };

  const renderDaysVisual = (client) => {
    if (client.license_type === 'permanent') {
      return (
        <div className="days-visual-container">
          <span className="days-text permanent">Vitalicio ∞</span>
          <div className="mini-progress-bg"><div className="mini-progress-fill healthy" style={{ width: '100%' }}></div></div>
        </div>
      );
    }

    const liveDays = getLiveDays(client);
    const maxDaysScale = 30;
    const percent = Math.min((Math.max(liveDays, 0) / maxDaysScale) * 100, 100);

    let statusClass = 'healthy';
    if (liveDays <= 3) statusClass = 'critical';
    else if (liveDays <= 10) statusClass = 'warning';

    return (
      <div className="days-visual-container">
        <span className={`days-text ${statusClass}`}>{liveDays} días</span>
        <div className="mini-progress-bg">
          <div className={`mini-progress-fill ${statusClass}`} style={{ width: `${percent}%` }}></div>
        </div>
      </div>
    );
  };

  const formatValidUntil = (client) => {
    if (client.license_type === 'permanent') return '—';
    if (!client.valid_until) return '—';
    return new Date(client.valid_until).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getRowClass = (client) => {
    const live = getLiveDays(client);
    if (live === 0 && client.license_type !== 'permanent') return 'row-expired';
    if (live > 0 && live <= 7 && client.license_type !== 'permanent') return 'row-warning';
    return '';
  };

  return (
    <div className="clients-container fade-in-up">
      <header className="clients-header">
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#fff' }}>Gestión de Clientes</h1>
          <p style={{ color: 'var(--text-muted)' }}>Administra licencias, dispositivos y niveles de suscripción.</p>
        </div>

        <div className="actions-bar">
          {selectedIds.length > 0 ? (
            <div className="mass-action-bar">
              <span className="mass-action-count">{selectedIds.length} Seleccionados</span>
              <button className="mass-btn" onClick={() => handleMassAddDays(30)} disabled={massActionLoading}>
                + 30 Días
              </button>
              <button className="mass-btn" onClick={() => handleMassAddDays(7)} disabled={massActionLoading}>
                + 7 Días
              </button>
              <button className="mass-btn danger" onClick={() => handleMassSuspend(false)} disabled={massActionLoading}>
                Suspender
              </button>
              <button className="mass-btn" style={{ borderColor: 'var(--success)', color: 'var(--success)' }} onClick={() => handleMassSuspend(true)} disabled={massActionLoading}>
                Activar
              </button>
            </div>
          ) : (
            <div className="search-box">
              <Search size={18} color="var(--text-muted)" />
              <input
                type="text"
                className="glass-input"
                placeholder="Buscar cliente, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', color: '#fff' }}
              />
            </div>
          )}

          <button className="glass-button" onClick={exportCSV} title="Exportar CSV">
            <Download size={16} /> Exportar CSV
          </button>

          <button className="glass-button primary" onClick={() => { setNewClientData(EMPTY_NEW_CLIENT); setNewClientError(''); setShowNewClientModal(true); }}>
            + Nuevo Cliente
          </button>
        </div>
      </header>

      {/* Filter bar */}
      <div className="filter-bar">
        <select
          className="glass-input"
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="inactive">Inactivas</option>
          <option value="expired">Expiradas</option>
        </select>

        <select
          className="glass-input"
          value={filters.plan}
          onChange={(e) => handleFilterChange('plan', e.target.value)}
        >
          <option value="all">Todos los planes</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
        </select>

        <select
          className="glass-input"
          value={filters.type}
          onChange={(e) => handleFilterChange('type', e.target.value)}
        >
          <option value="all">Todos los tipos</option>
          <option value="trial">Trial</option>
          <option value="days">Por días</option>
          <option value="permanent">Permanente</option>
        </select>

        <input
          type="number"
          className="glass-input"
          placeholder="Días ≤"
          value={filters.maxDays}
          onChange={(e) => handleFilterChange('maxDays', e.target.value)}
          min="0"
          style={{ width: '100px' }}
        />

        <button className="filter-clear" onClick={clearFilters}>
          Limpiar
        </button>

        <span className="filter-count">
          {filteredClients.length} de {clients.length} clientes
        </span>
      </div>

      <div className="glass-panel table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando clientes...</div>
        ) : (
          <table className="clients-table">
            <thead>
              <tr>
                <th width="50">
                  <input
                    type="checkbox"
                    className="custom-checkbox"
                    checked={filteredClients.length > 0 && selectedIds.length === filteredClients.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Cliente y Correo</th>
                <th>Suscripción</th>
                <th>Estado</th>
                <th className="sortable-th" onClick={() => toggleSort('days')}>
                  Días Restantes {getSortIcon('days')}
                </th>
                <th className="sortable-th" onClick={() => toggleSort('valid_until')}>
                  Vence el {getSortIcon('valid_until')}
                </th>
                <th>Expansión WiFi</th>
                <th>Contactos y Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => {
                const isSelected = selectedIds.includes(client.id);
                const rowClass = [isSelected ? 'selected' : '', getRowClass(client)].filter(Boolean).join(' ');
                return (
                  <tr key={client.id} className={rowClass}>
                    <td>
                      <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectOne(client.id)}
                      />
                    </td>

                    <td>
                      <div className="client-profile-cell">
                        <div className="client-avatar-small">{getInitial(client)}</div>
                        <div className="client-info">
                          <strong>{client.business_name || 'Empresa Sin Nombre'}</strong>
                          <span>{client.email}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`tier-badge ${client.plan_tier || 'basic'}`}>
                        {client.plan_tier || 'Basic'}
                      </span>
                    </td>

                    <td>
                      {client.active ? (
                        <span className="status-badge active"><CheckCircle2 size={14} /> Activa</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                          <span className="status-badge inactive"><XCircle size={14} /> Inactiva</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Desde {new Date(client.updated_at || client.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </td>

                    <td>
                      {renderDaysVisual(client)}
                    </td>

                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatValidUntil(client)}
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Monitor size={16} color="var(--primary)" />
                        <span style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>Límite: {client.max_devices || 2} PCs</span>
                      </div>
                    </td>

                    <td style={{ display: 'flex', gap: '12px', alignItems: 'center', height: '100%' }}>
                      {client.phone ? (
                        <a
                          href={getWhatsAppLink(client)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="icon-button"
                          style={{ color: '#25D366' }}
                          title="Notificar por WhatsApp"
                        >
                          <MessageCircle size={18} />
                        </a>
                      ) : (
                        <button className="icon-button opacity-30" title="Sin teléfono configurado" disabled>
                          <MessageCircle size={18} />
                        </button>
                      )}

                      <button className="icon-button" onClick={() => setSelectedClient(client)} title="Abrir Ficha Administrativa">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No se encontraron licencias registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selectedClient && (
        <ClientModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdate={fetchClients}
        />
      )}

      {/* Modal Nuevo Cliente */}
      {showNewClientModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel fade-in-up" style={{ maxWidth: '500px' }}>
            <header className="modal-header">
              <div className="header-info-group">
                <div className="client-avatar">+</div>
                <div className="header-text">
                  <h2>Nuevo Cliente</h2>
                  <p>Registrar nueva licencia</p>
                </div>
              </div>
              <div className="header-actions">
                <button className="icon-button" onClick={() => setShowNewClientModal(false)}><X size={24} /></button>
              </div>
            </header>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Email <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="email" name="email" className="glass-input" placeholder="cliente@ejemplo.com" value={newClientData.email} onChange={handleNewClientChange} />
              </div>
              <div className="form-group">
                <label>Nombre del Negocio</label>
                <input type="text" name="business_name" className="glass-input" placeholder="Mi Bodega" value={newClientData.business_name} onChange={handleNewClientChange} />
              </div>
              <div className="form-group">
                <label>Teléfono (WhatsApp)</label>
                <input type="text" name="phone" className="glass-input" placeholder="+584141234567" value={newClientData.phone} onChange={handleNewClientChange} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Plan</label>
                  <select name="plan_tier" className="glass-input" value={newClientData.plan_tier} onChange={handleNewClientChange}>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Tipo de Licencia</label>
                  <select name="license_type" className="glass-input" value={newClientData.license_type} onChange={handleNewClientChange}>
                    <option value="trial">Trial</option>
                    <option value="days">Por Días</option>
                    <option value="permanent">Permanente</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Días iniciales</label>
                  <input type="number" name="days" min="1" max="3650" className="glass-input" value={newClientData.days} onChange={handleNewClientChange} />
                </div>
                <div className="form-group">
                  <label>Dispositivos máx.</label>
                  <input type="number" name="max_devices" min="1" max="20" className="glass-input" value={newClientData.max_devices} onChange={handleNewClientChange} />
                </div>
              </div>

              {newClientError && (
                <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.875rem' }}>
                  {newClientError}
                </div>
              )}
            </div>

            <footer className="modal-footer">
              <button className="glass-button" onClick={() => setShowNewClientModal(false)} disabled={newClientLoading}>Cancelar</button>
              <button className="glass-button primary" onClick={handleCreateClient} disabled={newClientLoading}>
                {newClientLoading ? 'Creando...' : <><Save size={18} /> Crear Cliente</>}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
