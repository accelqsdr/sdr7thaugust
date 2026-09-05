import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppShell() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f5f5f3' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  );
}
