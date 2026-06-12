import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Asterisk, Lightbulb, QrCode, Map as MapIcon } from 'lucide-react';

export function Layout() {
  const navLinks = [
    { to: '/home', icon: <Home size={24} />, label: 'Accueil' },
    { to: '/hopitaux', icon: <Asterisk size={24} />, label: 'Hôpitaux' },
    { to: '/conseils', icon: <Lightbulb size={24} />, label: 'Conseils' },
    { to: '/qr', icon: <QrCode size={24} />, label: 'Mon QR' },
    { to: '/trajets', icon: <MapIcon size={24} />, label: 'Trajets' },
  ];

  return (
    <div className="app-container">
      {/* Sidebar Desktop (Hidden, used to center content) */}
      <aside className="sidebar">
      </aside>

      {/* Main Content */}
      <main className="app-content">
        <Outlet />
        
        {/* Bottom Nav Mobile */}
        <nav className="bottom-nav">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {React.cloneElement(link.icon as React.ReactElement, { size: 24, strokeWidth: 1.5 })}
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </main>
    </div>
  );
}
