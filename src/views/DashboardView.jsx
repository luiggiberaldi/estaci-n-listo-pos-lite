import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { getLiveDays } from '../utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, Users, ShieldAlert, CreditCard,
  AlertTriangle, RefreshCw, DollarSign, Settings2
} from 'lucide-react';
import './DashboardView.css';

const DEFAULT_PRICES = { basic: 5, pro: 15, premium: 30 };
const PLAN_COLORS = { basic: '#475569', pro: '#6366f1', premium: '#a78bfa' };

function getStoredPrices() {
  try {
    const raw = localStorage.getItem('abasto_plan_prices');
    if (raw) return { ...DEFAULT_PRICES, ...JSON.parse(raw) };
  } catch (_) {}
  return { ...DEFAULT_PRICES };
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(10,15,30,0.92)',
      border: '1px solid rgba(99,102,241,0.35)',
      borderRadius: 10,
      padding: '10px 16px',
      color: '#f1f5f9',
      fontSize: '0.82rem',
    }}>
      <div style={{ color: '#818cf8', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div>MRR: <strong>${Number(payload[0].value).toFixed(2)}</strong></div>
    </div>
  );
};

const CustomLegend = ({ payload }) => (
  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: 8 }}>
    {payload?.map((entry) => (
      <span key={entry.value} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: '#94a3b8' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, display: 'inline-block' }} />
        {String(entry.value).charAt(0).toUpperCase() + String(entry.value).slice(1)}
      </span>
    ))}
  </div>
);

