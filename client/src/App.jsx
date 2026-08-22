import { Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import RecordsPage from './pages/RecordsPage';
import RecordDetailPage from './pages/RecordDetailPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/records" element={<RecordsPage />} />
      <Route path="/records/:id" element={<RecordDetailPage />} />
    </Routes>
  );
}

export default App;
