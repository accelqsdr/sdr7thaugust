import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ROLES = ['sdr', 'poc', 'manager', 'director'];
const ROLE_LABELS = { sdr: 'SDR', poc: 'POC', manager: 'Manager', director: 'Director' };
const ROLE_COLORS = {
  sdr:      { bg: '#eff6ff', color: '#1d4ed8' },
  poc:      { bg: '#f0fdf4', color: '#166534' },
  manager:  { bg: '#fdf4ff', color: '#7e22ce' },
  director: { bg: '#fff7ed', color: '#c2410c' },
};

async function callFn(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function UsersAdmin() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [toast, setToast] = useState(null);
  const [editing, setEditing] = useState({}); // { userId: { role, full_name, region } }

  const isDirector = profile?.role === 'director';

  useEffect(() => {
    callFn({ action: 'list_users' })
      .then(d => { setUsers(d.users || []); setLoading(false); })
      .catch(e => { setToast({ msg: e.message, type: 'error' }); setLoading(false); });
  }, []);

  function startEdit(u) {
    setEditing(prev => ({
      ...prev,
      [u.id]: { role: u.role || 'sdr', full_name: u.full_name || '', region: u.region || '' }
    }));
  }

  function cancelEdit(uid) {
    setEditing(prev => { const n = { ...prev }; delete n[uid]; return n; });
  }

  async function saveUser(u) {
    const edits = editing[u.id];
    if (!edits) return;
    setSaving(prev => ({ ...prev, [u.id]: true }));
    try {
      await callFn({ action: 'update_user', user_id: u.id, ...edits });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...edits, has_profile: true } : x));
      cancelEdit(u.id);
      showToast('Saved!');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(prev => ({ ...prev, [u.id]: false }));
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  if (!['director', 'manager'].includes(profile?.role)) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        Access restricted to Directors and Managers.
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${toast.type === 'error' ? '#fca5a5' : '#86efac'}`,
          color: toast.type === 'error' ? '#dc2626' : '#166534',
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 4 }}>Team Members</h1>
        <p style={{ fontSize: 13, color: '#888' }}>
          {isDirector ? 'Assign roles and manage your team.' : 'View your team members.'} {users.length} users total.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>Loading team…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {users.map(u => {
            const ed = editing[u.id];
            const isSaving = saving[u.id];
            const rc = u.role ? ROLE_COLORS[u.role] : { bg: '#f5f5f3', color: '#888' };

            return (
              <div key={u.id} style={{ background: '#fff', border: '0.5px solid #e8e8e4',
                borderRadius: 12, padding: '16px 20px' }}>
                {!ed ? (
                  /* VIEW MODE */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%',
                      background: '#f0f0ed', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#555', flexShrink: 0 }}>
                      {(u.full_name || u.email || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>
                        {u.full_name || <span style={{ color: '#aaa', fontStyle: 'italic' }}>No name set</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{u.email}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {u.region && (
                        <span style={{ fontSize: 11, color: '#888', background: '#f5f5f3',
                          padding: '3px 8px', borderRadius: 6 }}>{u.region}</span>
                      )}
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px',
                        borderRadius: 20, background: rc.bg, color: rc.color }}>
                        {u.role ? ROLE_LABELS[u.role] : 'No role'}
                      </span>
                      {isDirector && (
                        <button onClick={() => startEdit(u)}
                          style={{ padding: '6px 14px', background: '#f5f5f3', border: '0.5px solid #e8e8e4',
                            borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#555' }}>
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* EDIT MODE */
                  <div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Full Name</label>
                        <input value={ed.full_name} onChange={e => setEditing(p => ({ ...p, [u.id]: { ...p[u.id], full_name: e.target.value } }))}
                          placeholder="Full name"
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Role</label>
                        <select value={ed.role} onChange={e => setEditing(p => ({ ...p, [u.id]: { ...p[u.id], role: e.target.value } }))}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, background: '#fff', boxSizing: 'border-box' }}>
                          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Region</label>
                        <input value={ed.region} onChange={e => setEditing(p => ({ ...p, [u.id]: { ...p[u.id], region: e.target.value } }))}
                          placeholder="e.g. APAC, US"
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => saveUser(u)} disabled={isSaving}
                        style={{ padding: '7px 18px', background: '#111', color: '#fff', border: 'none',
                          borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => cancelEdit(u.id)}
                        style={{ padding: '7px 14px', background: '#f5f5f3', border: '0.5px solid #e8e8e4',
                          borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#555' }}>
                        Cancel
                      </button>
                      <span style={{ fontSize: 12, color: '#aaa', alignSelf: 'center' }}>{u.email}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
