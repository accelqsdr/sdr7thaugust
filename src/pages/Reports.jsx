import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function Reports() {
  const { user, profile } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let q1 = supabase.from('contacts').select('*');
      let q2 = supabase.from('activity_log').select('*, org_hierarchy!actor_id(full_name,role)').order('created_at', { ascending: false }).limit(200);

      if (profile?.role === 'sdr') {
        q1 = q1.eq('owner_id', user.id);
        q2 = q2.eq('actor_id', user.id);
      } else {
        const { data: subs } = await supabase.rpc('get_subordinate_ids', { manager_user_id: user.id });
        const ids = (subs || []).map(s => s.user_id);
        if (ids.length) { q1 = q1.in('owner_id', ids); q2 = q2.in('actor_id', ids); }
        else { q1 = q1.eq('owner_id', user.id); q2 = q2.eq('actor_id', user.id); }
      }

      const [{ data: c }, { data: a }] = await Promise.all([q1, q2]);
      setContacts(c || []);
      setActivity(a || []);
      setLoading(false);
    }
    load();
  }, [user.id, profile?.role]);

  function downloadCSV(data, filename) {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(','), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const active = contacts.filter(c => !c.bounced);
  const byStatus = {};
  ['fresh','contacted','replied','meeting','won','lost','bounced'].forEach(s => {
    byStatus[s] = contacts.filter(c => c.status === s).length;
  });
  const activityByType = {};
  activity.forEach(a => { activityByType[a.activity_type] = (activityByType[a.activity_type] || 0) + 1; });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Reports</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>Export and summary reports for your scope</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Contact summary */}
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Contact report</div>
              <button onClick={() => downloadCSV(contacts, 'contacts_report.csv')}
                style={{ padding: '7px 14px', background: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#2563eb', fontWeight: 500 }}>
                ↓ Download CSV
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                { label: 'Total contacts', value: contacts.length },
                { label: 'Active', value: active.length, color: '#059669' },
                { label: 'Bounced (excluded)', value: byStatus.bounced || 0, color: '#dc2626' },
                { label: 'Won', value: byStatus.won || 0, color: '#16a34a' },
              ].map(m => (
                <div key={m.label} style={{ background: '#f8f9fa', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: m.color || '#111' }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(byStatus).map(([s, n]) => (
                <span key={s} style={{ fontSize: 12, color: '#555', background: '#f0f0ee', padding: '3px 10px', borderRadius: 10 }}>
                  {s}: <strong>{n}</strong>
                </span>
              ))}
            </div>
          </div>

          {/* Activity summary */}
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Activity report</div>
              <button onClick={() => downloadCSV(activity, 'activity_report.csv')}
                style={{ padding: '7px 14px', background: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#2563eb', fontWeight: 500 }}>
                ↓ Download CSV
              </button>
            </div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>Total logged events: <strong>{activity.length}</strong></div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(activityByType).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                <div key={t} style={{ background: '#f8f9fa', border: '0.5px solid #e8e8e4', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
                  <div style={{ color: '#888' }}>{t.replace(/_/g, ' ')}</div>
                  <div style={{ fontWeight: 600, fontSize: 16, color: '#111', marginTop: 2 }}>{n}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
