import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppShell from './components/layout/AppShell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import FollowUps from './pages/FollowUps';
import Pipeline from './pages/Pipeline';
import Activity from './pages/Activity';
import Teams from './pages/Teams';
import Analytics from './pages/Analytics';
import Leaderboard from './pages/Leaderboard';
import Settings from './pages/Settings';
import Sequences from './pages/Sequences';
import Reports from './pages/Reports';
import ContactDetail from './pages/ContactDetail';
import Accounts from './pages/Accounts';
import AccountDetail from './pages/AccountDetail';
import Lists from './pages/Lists';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#aaa', fontSize: 14 }}>
      Loading…
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="contacts/:id" element={<ContactDetail />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="accounts/:id" element={<AccountDetail />} />
            <Route path="followups" element={<FollowUps />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="activity" element={<Activity />} />
            <Route path="teams" element={<Teams />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="sequences" element={<Sequences />} />
            <Route path="reports" element={<Reports />} />
            <Route path="lists" element={<Lists />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
