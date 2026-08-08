import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const TYPE_COLORS = {
  email_sent: '#2563eb', email_opened: '#10b981', replied: '#f59e0b', meeting_booked: '#8b5cf6',
  status_changed: '#64748b', contact_added: '#059669', bounce_detected: '#dc2626', followup_done: '#0891b2',
};

export default function Activity() {
  const { user, profile } = useAuth();
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => { load(); }, [user.id, profile?.role]);

  async function load() {
    setLoading(true);
    let q = supabase.from('activity_log')
      .select('*, contacts(full_name,company), org_hierarchy!actor_id(full_name,role)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (profile?.role === 'sdr') {
      q = q.eq('actor_id', user.id);
    } else {
      const { data: subs } = await supabase.rpc('get_subordinate_ids', { manager_user_id: user.id });
      const ids = (subs || []).map(s => s.user_id);
      if (ids.length) q = q.in('actor_id', ids);
      else q = q.eq('actor_id', user.id);
    }
    const { data } = await q;
    setActivity(data || []);
    setLoading(false);
  }

  const types = [...new Set(activity.map(a => a.activity_type))];
  const filtered = filterType === 'all' ? activity : activity.filter(a => a.activity_type === filterType);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Activity feed</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>{filtered.length} events</p>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {['all', ...types].map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid #e0e0e0', fontSize: 12, cursor: 'pointer',
              background: filterType === t ? '#2563eb' : '#fff', color: filterType === t ? '#fff' : '#555', fontWeight: filterType === t ? 500 : 400 }}>
            {t === 'all' ? 'All events' : t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>No activity yet.</div>
        ) : filtered.map(a => (
          <div key={a.id} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '0.5px solid #f5f5f3', alignItems: 'flex-start' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS[a.activity_type] || '#888', marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#111' }}>
                {profile?.role !== 'sdr' && (
                  <strong>{a.org_hierarchy?.full_name || 'Unknown'} </strong>
                )}
                <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: (TYPE_COLORS[a.activity_type] || '#888') + '20', color: TYPE_COLORS[a.activity_type] || '#555' }}>
                  {a.activity_type.replace(/_/g, ' ')}
                </span>
                {a.contacts?.full_name && (
                  <span style={{ fontSize: 13, color: '#555', marginLeft: 6 }}>→ {a.contacts.full_name}{a.contacts.company ? ` @ ${a.contacts.company}` : ''}</span>
                )}
              </div>
              {a.details && Object.keys(a.details).length > 0 && (
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>
                  {Object.entries(a.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#ccc', marginTop: 2 }}>{new Date(a.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
