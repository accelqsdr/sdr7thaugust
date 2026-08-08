import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const STAGES = ['Fresh','F1','F2','F3','F4','F5'];
const OUTCOMES = ['won','lost'];

const STAGE_META = {
  Fresh: { color: '#3b82f6', bg: '#e0f2fe', label: 'Fresh leads', desc: 'Not yet contacted' },
  F1:    { color: '#10b981', bg: '#f0fdf4', label: 'F1 — First email', desc: 'Initial outreach sent' },
  F2:    { color: '#059669', bg: '#dcfce7', label: 'F2 — Follow-up 1', desc: 'Second touch sent' },
  F3:    { color: '#f59e0b', bg: '#fef9c3', label: 'F3 — Follow-up 2', desc: 'Third touch sent' },
  F4:    { color: '#ef4444', bg: '#ffedd5', label: 'F4 — Follow-up 3', desc: 'Fourth touch sent' },
  F5:    { color: '#dc2626', bg: '#fee2e2', label: 'F5 — Breakup', desc: 'Final email sent' },
  won:   { color: '#22c55e', bg: '#d1fae5', label: 'Won', desc: 'Demo booked / closed' },
  lost:  { color: '#94a3b8', bg: '#f1f5f9', label: 'Lost', desc: 'Not moving forward' },
};

const RESPONSE_LABELS = {
  warm: '🟡 Warm', prospect: '🟢 Prospect', cold: '🔵 Cold',
  negative: '🔴 Negative', bounce: '⛔ Bounce', not_interested: '⬜ Not interested',
};

export default function Pipeline() {
  const { user, profile } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('funnel'); // 'funnel' | 'response'

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
  [...STAGES, ...OUTCOMES].forEach(s => { byStage[s] = contacts.filter(c => c.status === s); });
  const total = contacts.length;

  // Response breakdown from F1-F5 contacts
  const responded = contacts.filter(c => c.response);
  const byResponse = {};
  Object.keys(RESPONSE_LABELS).forEach(r => { byResponse[r] = responded.filter(c => c.response === r).length; });

  const conversionRate = total > 0 ? ((byStage.won?.length || 0) / total * 100).toFixed(1) : 0;
  const responseRate = total > 0 ? (responded.length / total * 100).toFixed(1) : 0;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Pipeline</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>
            {total} active contacts · {conversionRate}% conversion · {responseRate}% response rate
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#f0f0ee', padding: 4, borderRadius: 8 }}>
          {['funnel','response'].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer',
                background: view === v ? '#fff' : 'transparent', color: view === v ? '#111' : '#666', fontWeight: view === v ? 500 : 400 }}>
              {v === 'funnel' ? 'Funnel' : 'Responses'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>Loading…</div>
      ) : view === 'funnel' ? (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total active', value: total, color: '#2563eb' },
              { label: 'Responded', value: responded.length, color: '#059669' },
              { label: 'Won', value: byStage.won?.length || 0, color: '#22c55e' },
              { label: 'Lost', value: byStage.lost?.length || 0, color: '#94a3b8' },
            ].map(m => (
              <div key={m.label} style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Funnel bars — outreach stages */}
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 16 }}>Outreach funnel</div>
            {STAGES.map(s => {
              const m = STAGE_META[s];
              const count = byStage[s]?.length || 0;
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={s} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{m.label}</span>
                      <span style={{ fontSize: 11, color: '#aaa', marginLeft: 8 }}>{m.desc}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      {count} <span style={{ color: '#aaa', fontWeight: 400 }}>({pct}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 8, background: '#f0f0ee', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: m.color, borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Outcome cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {OUTCOMES.map(s => {
              const m = STAGE_META[s];
              return (
                <div key={s} style={{ background: m.bg, border: `1px solid ${m.color}30`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: m.color, marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: m.color }}>{byStage[s]?.length || 0}</div>
                  <div style={{ fontSize: 11, color: m.color + 'aa', marginTop: 2 }}>{m.desc}</div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Response breakdown */
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>Response breakdown</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>
            {responded.length} contacts have a response logged ({total - responded.length} no response yet)
          </div>
          {Object.entries(RESPONSE_LABELS).map(([r, label]) => {
            const count = byResponse[r] || 0;
            const pct = responded.length ? Math.round((count / responded.length) * 100) : 0;
            return (
              <div key={r} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#555' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{count} <span style={{ color: '#aaa' }}>({pct}%)</span></span>
                </div>
                <div style={{ height: 8, background: '#f0f0ee', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#2563eb', borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
