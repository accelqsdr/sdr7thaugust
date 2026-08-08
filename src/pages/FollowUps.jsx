import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function FollowUps() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchFollowUps(); }, []);

  async function fetchFollowUps() {
    setLoading(true);
    // Strictly exclude bounced contacts
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('owner_id', user.id)
      .eq('bounced', false)
      .neq('status', 'bounced')
      .neq('status', 'won')
      .neq('status', 'lost')
      .neq('status', 'unsubscribed')
      .not('next_followup', 'is', null)
      .order('next_followup', { ascending: true });
    setContacts(data || []);
    setLoading(false);
  }

  async function markDone(id) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 3);
    await supabase.from('contacts').update({
      last_contacted: new Date().toISOString(),
      next_followup: nextDate.toISOString(),
      status: 'contacted',
    }).eq('id', id);
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: id, activity_type: 'followup_done', details: {}
    });
    fetchFollowUps();
  }

  async function snooze(id, days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    await supabase.from('contacts').update({ next_followup: d.toISOString() }).eq('id', id);
    fetchFollowUps();
  }

  const now = new Date();
  const overdue = contacts.filter(c => new Date(c.next_followup) < now);
  const upcoming = contacts.filter(c => new Date(c.next_followup) >= now);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Follow-up queue</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>
          Bounced contacts are automatically excluded · {overdue.length} overdue · {upcoming.length} upcoming
        </p>
      </div>

      {/* Info banner */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534', marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>✓</span> Contacts marked as <strong>bounced</strong> are never shown here and will not receive follow-up emails.
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>Loading…</div>
      ) : contacts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 500, color: '#555' }}>All caught up!</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>No follow-ups due right now.</div>
        </div>
      ) : (
        <>
          {overdue.length > 0 && (
            <Section title="Overdue" count={overdue.length} color="#dc2626" contacts={overdue} onDone={markDone} onSnooze={snooze} />
          )}
          {upcoming.length > 0 && (
            <Section title="Upcoming" count={upcoming.length} color="#2563eb" contacts={upcoming} onDone={markDone} onSnooze={snooze} />
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, count, color, contacts, onDone, onSnooze }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{title}</span>
        <span style={{ fontSize: 11, background: color + '20', color, padding: '2px 8px', borderRadius: 10 }}>{count}</span>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', overflow: 'hidden' }}>
        {contacts.map((c, i) => {
          const due = new Date(c.next_followup);
          const isOverdue = due < new Date();
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: i < contacts.length - 1 ? '0.5px solid #f0f0ee' : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#2563eb', flexShrink: 0 }}>
                {(c.full_name || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{c.full_name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{c.company} · {c.email}</div>
              </div>
              <div style={{ textAlign: 'right', marginRight: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: isOverdue ? '#dc2626' : '#555' }}>
                  {isOverdue ? 'Overdue' : 'Due'} {due.toLocaleDateString()}
                </div>
                <div style={{ fontSize: 11, color: '#bbb' }}>Step {c.sequence_step || 1}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onDone(c.id)}
                  style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                  Mark done
                </button>
                <select onChange={e => { if (e.target.value) onSnooze(c.id, +e.target.value); e.target.value = ''; }}
                  style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 12, color: '#555', cursor: 'pointer' }}>
                  <option value="">Snooze…</option>
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">1 week</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
