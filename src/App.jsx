import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component } from 'react';
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
import UsersAdmin from './pages/UsersAdmin';
import Sequences from './pages/Sequences';
import Reports from './pages/Reports';
import ContactDetail from './pages/ContactDetail';
import Accounts from './pages/Accounts';
import HQs from './pages/HQs';
import AccountDetail from './pages/AccountDetail';
import ProspectDiscovery from './pages/ProspectDiscovery';

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f5f3' }}>
    <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f5f3', gap: 12 }}>
          <div style={{ fontSize: 36 }}>â ï¸</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: '#888', maxWidth: 340, textAlign: 'center' }}>{this.state.error?.message || 'Unexpected error'}</div>
          <button onClick={() => window.location.href = '/'} style={{ marginTop: 8, padding: '9px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Reload app</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
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
              <Route path="hqs" element={<HQs />} />
              <Route path="discover" element={<ProspectDiscovery />} />
              <Route path="followups" element={<FollowUps />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route path="activity" element={<Activity />} />
              <Route path="teams" element={<Teams />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="settings" element={<Settings />} />
              <Route path="users" element={<UsersAdmin />} />
              <Route path="sequences" element={<Sequences />} />
              <Route path="reports" element={<Reports />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
