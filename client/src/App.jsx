import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import MobileDashboard from './pages/MobileDashboard';
import RecordsPage from './pages/RecordsPage';
import RecordDetailPage from './pages/RecordDetailPage';

function ResponsiveDashboard() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return isMobile ? <MobileDashboard /> : <Dashboard />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<ResponsiveDashboard />} />
      <Route path="/records" element={<RecordsPage />} />
      <Route path="/records/:id" element={<RecordDetailPage />} />
    </Routes>
  );
}

export default App;
