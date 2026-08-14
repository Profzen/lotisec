import React, {useEffect} from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Home, Asterisk, Lightbulb, QrCode, Map as MapIcon, Bot } from 'lucide-react';
import {configureRealtime} from '../api/session';
import { ThemeToggle } from './ThemeToggle';

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
          <div className="brand-logo">
            <img src="/logo-118.png" alt="Logo LOTISEC" />
          </div>
          <h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.5rem', letterSpacing: '-0.5px' }}>
            LOTISEC
          </h2>
          <ThemeToggle />
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
          <div className="mobile-theme-control"><ThemeToggle /></div>
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
          <Link to="/assistant" className="ai-floating-avatar" aria-label="Ouvrir l’assistant IA LOTISEC" title="Assistant IA">
            <Bot size={27} strokeWidth={1.9}/><span>IA</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
