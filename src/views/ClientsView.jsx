import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { MoreVertical, CheckCircle2, XCircle, Users, Search, MessageCircle, Monitor } from 'lucide-react';
import ClientModal from '../components/ClientModal';
import './ClientsView.css';

export default function ClientsView() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [massActionLoading, setMassActionLoading] = useState(false);
  
  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cloud_licenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
      // Reset selected when loading new data
      setSelectedIds([]);
    } catch (err) {
      console.error("Error fetching clients", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredClients = clients.filter(c => 
    c.email.toLowerCase().includes(search.toLowerCase()) || 
    (c.business_name && c.business_name.toLowerCase().includes(search.toLowerCase()))
  );

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
    if (!confirm(`¿Regalar ${days} días a:\n${confirmList}?`)) return;

    setMassActionLoading(true);
    try {
      // Add days iteratively to respect their current values
      const targets = clients.filter(c => selectedIds.includes(c.id));
      for (const client of targets) {
         await supabase
            .from('cloud_licenses')
            .update({ 
               days_remaining: client.days_remaining + days,
               license_type: 'days' 
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


  // === RENDER HELPERS ===
  const getWhatsAppLink = (client) => {
    if (!client.phone) return null;
    const cleanPhone = client.phone.replace(/[^0-9]/g, '');
    let msg = `Hola *${client.business_name || 'Cliente'}*, `;
    if (client.license_type !== 'permanent' && client.days_remaining <= 3 && client.days_remaining > 0) {
       msg += `te informamos que tu Licencia de *Abasto* expira en ${client.days_remaining} días. ¿Deseas renovarla hoy?`;
    } else if (client.days_remaining <= 0 && client.license_type !== 'permanent') {
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
     
     const maxDaysScale = 30; // Para el fill del progress bar (100% = 30 días)
     const percent = Math.min((Math.max(client.days_remaining, 0) / maxDaysScale) * 100, 100);
     
     let statusClass = 'healthy';
     if (client.days_remaining <= 3) statusClass = 'critical';
     else if (client.days_remaining <= 10) statusClass = 'warning';

     return (
        <div className="days-visual-container">
           <span className={`days-text ${statusClass}`}>{client.days_remaining} días</span>
           <div className="mini-progress-bg">
              <div className={`mini-progress-fill ${statusClass}`} style={{ width: `${percent}%` }}></div>
           </div>
        </div>
     );
  };

  return (
    <div className="clients-container fade-in-up">
      <header className="clients-header">
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#fff' }}>Gestión de Clientes</h1>
          <p style={{ color: 'var(--text-muted)' }}>Administra licencias, dispositivos y niveles de suscripción.</p>
        </div>
        
        <div className="actions-bar">
          {/* Si hay selección masiva, mostramos barra especial, sino el buscador estándar */}
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
               <button className="mass-btn" style={{borderColor:'var(--success)', color:'var(--success)'}} onClick={() => handleMassSuspend(true)} disabled={massActionLoading}>
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
          
          <button className="glass-button primary">
            + Nuevo Cliente
          </button>
        </div>
      </header>

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
                <th>Días Restantes</th>
                <th>Expansión WiFi</th>
                <th>Contactos y Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => {
                const isSelected = selectedIds.includes(client.id);
                return (
                <tr key={client.id} className={isSelected ? 'selected' : ''}>
                  <td>
                     <input 
                       type="checkbox" 
                       className="custom-checkbox"
                       checked={isSelected}
                       onChange={() => handleSelectOne(client.id)}
                     />
                  </td>
                  
                  {/* Fusión Nombre + Email + Avatar */}
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
                      <span className="status-badge active"><CheckCircle2 size={14}/> Activa</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                         <span className="status-badge inactive"><XCircle size={14}/> Inactiva</span>
                         <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Desde {new Date(client.updated_at || client.created_at).toLocaleDateString()}
                         </span>
                      </div>
                    )}
                  </td>
                  
                  <td>
                    {renderDaysVisual(client)}
                  </td>
                  
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                       <Monitor size={16} color="var(--primary)"/>
                       <span style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>Límite: {client.max_devices || 2} PCs</span>
                    </div>
                  </td>
                  
                  <td style={{ display: 'flex', gap: '12px', alignItems: 'center', height: '100%' }}>
                    {/* Botón de WhatsApp Condicionante */}
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
              )})}
              {filteredClients.length === 0 && (
                <tr>
                   <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
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
    </div>
  );
}
