import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Landing, Login, Register } from './pages/Auth';
import { Home } from './pages/Home';
import { MapZem } from './pages/MapZem';

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
        <Route path="map" element={<MapZem />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