export default function DashboardView() {
  const [stats, setStats] = useState({
    totalLicenses: 0,
    activeLicenses: 0,
    expiringSoon: 0,
    mrr: 0,
    estimatedMrr: 0,
    planDistribution: { basic: 0, pro: 0, premium: 0 },
  });
  const [mrrHistory, setMrrHistory] = useState([
    { month: 'Ene', mrr: 0 },
    { month: 'Feb', mrr: 0 },
    { month: 'Mar', mrr: 0 },
    { month: 'Abr', mrr: 0 },
    { month: 'May', mrr: 0 },
    { month: 'Jun', mrr: 0 },
  ]);
  const [planPrices, setPlanPrices] = useState(getStoredPrices);
  const [draftPrices, setDraftPrices] = useState(getStoredPrices);
  const [showPriceConfig, setShowPriceConfig] = useState(false);
  const [expiringClients, setExpiringClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [renewingId, setRenewingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Recalculate estimatedMrr whenever planPrices or plan distribution changes
  useEffect(() => {
    setStats(prev => ({
      ...prev,
      estimatedMrr:
        planPrices.basic  * prev.planDistribution.basic +
        planPrices.pro    * prev.planDistribution.pro +
        planPrices.premium * prev.planDistribution.premium,
    }));
  }, [planPrices]);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch licenses
      const { data: licenses, error: licErr } = await supabase
        .from('cloud_licenses')
        .select('id, email, business_name, active, license_type, valid_until, plan_tier, days_remaining');
      if (licErr) throw licErr;

      // 2. Fetch audit logs for last 6 months (non-fatal — dashboard still works without MRR history)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      let logs = [];
      try {
        const { data: logData, error: logErr } = await supabase
          .from('license_audit_logs')
          .select('mrr_value, created_at')
          .gte('created_at', sixMonthsAgo.toISOString());
        if (!logErr && logData) logs = logData;
      } catch (logFetchErr) {
        console.warn('DashboardView: audit logs fetch failed (non-fatal):', logFetchErr);
      }

      // 3. Process licenses
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 86400000);

      let activeLicenses = 0;
      let expiringSoon = 0;
      const planDistribution = { basic: 0, pro: 0, premium: 0 };
      const expList = [];

      licenses.forEach(lic => {
        if (lic.active) {
          activeLicenses++;
          const tier = lic.plan_tier || 'basic';
          if (tier in planDistribution) planDistribution[tier]++;

          if (lic.license_type !== 'permanent' && lic.valid_until) {
            const expDate = new Date(lic.valid_until);
            if (expDate <= sevenDaysLater && expDate > now) {
              expiringSoon++;
              expList.push(lic);
            }
          }
        }
      });

      // Sort expiring list: soonest first, take top 5
      expList.sort((a, b) => new Date(a.valid_until) - new Date(b.valid_until));
      setExpiringClients(expList.slice(0, 5));

      // 4. Build MRR history — last 6 months
      const monthMap = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('es-MX', { month: 'short' });
        const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
        monthMap[key] = { month: capitalized, mrr: 0 };
      }

      (logs || []).forEach(log => {
        if (!log.created_at) return;
        const d = new Date(log.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (monthMap[key]) {
          monthMap[key].mrr += Number(log.mrr_value) || 0;
        }
      });

      const historyArr = Object.values(monthMap);
      setMrrHistory(historyArr);

      // 5. Current month MRR from logs
      const currentKey = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })();
      const currentMrr = monthMap[currentKey]?.mrr || 0;

      // 6. Estimated MRR from plan prices
      const prices = getStoredPrices();
      const estimatedMrr =
        prices.basic   * planDistribution.basic +
        prices.pro     * planDistribution.pro +
        prices.premium * planDistribution.premium;

      setStats({
        totalLicenses: licenses.length,
        activeLicenses,
        expiringSoon,
        mrr: currentMrr,
        estimatedMrr,
        planDistribution,
      });
    } catch (err) {
      console.error('DashboardView fetchData error:', err);
      setError(err.message || 'No se pudieron cargar las métricas. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickRenew(lic) {
    setRenewingId(lic.id);
    try {
      const base = new Date(Math.max(Date.now(), new Date(lic.valid_until || 0)));
      base.setDate(base.getDate() + 30);
      const newDays = getLiveDays(lic) + 30;
      const { error } = await supabase
        .from('cloud_licenses')
        .update({
          valid_until: base.toISOString(),
          days_remaining: newDays,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lic.id);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      alert('Error al renovar: ' + err.message);
    } finally {
      setRenewingId(null);
    }
  }

  function handleSavePrices() {
    const saved = {
      basic:   Math.max(0, Number(draftPrices.basic)   || 0),
      pro:     Math.max(0, Number(draftPrices.pro)     || 0),
      premium: Math.max(0, Number(draftPrices.premium) || 0),
    };
    localStorage.setItem('abasto_plan_prices', JSON.stringify(saved));
    setPlanPrices(saved);
  }

  const liveEstimated = useMemo(() => (
    (Number(draftPrices.basic)   || 0) * stats.planDistribution.basic +
    (Number(draftPrices.pro)     || 0) * stats.planDistribution.pro +
    (Number(draftPrices.premium) || 0) * stats.planDistribution.premium
  ), [draftPrices, stats.planDistribution]);

  // Build pie data
  const pieData = useMemo(() => [
    { name: 'basic',   value: stats.planDistribution.basic },
    { name: 'pro',     value: stats.planDistribution.pro },
    { name: 'premium', value: stats.planDistribution.premium },
  ].filter(d => d.value > 0), [stats.planDistribution]);

  const totalPie = pieData.reduce((s, d) => s + d.value, 0);

  const pctActive = stats.totalLicenses > 0
    ? Math.round((stats.activeLicenses / stats.totalLicenses) * 100)
    : 0;

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'inline-block', animation: 'spin 1s linear infinite' }}>
          <TrendingUp size={32} />
        </div>
        <h3 style={{ color: 'var(--text-sub)' }}>Cargando Métricas...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel fade-in-up" style={{ padding: '2rem', textAlign: 'center', maxWidth: '480px', margin: '2rem auto' }}>
        <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>
          <AlertTriangle size={40} />
        </div>
        <h3 style={{ marginBottom: '0.5rem' }}>Error al cargar datos</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{error}</p>
        <button className="glass-button primary" onClick={fetchData} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={16} /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-container fade-in-up">
      {/* HEADER */}
      <header className="dashboard-header">
        <div>
          <h1>Panel de Control Financiero</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Métricas clave y estado de licencias de Abasto en la nube
          </p>
        </div>
        <button className="glass-button" onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} /> Actualizar
        </button>
      </header>

      {/* ROW 1: KPI CARDS */}
      <div className="kpi-grid">
        {/* Total suscripciones */}
        <div className="glass-panel kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(59,130,246,0.18)', color: '#60a5fa' }}>
            <Users size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Suscripciones</span>
            <span className="kpi-value">{stats.totalLicenses}</span>
          </div>
        </div>

        {/* Licencias activas */}
        <div className="glass-panel kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.18)', color: 'var(--success)' }}>
            <ShieldAlert size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Licencias Activas</span>
            <span className="kpi-value">{stats.activeLicenses}</span>
            <span className="kpi-sub">{pctActive}% activas</span>
          </div>
        </div>

        {/* Por vencer */}
        <div className="glass-panel kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.18)', color: 'var(--warning)' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Por Vencer &le; 7 días</span>
            <span className="kpi-value" style={{ color: stats.expiringSoon > 0 ? 'var(--warning)' : 'var(--text-main)' }}>
              {stats.expiringSoon}
            </span>
          </div>
        </div>

        {/* MRR */}
        <div className="glass-panel kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(139,92,246,0.18)', color: 'var(--secondary)' }}>
            <CreditCard size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">MRR Actual</span>
            <span className="kpi-value">${stats.mrr.toFixed(2)}</span>
            <span className="kpi-sub" style={{ color: 'var(--primary-light)' }}>
              Est. ${stats.estimatedMrr.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* ROW 2: CHARTS */}
      <div className="charts-grid">
        {/* Area Chart */}
        <div className="glass-panel chart-panel">
          <p className="chart-title">Evolución MRR — Últimos 6 meses</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={mrrHistory} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="rgba(99,102,241,0.4)" />
                  <stop offset="95%" stopColor="rgba(99,102,241,0.01)" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${v}`}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="mrr"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#mrrGradient)"
                dot={{ fill: '#6366f1', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: '#818cf8', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="glass-panel chart-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <p className="chart-title">Distribución de Planes</p>
          {pieData.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Sin datos de planes activos
            </div>
          ) : (
            <div style={{ position: 'relative', flex: 1 }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="48%"
                    innerRadius={55}
                    outerRadius={85}
                    strokeWidth={0}
                  >
                    {pieData.map(entry => (
                      <Cell key={entry.name} fill={PLAN_COLORS[entry.name] || '#475569'} />
                    ))}
                  </Pie>
                  <Legend
                    content={<CustomLegend />}
                    verticalAlign="bottom"
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div style={{
                position: 'absolute',
                top: '43%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{ fontFamily: 'Outfit', fontSize: '1.4rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>
                  {totalPie}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 2 }}>activos</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROW 3: EXPIRING + PRICE CONFIG */}
      <div className="bottom-grid">
        {/* Expiring clients */}
        <div className="glass-panel chart-panel">
          <p className="chart-title" style={{ marginBottom: '1rem' }}>
            Clientes por Vencer (próximos 7 días)
          </p>
          {expiringClients.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0', textAlign: 'center' }}>
              Sin clientes próximos a vencer
            </div>
          ) : (
            <table className="expiring-table">
              <tbody>
                {expiringClients.map(lic => {
                  const days = getLiveDays(lic);
                  return (
                    <tr key={lic.id}>
                      <td style={{ color: 'var(--text-main)', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lic.business_name || lic.email}
                      </td>
                      <td style={{ minWidth: 70 }}>
                        <span style={{
                          color: days <= 2 ? 'var(--danger)' : days <= 4 ? 'var(--warning)' : '#94a3b8',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                        }}>
                          {days === 0 ? 'Hoy' : `${days}d`}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="glass-button"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => handleQuickRenew(lic)}
                          disabled={renewingId === lic.id}
                        >
                          {renewingId === lic.id ? '...' : '+30 días'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Price config */}
        <div className="glass-panel chart-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showPriceConfig ? '1.25rem' : 0 }}>
            <p className="chart-title" style={{ marginBottom: 0 }}>Configurar Precios por Plan</p>
            <button
              className="icon-button"
              onClick={() => setShowPriceConfig(p => !p)}
              style={{ color: showPriceConfig ? 'var(--primary-light)' : 'var(--text-muted)' }}
              title="Configurar precios"
            >
              <Settings2 size={18} />
            </button>
          </div>

          {showPriceConfig && (
            <div className="price-config">
              <div className="price-row">
                <div className="form-group">
                  <label>Precio Basic (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="glass-input"
                    value={draftPrices.basic}
                    onChange={e => setDraftPrices(p => ({ ...p, basic: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Precio Pro (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="glass-input"
                    value={draftPrices.pro}
                    onChange={e => setDraftPrices(p => ({ ...p, pro: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Precio Premium (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="glass-input"
                    value={draftPrices.premium}
                    onChange={e => setDraftPrices(p => ({ ...p, premium: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mrr-preview">
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  MRR Estimado
                </div>
                <div className="mrr-preview-value">${liveEstimated.toFixed(2)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Basado en {stats.activeLicenses} licencias activas
                </div>
              </div>

              <button className="glass-button primary" onClick={handleSavePrices} style={{ alignSelf: 'flex-end', gap: 6 }}>
                <DollarSign size={15} /> Guardar Precios
              </button>
            </div>
          )}

          {!showPriceConfig && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                Precios actuales configurados
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {['basic', 'pro', 'premium'].map(tier => (
                  <div key={tier} style={{
                    flex: 1,
                    background: 'rgba(99,102,241,0.06)',
                    border: '1px solid rgba(99,102,241,0.15)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '0.65rem', color: PLAN_COLORS[tier], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {tier}
                    </div>
                    <div style={{ fontFamily: 'Outfit', fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>
                      ${planPrices[tier]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
