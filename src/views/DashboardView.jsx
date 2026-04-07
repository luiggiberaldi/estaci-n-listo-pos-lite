import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { TrendingUp, Users, ShieldAlert, CreditCard } from 'lucide-react';
import './DashboardView.css';

export default function DashboardView() {
  const [stats, setStats] = useState({
    totalLicenses: 0,
    activeLicenses: 0,
    expiringSoon: 0,
    mrr: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch licenses count
        const { data: licenses, error: licError } = await supabase
          .from('cloud_licenses')
          .select('days_remaining, active');
          
        if (licError) throw licError;

        let active = 0;
        let expiring = 0;

        licenses.forEach(lic => {
          if (lic.active) active++;
          if (lic.days_remaining <= 3 && lic.days_remaining > 0 && lic.active) {
            expiring++;
          }
        });

        // Fetch MRR from logs (Sum of mrr_value current month)
        // For simplicity, we fetch all for now or do a specific query. Let's sum all recent.
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const { data: logs, error: logError } = await supabase
          .from('license_audit_logs')
          .select('mrr_value')
          .gte('created_at', startOfMonth);

        if (logError) throw logError;

        const mrrSum = logs.reduce((sum, log) => sum + (Number(log.mrr_value) || 0), 0);

        setStats({
          totalLicenses: licenses.length,
          activeLicenses: active,
          expiringSoon: expiring,
          mrr: mrrSum
        });
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: 'var(--primary)', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>
          <TrendingUp size={32} />
        </div>
        <h3>Cargando Métricas...</h3>
      </div>
    );
  }

  return (
    <div className="dashboard-container fade-in-up">
      <header className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#fff' }}>Panel de Control Financiero</h1>
          <p style={{ color: 'var(--text-muted)' }}>Métricas clave y estado de licencias de Abasto en la nube</p>
        </div>
      </header>

      <div className="kpi-grid">
        <div className="glass-panel kpi-card">
           <div className="kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--primary)' }}>
              <Users size={24} />
           </div>
           <div className="kpi-info">
              <span className="kpi-label">Suscripciones Totales</span>
              <span className="kpi-value">{stats.totalLicenses}</span>
           </div>
        </div>

        <div className="glass-panel kpi-card">
           <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)' }}>
              <ShieldAlert size={24} />
           </div>
           <div className="kpi-info">
              <span className="kpi-label">Licencias Activas</span>
              <span className="kpi-value">{stats.activeLicenses}</span>
           </div>
        </div>

        <div className="glass-panel kpi-card">
           <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning)' }}>
              <TrendingUp size={24} />
           </div>
           <div className="kpi-info">
              <span className="kpi-label">Por Vencer (&le; 3 días)</span>
              <span className="kpi-value">{stats.expiringSoon}</span>
           </div>
        </div>

        <div className="glass-panel kpi-card">
           <div className="kpi-icon" style={{ background: 'rgba(139, 92, 246, 0.2)', color: 'var(--secondary)' }}>
              <CreditCard size={24} />
           </div>
           <div className="kpi-info">
              <span className="kpi-label">MRR (Ingreso Mensual)</span>
              <span className="kpi-value">${stats.mrr.toFixed(2)}</span>
           </div>
        </div>
      </div>

      <div className="glass-panel charts-section" style={{ marginTop: '2rem', padding: '2rem', minHeight: '300px' }}>
        <h3>Evolución de Ingresos</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>El gráfico de MRR y proyecciones se implementará aquí.</p>
        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
          <TrendingUp size={64} color="var(--primary)" />
        </div>
      </div>
    </div>
  );
}
