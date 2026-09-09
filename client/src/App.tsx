import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import MobileDashboard from './pages/MobileDashboard';
import RecordsPage from './pages/RecordsPage';
import MobileRecordsPage from './pages/MobileRecordsPage';
import RecordDetailPage from './pages/RecordDetailPage';
import DueSettlementPage from './pages/DueSettlementPage';
import AuthPage from './pages/AuthPage';
import InstallPrompt from './components/InstallPrompt';

const AUTH_STORAGE_KEY = 'kanhaiya-gold-auth';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return isMobile;
}

function ResponsiveDashboard() {
  return useIsMobile() ? <MobileDashboard /> : <Dashboard />;
}

function ResponsiveRecords() {
  return useIsMobile() ? <MobileRecordsPage /> : <RecordsPage />;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const authenticated = Boolean(localStorage.getItem(AUTH_STORAGE_KEY));
  return authenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/" element={<RequireAuth><ResponsiveDashboard /></RequireAuth>} />
        <Route path="/records" element={<RequireAuth><ResponsiveRecords /></RequireAuth>} />
        <Route path="/records/:id" element={<RequireAuth><RecordDetailPage /></RequireAuth>} />
        <Route path="/dues" element={<RequireAuth><DueSettlementPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InstallPrompt />
    </>
  );
}

export default App;
