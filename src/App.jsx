import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppShell from './components/layout/AppShell';

// Lazy-load every page — only downloaded when first visited
const Login        = lazy(() => import('./pages/Login'));
const Dashboard    = lazy(() => import('./pages/Dashboard'));
const Contacts     = lazy(() => import('./pages/Contacts'));
const FollowUps    = lazy(() => import('./pages/FollowUps'));
const Pipeline     = lazy(() => import('./pages/Pipeline'));
const Activity     = lazy(() => import('./pages/Activity'));
const Teams        = lazy(() => import('./pages/Teams'));
const Analytics    = lazy(() => import('./pages/Analytics'));
const Leaderboard  = lazy(() => import('./pages/Leaderboard'));
const Settings     = lazy(() => import('./pages/Settings'));
const Sequences    = lazy(() => import('./pages/Sequences'));
const Reports      = lazy(() => import('./pages/Reports'));
const ContactDetail= lazy(() => import('./pages/ContactDetail'));
const Accounts     = lazy(() => import('./pages/Accounts'));
const AccountDetail= lazy(() => import('./pages/AccountDetail'));
const Lists        = lazy(() => import('./pages/Lists'));
const Responses    = lazy(() => import('./pages/Responses'));

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#aaa', fontSize: 14 }}>
    Loading…
  </div>
);

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
        <Suspense fallback={<PageLoader />}>
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
              <Route path="responses" element={<Responses />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
