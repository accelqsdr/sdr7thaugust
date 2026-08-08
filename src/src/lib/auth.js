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
  return data;
}
