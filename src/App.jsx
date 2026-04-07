import { useState } from 'react';
import { LayoutDashboard, Users, ShieldCheck, Settings, LogOut } from 'lucide-react';
import './App.css';

// Views placeholders
import DashboardView from './views/DashboardView';
import ClientsView from './views/ClientsView';
import LockScreen from './components/LockScreen';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <LockScreen>
      <div className="app-container">
      {/* Sidebar Neumórfico/Glass */}
      <aside className="sidebar fade-in-up">
        <div className="sidebar-header">
          <div className="logo-icon" style={{ background: 'var(--primary)', padding: '6px', borderRadius: '8px' }}>
            <ShieldCheck size={24} color="#fff" />
          </div>
          <h1>Abasto Station</h1>
        </div>
        
        <nav className="nav-links">
          <div 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={20} className="nav-icon" />
            <span>Dashboard</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'clients' ? 'active' : ''}`}
            onClick={() => setActiveTab('clients')}
          >
            <Users size={20} className="nav-icon" />
            <span>Clientes & Licencias</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={20} className="nav-icon" />
            <span>Configuración</span>
          </div>
        </nav>

        <div className="user-profile">
          <div className="user-avatar">A</div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Admin</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estación Maestra</div>
          </div>
          <button className="glass-button" style={{ padding: '8px', border: 'none', background: 'transparent' }} aria-label="Cerrar sesión">
            <LogOut size={18} color="var(--danger)" />
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="main-content">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'clients' && <ClientsView />}
        {activeTab === 'settings' && (
           <div className="glass-panel fade-in-up" style={{ padding: '2rem', height: '100%' }}>
              <h2>Configuración</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Ajustes del sistema y WebAuthn</p>
           </div>
        )}
      </main>
    </div>
    </LockScreen>
  );
}

export default App;
