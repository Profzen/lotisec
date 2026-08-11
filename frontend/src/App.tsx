import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { Landing, Login, Register } from './pages/Auth';
import { Home } from './pages/Home';
import { MapZem } from './pages/MapZem';
import { MapZemDriver } from './pages/MapZemDriver';
import { Hopitaux } from './pages/Hopitaux';
import { Conseils } from './pages/Conseils';
import { QrCode } from './pages/QrCode';
import { ScanResult } from './pages/ScanResult';
import { Rides } from './pages/Rides';
import { Assistant } from './pages/Assistant';
import {RideDetail} from './pages/RideDetail';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import {Profile} from './pages/Profile';

function Protected({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('lotisec_token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <Toaster position="top-center" />
      <PwaInstallPrompt />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Route publique pour le scan QR (utilisée par les secours) */}
        <Route path="/scan/:token" element={<ScanResult />} />
      
      {/* Routes protégées avec le Layout (Sidebar / Bottom Nav) */}
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route path="home" element={<Home />} />
        <Route path="hopitaux" element={<Hopitaux />} />
        <Route path="conseils" element={<Conseils />} />
        <Route path="qr" element={<QrCode />} />
        <Route path="trajets" element={<Rides />} />
        <Route path="profil" element={<Profile />} />
      </Route>

      {/* Assistant IA en plein écran */}
      <Route path="/assistant" element={<Protected><Assistant /></Protected>} />

      {/* MapZem est en plein écran, sans la bottom nav */}
      <Route path="/map" element={<Protected><MapZem /></Protected>} />
      
      {/* Mode Conducteur Zem */}
      <Route path="/driver" element={<Protected><MapZemDriver /></Protected>} />
      <Route path="/trajets/:rideId" element={<Protected><RideDetail /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
