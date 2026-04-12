import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { getLiveDays } from '../utils';
import { AlertTriangle, Clock, XCircle, MessageCircle, RefreshCw, Zap } from 'lucide-react';
import './AlertsView.css';

export default function AlertsView() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(new Set());

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Select only needed columns — avoids downloading device_id and other unused fields
    const { data, error: fetchError } = await supabase
      .from('cloud_licenses')
      .select('id, email, business_name, phone, plan_tier, active, license_type, valid_until, days_remaining, updated_at, created_at');
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setClients(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const renewClient = async (client, days) => {
    setActionLoading(prev => new Set([...prev, client.id]));
    try {
      const base = new Date(Math.max(Date.now(), new Date(client.valid_until || 0)));
      base.setDate(base.getDate() + days);
      const { error } = await supabase.from('cloud_licenses').update({
        days_remaining: getLiveDays(client) + days,
        license_type: 'days',
        valid_until: base.toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', client.id);
      if (error) throw error;
      fetchClients();
    } catch (err) {
      console.error('Error al renovar:', err);
      setError('Error al renovar licencia: ' + err.message);
    } finally {
      setActionLoading(prev => { const s = new Set(prev); s.delete(client.id); return s; });
    }
  };

  const activateClient = async (client) => {
    setActionLoading(prev => new Set([...prev, client.id]));
    try {
      const { error } = await supabase.from('cloud_licenses').update({
        active: true,
        updated_at: new Date().toISOString()
      }).eq('id', client.id);
      if (error) throw error;
      fetchClients();
    } catch (err) {
      console.error('Error al activar:', err);
      setError('Error al activar licencia: ' + err.message);
    } finally {
      setActionLoading(prev => { const s = new Set(prev); s.delete(client.id); return s; });
    }
  };

  const getWALink = (client) => {
    if (!client.phone) return null;
    const phone = client.phone.replace(/[^0-9]/g, '');
    const days = getLiveDays(client);
    const msg = days <= 0
      ? `Hola *${client.business_name || 'Cliente'}*, tu licencia de Abasto ha vencido. Contáctanos para renovar.`
      : `Hola *${client.business_name || 'Cliente'}*, tu licencia de Abasto vence en ${days} día(s). ¿Deseas renovarla?`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const now = new Date();

  const critical = clients.filter(c =>
    c.license_type !== 'permanent' && c.active === true &&
    (getLiveDays(c) <= 3 || (c.valid_until && new Date(c.valid_until) < now))
  );

  const upcoming = clients.filter(c =>
    c.license_type !== 'permanent' && c.active === true &&
    getLiveDays(c) > 3 && getLiveDays(c) <= 7
  );

  const suspended = clients.filter(c => c.active === false);

  const getInitial = (client) =>
    (client.business_name || client.email || '?').charAt(0).toUpperCase();

  const getTierLabel = (tier) => {
    const map = { basic: 'Basic', pro: 'Pro', premium: 'Premium' };
    return map[tier] || tier || '—';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const AlertRow = ({ client, showDays = true, showActivate = false }) => {
    const days = getLiveDays(client);
    const isExpired = days <= 0;
    const waLink = getWALink(client);
    const isLoading = actionLoading.has(client.id);

    return (
      <div className="alert-row fade-in-up">
        <div className="alert-avatar">
          {getInitial(client)}
        </div>
        <div className="alert-info">
          <strong>{client.business_name || '(Sin nombre)'}</strong>
          <span>{client.email || client.phone || '—'}</span>
        </div>
        {showDays && (
          <span className={`badge ${isExpired ? 'badge-danger' : 'badge-warning'}`}>
            {isExpired ? 'Vencida' : `${days}d`}
          </span>
        )}
        {showActivate && (
          <span className="badge badge-muted" style={{ fontSize: '0.7rem' }}>
            Desde {formatDate(client.updated_at || client.created_at)}
          </span>
        )}
        <span className={`tier-badge tier-${client.plan_tier || 'basic'}`}>
          {getTierLabel(client.plan_tier)}
        </span>
        <div className="alert-actions">
          {showActivate ? (
            <button
              className="glass-button"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
              onClick={() => activateClient(client)}
              disabled={isLoading}
            >
              {isLoading ? <RefreshCw size={13} className="spin" /> : 'Activar'}
            </button>
          ) : (
            <button
              className="glass-button"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
              onClick={() => renewClient(client, 30)}
              disabled={isLoading}
            >
              {isLoading ? <RefreshCw size={13} className="spin" /> : '+30 días'}
            </button>
          )}
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-button"
              title="Enviar WhatsApp"
              style={{ color: '#25D366' }}
            >
              <MessageCircle size={16} />
            </a>
          )}
        </div>
      </div>
    );
  };

  const allClear = critical.length === 0 && upcoming.length === 0 && suspended.length === 0;

  return (
    <div className="alerts-container">
      <div className="alerts-header">
        <div>
          <h1>Centro de Alertas</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Licencias que requieren atención inmediata o seguimiento
          </p>
        </div>
        <button className="glass-button" onClick={fetchClients} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '1rem', color: 'var(--danger)', background: 'var(--danger-bg)' }}>
          Error al cargar datos: {error}
        </div>
      )}

      <div className="summary-bar">
        <div className="summary-card" style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertTriangle size={22} color="var(--danger)" />
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Outfit', color: 'var(--danger)' }}>
              {critical.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Críticas
            </div>
          </div>
        </div>
        <div className="summary-card" style={{ background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Clock size={22} color="var(--warning)" />
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Outfit', color: 'var(--warning)' }}>
              {upcoming.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Próximas
            </div>
          </div>
        </div>
        <div className="summary-card" style={{ background: 'rgba(148,163,184,0.07)', border: '1px solid var(--glass-border)' }}>
          <XCircle size={22} color="var(--text-muted)" />
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Outfit', color: 'var(--text-main)' }}>
              {suspended.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Suspendidas
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={20} className="spin" style={{ marginBottom: '0.5rem' }} />
          <div>Cargando alertas...</div>
        </div>
      )}

      {!loading && allClear && (
        <div className="empty-state">
          <Zap size={40} style={{ color: 'var(--primary-light)', marginBottom: '0.75rem' }} />
          <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>No hay alertas pendientes</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>¡Todo en orden!</div>
        </div>
      )}

      {!loading && critical.length > 0 && (
        <div className="glass-panel" style={{ padding: '0' }}>
          <div className="alert-section-header" style={{ color: 'var(--danger)', background: 'var(--danger-bg)', margin: '0', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}>
            <AlertTriangle size={14} />
            Crítico — {critical.length} licencia{critical.length !== 1 ? 's' : ''}
          </div>
          {critical.map(c => <AlertRow key={c.id} client={c} showDays />)}
        </div>
      )}

      {!loading && upcoming.length > 0 && (
        <div className="glass-panel" style={{ padding: '0' }}>
          <div className="alert-section-header" style={{ color: 'var(--warning)', background: 'var(--warning-bg)', margin: '0', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}>
            <Clock size={14} />
            Próximos a vencer — {upcoming.length} licencia{upcoming.length !== 1 ? 's' : ''}
          </div>
          {upcoming.map(c => <AlertRow key={c.id} client={c} showDays />)}
        </div>
      )}

      {!loading && suspended.length > 0 && (
        <div className="glass-panel" style={{ padding: '0' }}>
          <div className="alert-section-header" style={{ color: 'var(--text-muted)', background: 'rgba(148,163,184,0.07)', margin: '0', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}>
            <XCircle size={14} />
            Suspendidas — {suspended.length} licencia{suspended.length !== 1 ? 's' : ''}
          </div>
          {suspended.map(c => <AlertRow key={c.id} client={c} showDays={false} showActivate />)}
        </div>
      )}
    </div>
  );
}
