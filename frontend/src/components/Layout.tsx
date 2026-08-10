import React, {useEffect} from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Asterisk, Lightbulb, QrCode, Map as MapIcon } from 'lucide-react';
import {configureRealtime} from '../api/session';

export function Layout() {
  useEffect(()=>{configureRealtime();const timer=setInterval(configureRealtime,45*60*1000);return()=>clearInterval(timer);},[]);
  const navLinks = [
    { to: '/home', icon: <Home size={24} />, label: 'Accueil' },
    { to: '/hopitaux', icon: <Asterisk size={24} />, label: 'Hôpitaux' },
    { to: '/conseils', icon: <Lightbulb size={24} />, label: 'Conseils' },
    { to: '/qr', icon: <QrCode size={24} />, label: 'Mon QR' },
    { to: '/trajets', icon: <MapIcon size={24} />, label: 'Trajets' },
  ];

  return (
    <div className="app-container">
      {/* Sidebar Desktop */}
      <aside className="sidebar">
        <div style={{ padding: '0 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden' }}>
            <img src="/logo-lotisec.png" alt="Logo LOTISEC" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.5rem', letterSpacing: '-0.5px' }}>
            LOTISEC
          </h2>
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column' }}>
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              {React.cloneElement(link.icon as React.ReactElement, { size: 20 })}
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="app-content">
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100vh', position: 'relative' }}>
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
        </div>
      </main>
    </div>
  );
}
