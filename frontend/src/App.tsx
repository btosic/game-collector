import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CollectionPage from './pages/CollectionPage';
import TradesPage from './pages/TradesPage';
import MarketPage from './pages/MarketPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route index element={<Navigate to="/collection" replace />} />
            <Route path="/collection" element={<CollectionPage />} />
            <Route path="/trades" element={<TradesPage />} />
            <Route path="/market" element={<MarketPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/collection" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
