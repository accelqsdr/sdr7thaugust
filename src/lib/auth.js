import { supabase } from './supabase';

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUserRole(userId) {
  const { data, error } = await supabase
    .from('org_hierarchy')
    .select('role, full_name, region, reports_to, id')
    .eq('user_id', userId)
    .single();
  if (error) return null;

  // 'sub-admin' covers what used to be two roles (manager + poc). Figure out
  // which shape of team this sub-admin has so the UI can pick the right view:
  // 'team' = manages other sub-admins (old "manager"), 'direct' = manages
  // owners directly (old "poc").
  if (data.role === 'sub-admin') {
    const { data: reports } = await supabase
      .from('org_hierarchy')
      .select('role')
      .eq('reports_to', userId);
    const managesSubAdmins = (reports || []).some(r => r.role === 'sub-admin');
    return { ...data, subAdminTier: managesSubAdmins ? 'team' : 'direct' };
  }

  return data;
}
