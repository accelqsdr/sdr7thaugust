import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { signOut } from '../../lib/auth';

const navByRole = {
  sdr: [
    { to: '/', icon: 'â', label: 'Dashboard', end: true },
    { to: '/contacts', icon: 'ð¥', label: 'My contacts' },
    { to: '/accounts', icon: 'ð¢', label: 'Accounts' },
    { to: '/followups', icon: 'ð', label: 'Follow-ups' },
    { to: '/lists', icon: 'ð', label: 'Lists' },
    { to: '/pipeline', icon: 'ð', label: 'Pipeline' },
    { to: '/sequences', icon: 'ð', label: 'Sequences' },
  ],
  poc: [
    { to: '/', icon: 'â', label: 'Dashboard', end: true },
    { to: '/users-admin', icon: '👥', label: 'People' },
    { to: '/teams', icon: 'ð¥', label: 'My team' },
    { to: '/contacts', icon: 'ð', label: 'Contacts' },
    { to: '/accounts', icon: 'ð¢', label: 'Accounts' },
    { to: '/followups', icon: 'ð', label: 'Follow-ups' },
    { to: '/lists', icon: 'ð', label: 'Lists' },
    { to: '/activity', icon: 'ð¡', label: 'Activity feed' },
    { to: '/reports', icon: 'ð', label: 'Reports' },
  ],
  manager: [
    { to: '/', icon: 'â', label: 'Dashboard', end: true },
    { to: '/teams', icon: 'ð¥', label: 'All teams' },
    { to: '/accounts', icon: 'ð¢', label: 'Accounts' },
    { to: '/lists', icon: 'ð', label: 'Lists' },
    { to: '/pipeline', icon: 'ð', label: 'Pipeline' },
    { to: '/analytics', icon: 'ð', label: 'Analytics' },
    { to: '/activity', icon: 'ð¡', label: 'Activity' },
    { to: '/reports', icon: 'ð', label: 'Reports' },
  ],
  director: [
    { to: '/', icon: 'â', label: 'Overview', end: true },
    { to: '/teams', icon: 'ð¢', label: 'Org structure' },
    { to: '/accounts', icon: 'ð¢', label: 'Accounts' },
    { to: '/analytics', icon: 'ð', label: 'Analytics' },
    { to: '/lists', icon: 'ð', label: 'Lists' },
    { to: '/pipeline', icon: 'ð', label: 'Pipeline' },
    { to: '/leaderboard', icon: 'ð', label: 'Leaderboard' },
    { to: '/settings', icon: 'âï¸', label: 'Settings' },
  ],
};

const roleColors = { director: '#7c3aed', manager: '#d97706', poc: '#2563eb', sdr: '#059669' };
const roleLabels = { director: 'Director', manager: 'Manager', poc: 'POC', sdr: 'SDR' };

export default function Sidebar() {
  const { profile } = useAuth();
  const role = profile?.role || 'sdr';
  const nav = navByRole[role] || navByRole.sdr;
  const color = roleColors[role];

  const linkStyle = (isActive) => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
    borderRadius: 8, textDecoration: 'none', fontSize: 13,
    color: isActive ? '#111' : '#555',
    background: isActive ? '#f0f0ee' : 'transparent',
    fontWeight: isActive ? 500 : 400,
    transition: 'background 0.1s',
  });

  return (
    <div style={{ width: 200, background: '#fafaf8', borderRight: '0.5px solid #e8e8e4', display: 'flex', flexDirection: 'column', height: '100vh', flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ padding: '16px 16px 14px', borderBottom: '0.5px solid #e8e8e4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, background: '#e8f0fe', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111', lineHeight: 1.2 }}>ACCELQ</div>
            <div style={{ fontSize: 10, color: '#999' }}>Outreach Platform</div>
          </div>
        </div>
      </div>

      {/* Role badge */}
      <div style={{ padding: '10px 16px', borderBottom: '0.5px solid #e8e8e4' }}>
        <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>Signed in as</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{profile?.full_name || 'â'}</div>
        <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: color + '20', color }}>
          {roleLabels[role]}
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        <div style={{ fontSize: 10, color: '#bbb', padding: '6px 8px 4px', letterSpacing: '0.5px' }}>MENU</div>
        {nav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} style={({ isActive }) => linkStyle(isActive)}>
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div style={{ padding: '12px 8px', borderTop: '0.5px solid #e8e8e4' }}>
        <button
          onClick={signOut}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: '#888', fontSize: 13, cursor: 'pointer' }}
        >
          <span>â©</span> Sign out
        </button>
      </div>
    </div>
  );
}
