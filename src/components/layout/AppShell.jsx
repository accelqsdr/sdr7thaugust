import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';

function ViewAsBanner() {
  const { viewingAs, exitViewAs } = useAuth();
  if (!viewingAs) return null;
  const name = viewingAs.profile?.full_name || viewingAs.email || 'this user';
  const roleLabel = { owner: 'Owner', 'sub-admin': 'Sub-admin', admin: 'Admin' }[viewingAs.profile?.role] || '';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: '#111', color: '#fff', padding: '8px 16px', fontSize: 13,
      flexShrink: 0,
    }}>
      <span>
        👁 Viewing as <strong>{name}</strong>{roleLabel ? ` (${roleLabel})` : ''} — you're seeing exactly what they see
      </span>
      <button
        onClick={exitViewAs}
        style={{ background: '#fff', color: '#111', border: 'none', borderRadius: 6,
          padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
      >
        Exit to my view
      </button>
    </div>
  );
}

export default function AppShell() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f5f5f3' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <ViewAsBanner />
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
