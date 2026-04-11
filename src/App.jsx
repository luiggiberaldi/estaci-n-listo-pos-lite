import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Users, Bell, Settings, LogOut, ShieldCheck, Activity } from 'lucide-react';
import './App.css';

import DashboardView from './views/DashboardView';
import ClientsView from './views/ClientsView';
import AlertsView from './views/AlertsView';
import SettingsView from './views/SettingsView';
import LockScreen from './components/LockScreen';
import { supabase } from './config/supabase';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [alertCount, setAlertCount] = useState(0);
  const lockRef = useRef(null);

  const fetchAlertCount = async () => {
    try {
      const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
      const { data, error } = await supabase
        .from('cloud_licenses')
        .select('id', { count: 'exact' })
        .lte('valid_until', sevenDaysFromNow)
        .eq('active', true)
        .neq('license_type', 'permanent');
      if (!error) setAlertCount(data?.length || 0);
    } catch (err) {
      console.error('fetchAlertCount error:', err);
    }
  };

  useEffect(() => {
    fetchAlertCount();
    const interval = setInterval(() => {
      // Skip fetch when the tab is hidden to avoid unnecessary API calls
      if (document.visibilityState !== 'hidden') {
        fetchAlertCount();
      }
    }, 30 * 60 * 1000); // 30 min — la Estación es herramienta de admin, no necesita alertas en tiempo real
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    lockRef.current?.();
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clientes & Licencias', icon: Users },
    { id: 'alerts', label: 'Alertas', icon: Bell, badge: alertCount },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  return (
    <LockScreen lockRef={lockRef}>
      <div className="app-container">
        <aside className="sidebar">
          <div className="sidebar-header">
            <ShieldCheck size={22} color="var(--primary)" strokeWidth={2.5} />
            <h1>Listo POS Lite Master</h1>
            <span className="v2-badge">v2.0</span>
          </div>

          <nav className="nav-links">
            {navItems.map(({ id, label, icon: Icon, badge }) => (
              <div
                key={id}
                className={`nav-item ${activeTab === id ? 'active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <Icon size={20} className="nav-icon" />
                <span>{label}</span>
                {badge > 0 && (
                  <span className="alert-badge">{badge}</span>
                )}
              </div>
            ))}
          </nav>

          <div className="user-profile">
            <div className="user-avatar">A</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Admin</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estación Maestra</div>
            </div>
            <button
              className="glass-button"
              style={{ padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer' }}
              aria-label="Bloquear estación"
              title="Bloquear estación"
              onClick={handleLogout}
            >
              <LogOut size={18} color="var(--danger)" />
            </button>
          </div>
        </aside>

        <main className="main-content">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'clients' && <ClientsView />}
          {activeTab === 'alerts' && <AlertsView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </LockScreen>
  );
}

export default App;
