import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Landing, Login, Register } from './pages/Auth';
import { Home } from './pages/Home';
import { MapZem } from './pages/MapZem';

function Protected({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('lotisec_token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="app-content justify-center items-center text-center" style={{ backgroundColor: 'white' }}>
      <h2 className="text-primary">{title}</h2>
      <p className="text-secondary">Cette fonctionnalité sera disponible prochainement.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Routes protégées avec le Layout (Sidebar / Bottom Nav) */}
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route path="home" element={<Home />} />
        <Route path="hopitaux" element={<PlaceholderPage title="Hôpitaux" />} />
        <Route path="conseils" element={<PlaceholderPage title="Conseils" />} />
        <Route path="qr" element={<PlaceholderPage title="Mon QR Code" />} />
      </Route>

      {/* MapZem est en plein écran, sans la bottom nav */}
      <Route path="/map" element={<Protected><MapZem /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
