import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Landing, Login, Register } from './pages/Auth';
import { Home } from './pages/Home';
import { MapZem } from './pages/MapZem';
import { Hopitaux } from './pages/Hopitaux';
import { Conseils } from './pages/Conseils';
import { QrCode } from './pages/QrCode';

function Protected({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('lotisec_token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
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
        <Route path="hopitaux" element={<Hopitaux />} />
        <Route path="conseils" element={<Conseils />} />
        <Route path="qr" element={<QrCode />} />
      </Route>

      {/* MapZem est en plein écran, sans la bottom nav */}
      <Route path="/map" element={<Protected><MapZem /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
