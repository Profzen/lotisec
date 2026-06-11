import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Map as MapIcon, ShieldAlert, LogOut } from 'lucide-react';

export function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('lotisec_token');
    localStorage.removeItem('lotisec_user');
    navigate('/login');
  };

  const navLinks = [
    { to: '/home', icon: <Home size={24} />, label: 'Accueil' },
    { to: '/map', icon: <MapIcon size={24} />, label: 'Carte Zem' },
  ];

  return (
    <div className="app-container">
      {/* Sidebar Desktop */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/Lotisec.png" alt="Lotisec" />
          <h2 style={{ fontSize: '1.25rem', color: 'var(--color-primary)' }}>LOTISEC</h2>
        </div>
        <nav className="sidebar-nav">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              {link.icon}
              <span>{link.label}</span>
            </NavLink>
          ))}
          <div className="sidebar-item" onClick={handleLogout} style={{ cursor: 'pointer', marginTop: 'auto' }}>
            <LogOut size={24} />
            <span>Déconnexion</span>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="app-content">
        <Outlet />
      </main>

      {/* Bottom Nav Mobile */}
      <nav className="bottom-nav">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {React.cloneElement(link.icon as React.ReactElement, { size: 20 })}
            <span>{link.label}</span>
          </NavLink>
        ))}
        <div className="nav-item" onClick={handleLogout} style={{ cursor: 'pointer' }}>
          <LogOut size={20} />
          <span>Quitter</span>
        </div>
      </nav>
    </div>
  );
}
