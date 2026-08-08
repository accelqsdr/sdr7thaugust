import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const STAGES = ['fresh','contacted','replied','meeting','won','lost'];
const COLORS = { fresh:'#3b82f6', contacted:'#10b981', replied:'#f59e0b', meeting:'#8b5cf6', won:'#22c55e', lost:'#94a3b8' };
const STAGE_LABELS = { fresh:'Fresh leads', contacted:'Contacted', replied:'Replied', meeting:'Meeting booked', won:'Won', lost:'Lost' };

export default function Pipeline() {
  const { user, profile } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let q = supabase.from('contacts').select('*').eq('bounced', false).neq('status', 'bounced').neq('status', 'unsubscribed');
      if (profile?.role === 'sdr') {
        q = q.eq('owner_id', user.id);
      } else {
        const { data: subs } = await supabase.rpc('get_subordinate_ids', { manager_user_id: user.id });
        const ids = (subs || []).map(s => s.user_id);
        if (ids.length) q = q.in('owner_id', ids);
        else q = q.eq('owner_id', user.id);
      }
      const { data } = await q;
      setContacts(data || []);
      setLoading(false);
    }
    load();
  }, [user.id, profile?.role]);

  const byStage = {};
  STAGES.forEach(s => { byStage[s] = contacts.filter(c => c.status === s); });
  const total = contacts.length;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Pipeline</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>{total} active contacts · bounced excluded</p>
      </div>

      {/* Funnel bars */}
      <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 16 }}>Funnel overview</div>
        {STAGES.map(s => {
          const count = byStage[s].length;
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <div key={s} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#555' }}>{STAGE_LABELS[s]}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{count} <span style={{ color: '#aaa', fontWeight: 400 }}>({pct}%)</span></span>
              </div>
              <div style={{ height: 8, background: '#f0f0ee', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: COLORS[s], borderRadius: 4, transition: 'width 0.4s' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Kanban columns */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {STAGES.filter(s => !['lost'].includes(s)).map(s => (
            <div key={s} style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #e8e8e4', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[s] }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{STAGE_LABELS[s]}</span>
                <span style={{ fontSize: 11, background: '#f0f0ee', color: '#666', padding: '1px 7px', borderRadius: 10, marginLeft: 'auto' }}>{byStage[s].length}</span>
              </div>
              <div style={{ padding: 8, maxHeight: 320, overflowY: 'auto' }}>
                {byStage[s].length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#ccc', fontSize: 12 }}>Empty</div>
                ) : byStage[s].map(c => (
                  <div key={c.id} style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{c.full_name}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{c.company}</div>
                    {c.next_followup && (
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                        Follow-up: {new Date(c.next_followup).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
