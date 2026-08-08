import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const STAGE_COLORS = {
  Fresh: { bg: '#e0f2fe', color: '#0369a1' },
  F1:    { bg: '#f0fdf4', color: '#166534' },
  F2:    { bg: '#dcfce7', color: '#15803d' },
  F3:    { bg: '#fef9c3', color: '#854d0e' },
  F4:    { bg: '#ffedd5', color: '#9a3412' },
  F5:    { bg: '#fee2e2', color: '#991b1b' },
};

// What to send next given current stage
const NEXT_STAGE = { Fresh: 'F1', F1: 'F2', F2: 'F3', F3: 'F4', F4: 'F5', F5: null };
const NEXT_LABEL = { Fresh: 'Send F1 (initial)', F1: 'Send F2', F2: 'Send F3', F3: 'Send F4', F4: 'Send F5', F5: 'Break-up sent' };

export default function FollowUps() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(null);
  const [snoozingId, setSnoozingId] = useState(null);

  useEffect(() => { fetchFollowUps(); }, []);

  async function fetchFollowUps() {
    setLoading(true);
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('owner_id', user.id)
      .eq('bounced', false)
      .neq('status', 'bounced')
      .neq('status', 'won')
      .neq('status', 'lost')
      .neq('status', 'unsubscribed')
      .order('next_followup', { ascending: true, nullsFirst: false });
    setContacts(data || []);
    setLoading(false);
  }

  async function advanceStage(contact) {
    const next = NEXT_STAGE[contact.status];
    if (!next) return;
    setAdvancing(contact.id);
    const stepMap = { F1: 1, F2: 2, F3: 3, F4: 4, F5: 5 };
    const daysMap = { F1: 3, F2: 4, F3: 5, F4: 7, F5: 10 };
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + (daysMap[next] || 3));
    await supabase.from('contacts').update({
      status: next,
      sequence_step: stepMap[next] || 1,
      last_contacted: new Date().toISOString(),
      next_followup: nextDate.toISOString(),
    }).eq('id', contact.id);
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: contact.id,
      activity_type: 'stage_advanced', details: { from: contact.status, to: next }
    });
    setAdvancing(null);
    fetchFollowUps();
  }

  async function snooze(id, days) {
    setSnoozingId(id);
    const d = new Date();
    d.setDate(d.getDate() + days);
    await supabase.from('contacts').update({ next_followup: d.toISOString() }).eq('id', id);
    setSnoozingId(null);
    fetchFollowUps();
  }

  const now = new Date();

  // Group contacts
  const fresh = contacts.filter(c => c.status === 'Fresh');
  const withFollowup = contacts.filter(c => c.status !== 'Fresh' && c.next_followup);
  const noDate = contacts.filter(c => c.status !== 'Fresh' && !c.next_followup);

  const overdue = withFollowup.filter(c => new Date(c.next_followup) < now);
  const dueToday = withFollowup.filter(c => {
    const d = new Date(c.next_followup);
    return d >= now && d.toDateString() === now.toDateString();
  });
  const thisWeek = withFollowup.filter(c => {
    const d = new Date(c.next_followup);
    const week = new Date(now); week.setDate(now.getDate() + 7);
    return d > now && d.toDateString() !== now.toDateString() && d <= week;
  });
  const later = withFollowup.filter(c => {
    const d = new Date(c.next_followup);
    const week = new Date(now); week.setDate(now.getDate() + 7);
    return d > week;
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Follow-up queue</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>
          {overdue.length} overdue · {dueToday.length} due today · {fresh.length} fresh leads · bounced excluded
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>Loading…</div>
      ) : contacts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>All caught up!</div>
        </div>
      ) : (
        <>
          {overdue.length > 0 && (
            <Section title={`🔴 Overdue (${overdue.length})`} contacts={overdue}
              onAdvance={advanceStage} onSnooze={snooze}
              advancing={advancing} snoozingId={snoozingId} navigate={navigate}
              headerColor="#dc2626" />
          )}
          {dueToday.length > 0 && (
            <Section title={`🟢 Due today (${dueToday.length})`} contacts={dueToday}
              onAdvance={advanceStage} onSnooze={snooze}
              advancing={advancing} snoozingId={snoozingId} navigate={navigate}
              headerColor="#059669" />
          )}
          {thisWeek.length > 0 && (
            <Section title={`🟡 This week (${thisWeek.length})`} contacts={thisWeek}
              onAdvance={advanceStage} onSnooze={snooze}
              advancing={advancing} snoozingId={snoozingId} navigate={navigate}
              headerColor="#d97706" />
          )}
          {fresh.length > 0 && (
            <Section title={`🆕 Fresh leads (${fresh.length})`} contacts={fresh}
              onAdvance={advanceStage} onSnooze={snooze}
              advancing={advancing} snoozingId={snoozingId} navigate={navigate}
              headerColor="#2563eb" />
          )}
          {noDate.length > 0 && (
            <Section title={`⏳ No date set (${noDate.length})`} contacts={noDate}
              onAdvance={advanceStage} onSnooze={snooze}
              advancing={advancing} snoozingId={snoozingId} navigate={navigate}
              headerColor="#94a3b8" />
          )}
          {later.length > 0 && (
            <Section title={`📅 Later (${later.length})`} contacts={later}
              onAdvance={advanceStage} onSnooze={snooze}
              advancing={advancing} snoozingId={snoozingId} navigate={navigate}
              headerColor="#94a3b8" />
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, contacts, onAdvance, onSnooze, advancing, snoozingId, navigate, headerColor }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: headerColor, marginBottom: 10,
        padding: '6px 12px', background: headerColor + '12', borderRadius: 8, display: 'inline-block' }}>
        {title}
      </div>
      <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, overflow: 'hidden' }}>
        {contacts.map((c, i) => {
          const sc = STAGE_COLORS[c.status] || { bg: '#f1f5f9', color: '#475569' };
          const next = NEXT_STAGE[c.status];
          const isLast = i === contacts.length - 1;
          const dueDate = c.next_followup ? new Date(c.next_followup) : null;
          const isOverdue = dueDate && dueDate < new Date();
          return (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderBottom: isLast ? 'none' : '0.5px solid #f0f0ee',
            }}>
              {/* Avatar */}
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e8f0fe',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#2563eb', flexShrink: 0, cursor: 'pointer' }}
                onClick={() => navigate(`/contacts/${c.id}`)}>
                {(c.full_name || '?')[0].toUpperCase()}
              </div>

              {/* Name + company */}
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/contacts/${c.id}`)}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.full_name}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>{c.company}</div>
              </div>

              {/* Stage badge */}
              <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                background: sc.bg, color: sc.color, flexShrink: 0 }}>
                {c.status}
              </span>

              {/* Due date */}
              <div style={{ fontSize: 12, color: isOverdue ? '#dc2626' : '#888', flexShrink: 0, width: 90, textAlign: 'right' }}>
                {dueDate ? (isOverdue ? `⚠ ${dueDate.toLocaleDateString()}` : dueDate.toLocaleDateString()) : '—'}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {next && (
                  <button onClick={() => onAdvance(c)} disabled={advancing === c.id}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6,
                      border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
                    {advancing === c.id ? '…' : NEXT_LABEL[c.status]}
                  </button>
                )}
                <div style={{ position: 'relative' }}>
                  <select
                    disabled={snoozingId === c.id}
                    onChange={e => { if (e.target.value) onSnooze(c.id, Number(e.target.value)); e.target.value = ''; }}
                    style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6,
                      border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer' }}>
                    <option value="">Snooze…</option>
                    <option value="1">Tomorrow</option>
                    <option value="3">3 days</option>
                    <option value="7">1 week</option>
                    <option value="14">2 weeks</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
