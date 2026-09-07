import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import SDRDashboard from '../components/dashboards/SDRDashboard';
import POCDashboard from '../components/dashboards/POCDashboard';
import ManagerDashboard from '../components/dashboards/ManagerDashboard';
import DirectorDashboard from '../components/dashboards/DirectorDashboard';

export default function Dashboard() {
  const { profile } = useAuth();
  const role = profile?.role;

  if (role === 'owner') return <SDRDashboard />;
  if (role === 'sub-admin') return profile?.subAdminTier === 'team' ? <ManagerDashboard /> : <POCDashboard />;
  if (role === 'admin') return <DirectorDashboard />;
  return <div style={{ padding: 24, color: '#888' }}>Loading dashboard…</div>;
}
