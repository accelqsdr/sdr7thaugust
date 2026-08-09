import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ── constants ─────────────────────────────────────────────────────────────────

const FOLLOWUP_STAGES = ['F1','F2','F3','F4','F5'];

const STAGE_COLORS = {
  F1: { bg: '#dbeafe', color: '#1d4ed8' },
  F2: { bg: '#d1fae5', color: '#065f46' },
  F3: { bg: '#fef9c3', color: '#854d0e' },
  F4: { bg: '#ffedd5', color: '#9a3412' },
  F5: { bg: '#fee2e2', color: '#991b1b' },
};

const STAGE_LABELS = {
  F1: 'F1 — Initial',
  F2: 'F2 — Follow-up 1',
  F3: 'F3 — Follow-up 2',
  F4: 'F4 — Follow-up 3',
  F5: 'F5 — Break-up',
};

const NEXT_STAGE = { F1:'F2', F2:'F3', F3:'F4', F4:'F5', F5:null };
const ADVANCE_DAYS = { F2:3, F3:4, F4:5, F5:7 };

const RESPONSE_COLORS = {
  warm:           { bg: '#fef3c7', color: '#d97706', label: '🟡 Warm' },
  prospect:       { bg: '#d1fae5', color: '#059669', label: '🟢 Prospect' },
  cold:           { bg: '#e0f2fe', color: '#0369a1', label: '🔵 Cold' },
  negative:       { bg: '#fee2e2', color: '#dc2626', label: '🔴 Negative' },
  not_interested: { bg: '#f1f5f9', color: '#475569', label: '⬜ Not interested' },
};

const TIMING_OPTIONS = [
  { key: 'all',      label: 'All' },
  { key: 'overdue',  label: '🔴 Overdue' },
  { key: 'today',    label: '🟢 Today' },
  { key: 'week',     label: '🟡 This week' },
  { key: 'later',    label: '📅 Later' },
  { key: 'nodate',   label: '⏳ No date' },
];

function getInitials(name) {
  return (name || '').split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase() || '?';
}

const AVATAR_COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#0891b2','#9333ea','#dc2626'];
function avatarColor(str) {
  let h = 0;
  for (let i = 0; i < (str||'').length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function timingBucket(nextFollowup) {
  if (!nextFollowup) return 'nodate';
  const now = new Date();
  const d = new Date(nextFollowup);
  if (d < now) return 'overdue';
  const todayEnd = new Date(now); todayEnd.setHours(23,59,59,999);
  if (d <= todayEnd) return 'today';
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
  if (d <= weekEnd) return 'week';
  return 'later';
}

// ── main component ─────────────────────────────────────────────────────────────

export default function FollowUps() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState({});  // id → account row
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch]         = useState('');
  const [stageFilter, setStageFilter]   = useState('all');
  const [timingFilter, setTimingFilter] = useState('all');
  const [responseFilter, setResponseFilter] = useState('all');
  const [companyFilter, setCompanyFilter]   = useState('all');

  // Actions
  const [advancing, setAdvancing]   = useState(null);
  const [snoozingId, setSnoozingId] = useState(null);

  // Email draft panel — keyed by contact.id
  const [draftOpen, setDraftOpen]   = useState(null);   // contact id with open panel
  const [drafts, setDrafts]         = useState({});     // id → { subject, body }
  const [drafting, setDrafting]     = useState(null);   // id generating
  const [copied, setCopied]         = useState(null);   // id just copied

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [contactRes, accountRes] = await Promise.all([
      supabase
        .from('contacts')
        .select('*')
        .eq('owner_id', user.id)
        .in('status', FOLLOWUP_STAGES)          // F1-F5 only — no Fresh
        .neq('status', 'bounced')
        .neq('status', 'unsubscribed')
        .order('next_followup', { ascending: true, nullsFirst: false }),
      supabase
        .from('accounts')
        .select('id, name, industry, research')
        .eq('owner_id', user.id),
    ]);
    setContacts(contactRes.data || []);
    const accMap = {};
    (accountRes.data || []).forEach(a => { accMap[a.id] = a; });
    setAccounts(accMap);
    setLoading(false);
  }

  async function advanceStage(contact) {
    const next = NEXT_STAGE[contact.status];
    if (!next) return;
    setAdvancing(contact.id);
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + (ADVANCE_DAYS[next] || 3));
    await supabase.from('contacts').update({
      status: next,
      sequence_step: FOLLOWUP_STAGES.indexOf(next) + 1,
      last_contacted: new Date().toISOString(),
      next_followup: nextDate.toISOString(),
    }).eq('id', contact.id);
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: contact.id,
      activity_type: 'stage_advanced', details: { from: contact.status, to: next }
    });
    setAdvancing(null);
    fetchData();
  }

  async function snooze(id, days) {
    setSnoozingId(id);
    const d = new Date();
    d.setDate(d.getDate() + days);
    await supabase.from('contacts').update({ next_followup: d.toISOString() }).eq('id', id);
    setSnoozingId(null);
    fetchData();
  }

  async function generateEmail(contact) {
    setDrafting(contact.id);
    setDraftOpen(contact.id);
    const account = accounts[contact.account_id] || {};
    const research = account.research || {};
    const senderName = profile?.full_name || user?.email?.split('@')[0] || 'Your SDR';
    try {
      const result = await supabase.functions.invoke('generate-email', {
        body: {
          contact: {
            full_name: contact.full_name,
            title: contact.title,
            company: contact.company,
            email: contact.email,
            response: contact.response,
            pitch: contact.pitch,
            industry: account.industry,
          },
          stage: contact.status,
          accountResearch: research,
          senderName,
        }
      });
      if (!result.error && result.data?.subject) {
        setDrafts(d => ({ ...d, [contact.id]: { subject: result.data.subject, body: result.data.body } }));
      }
    } catch(e) { console.error(e); }
    setDrafting(null);
  }

  function copyEmail(id) {
    const draft = drafts[id];
    if (!draft) return;
    const text = `Subject: ${draft.subject}\n\n${draft.body}`;
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(c => c === id ? null : c), 2000);
  }

  // ── derive unique companies for filter dropdown ────────────────────────────
  const uniqueCompanies = [...new Set(contacts.map(c => c.company).filter(Boolean))].sort();

  // ── apply filters ──────────────────────────────────────────────────────────
  const filtered = contacts.filter(c => {
    if (stageFilter !== 'all' && c.status !== stageFilter) return false;
    if (timingFilter !== 'all' && timingBucket(c.next_followup) !== timingFilter) return false;
    if (responseFilter !== 'all' && c.response !== responseFilter) return false;
    if (companyFilter !== 'all' && c.company !== companyFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.full_name?.toLowerCase().includes(q) && !c.company?.toLowerCase().includes(q) && !c.email?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ── stats across ALL (unfiltered) ─────────────────────────────────────────
  const now = new Date();
  const overdueCt = contacts.filter(c => c.next_followup && new Date(c.next_followup) < now).length;
  const todayCt   = contacts.filter(c => {
    if (!c.next_followup) return false;
    const d = new Date(c.next_followup);
    return d >= now && d.toDateString() === now.toDateString();
  }).length;
  const stageCounts = {};
  FOLLOWUP_STAGES.forEach(s => { stageCounts[s] = contacts.filter(c => c.status === s).length; });

  // ── group filtered contacts by timing ─────────────────────────────────────
  const groups = [
    { key: 'overdue', label: '🔴 Overdue', color: '#dc2626', items: filtered.filter(c => timingBucket(c.next_followup) === 'overdue') },
    { key: 'today',   label: '🟢 Due today', color: '#059669', items: filtered.filter(c => timingBucket(c.next_followup) === 'today') },
    { key: 'week',    label: '🟡 This week', color: '#d97706', items: filtered.filter(c => timingBucket(c.next_followup) === 'week') },
    { key: 'later',   label: '📅 Later',     color: '#6b7280', items: filtered.filter(c => timingBucket(c.next_followup) === 'later') },
    { key: 'nodate',  label: '⏳ No date set', color: '#94a3b8', items: filtered.filter(c => timingBucket(c.next_followup) === 'nodate') },
  ].filter(g => g.items.length > 0);

  const activeGroups = timingFilter === 'all' ? groups : groups.filter(g => g.key === timingFilter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f8f9fa' }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>Follow-up Queue</h1>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
              Contacts in active outreach — Fresh leads not shown here
            </p>
          </div>
          <div style={{ flex: 1 }} />
          {/* Stats pills */}
          {overdueCt > 0 && (
            <div onClick={() => setTimingFilter(timingFilter === 'overdue' ? 'all' : 'overdue')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8,
                background: timingFilter === 'overdue' ? '#fee2e2' : '#fff5f5',
                border: `1px solid ${timingFilter === 'overdue' ? '#dc2626' : '#fca5a5'}`,
                color: '#dc2626', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
              🔴 {overdueCt} overdue
            </div>
          )}
          {todayCt > 0 && (
            <div onClick={() => setTimingFilter(timingFilter === 'today' ? 'all' : 'today')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8,
                background: timingFilter === 'today' ? '#d1fae5' : '#f0fdf4',
                border: `1px solid ${timingFilter === 'today' ? '#059669' : '#6ee7b7'}`,
                color: '#059669', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
              🟢 {todayCt} due today
            </div>
          )}
          <div style={{ fontSize: 12, color: '#6b7280', background: '#f9fafb', padding: '5px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            {contacts.length} in queue
          </div>
        </div>

        {/* ── FILTER ROW ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9ca3af' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, company…"
              style={{ paddingLeft: 30, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, width: 180, outline: 'none', background: '#f9fafb' }} />
          </div>

          {/* Stage filter */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>Stage:</span>
            {['all', ...FOLLOWUP_STAGES].map(s => (
              <button key={s} onClick={() => setStageFilter(s)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: stageFilter === s ? (STAGE_COLORS[s]?.bg || '#2563eb22') : '#f3f4f6',
                color: stageFilter === s ? (STAGE_COLORS[s]?.color || '#2563eb') : '#6b7280',
              }}>
                {s === 'all' ? 'All' : `${s} ${stageCounts[s] ? `(${stageCounts[s]})` : ''}`}
              </button>
            ))}
          </div>

          {/* Timing filter */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>Due:</span>
            {TIMING_OPTIONS.filter(t => t.key !== 'all').map(t => (
              <button key={t.key} onClick={() => setTimingFilter(timingFilter === t.key ? 'all' : t.key)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: timingFilter === t.key ? '#dbeafe' : '#f3f4f6',
                color: timingFilter === t.key ? '#1d4ed8' : '#6b7280',
              }}>{t.label}</button>
            ))}
          </div>

          {/* Response filter */}
          <select value={responseFilter} onChange={e => setResponseFilter(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, background: '#f9fafb', color: '#374151', cursor: 'pointer' }}>
            <option value="all">All responses</option>
            {Object.entries(RESPONSE_COLORS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          {/* Company filter */}
          {uniqueCompanies.length > 1 && (
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
              style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, background: '#f9fafb', color: '#374151', cursor: 'pointer', maxWidth: 180 }}>
              <option value="all">All companies</option>
              {uniqueCompanies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {/* Clear filters */}
          {(search || stageFilter !== 'all' || timingFilter !== 'all' || responseFilter !== 'all' || companyFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setStageFilter('all'); setTimingFilter('all'); setResponseFilter('all'); setCompanyFilter('all'); }}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, color: '#6b7280', background: '#f3f4f6', border: 'none', cursor: 'pointer' }}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>Loading queue…
          </div>
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>Queue is empty!</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Move contacts from Fresh → F1 in the Accounts page to start outreach</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
            <div style={{ fontSize: 14, color: '#374151' }}>No contacts match these filters</div>
            <button onClick={() => { setSearch(''); setStageFilter('all'); setTimingFilter('all'); setResponseFilter('all'); setCompanyFilter('all'); }}
              style={{ marginTop: 14, padding: '8px 18px', background: '#2563eb', color: '#fff', borderRadius: 8, border: 'none', fontSize: 13, cursor: 'pointer' }}>
              Clear filters
            </button>
          </div>
        ) : (
          activeGroups.map(group => (
            <div key={group.key} style={{ marginBottom: 28 }}>
              {/* Group header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: group.color,
                  padding: '4px 12px', background: group.color + '15', borderRadius: 20 }}>
                  {group.label} · {group.items.length}
                </span>
                <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
              </div>

              {/* Contact rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.items.map(c => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    account={accounts[c.account_id]}
                    advancing={advancing === c.id}
                    snoozingId={snoozingId === c.id}
                    draftOpen={draftOpen === c.id}
                    draft={drafts[c.id]}
                    drafting={drafting === c.id}
                    copied={copied === c.id}
                    onAdvance={() => advanceStage(c)}
                    onSnooze={(days) => snooze(c.id, days)}
                    onDraft={() => generateEmail(c)}
                    onToggleDraft={() => setDraftOpen(d => d === c.id ? null : c.id)}
                    onCopy={() => copyEmail(c.id)}
                    onViewContact={() => navigate(`/contacts/${c.id}`)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── ContactRow component ───────────────────────────────────────────────────────

function ContactRow({ contact: c, account, advancing, snoozingId, draftOpen, draft, drafting, copied, onAdvance, onSnooze, onDraft, onToggleDraft, onCopy, onViewContact }) {
  const sc = STAGE_COLORS[c.status] || { bg: '#f1f5f9', color: '#475569' };
  const rc = c.response ? RESPONSE_COLORS[c.response] : null;
  const next = NEXT_STAGE[c.status];
  const ac = avatarColor(c.full_name);
  const dueDate = c.next_followup ? new Date(c.next_followup) : null;
  const isOverdue = dueDate && dueDate < new Date();
  const hasDraft = !!draft;

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', transition: 'box-shadow 0.15s' }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>

        {/* Avatar */}
        <div onClick={onViewContact} style={{ width: 38, height: 38, borderRadius: '50%', background: ac, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
          flexShrink: 0, cursor: 'pointer', userSelect: 'none' }}>
          {getInitials(c.full_name)}
        </div>

        {/* Name + company */}
        <div style={{ flex: '0 0 220px', minWidth: 0, cursor: 'pointer' }} onClick={onViewContact}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.full_name}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.title ? `${c.title} · ` : ''}{c.company || '—'}
          </div>
        </div>

        {/* Stage */}
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: sc.bg, color: sc.color, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {STAGE_LABELS[c.status] || c.status}
        </span>

        {/* Response badge */}
        {rc ? (
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: rc.bg, color: rc.color, fontWeight: 500, flexShrink: 0 }}>
            {rc.label}
          </span>
        ) : <span style={{ width: 60, flexShrink: 0 }} />}

        {/* Account */}
        {account && (
          <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            🏢 {account.name}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Due date */}
        <div style={{ fontSize: 11, fontWeight: 500, color: isOverdue ? '#dc2626' : dueDate ? '#6b7280' : '#d1d5db',
          flexShrink: 0, width: 80, textAlign: 'right' }}>
          {dueDate ? (isOverdue ? `⚠ ${dueDate.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}` : dueDate.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})) : 'No date'}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {/* Draft email */}
          <button onClick={hasDraft ? onToggleDraft : onDraft} disabled={drafting}
            style={{ padding: '5px 11px', borderRadius: 7, fontSize: 11, fontWeight: 600, border: 'none', cursor: drafting ? 'wait' : 'pointer',
              background: hasDraft ? (draftOpen ? '#ede9fe' : '#f3e8ff') : 'linear-gradient(135deg,#7c3aed,#2563eb)',
              color: hasDraft ? '#7c3aed' : '#fff' }}>
            {drafting ? '⏳' : hasDraft ? (draftOpen ? '✉️ Hide' : '✉️ Email') : '✨ Draft Email'}
          </button>

          {/* Advance stage */}
          {next && (
            <button onClick={onAdvance} disabled={advancing}
              style={{ padding: '5px 11px', borderRadius: 7, fontSize: 11, fontWeight: 600, border: 'none',
                background: '#2563eb', color: '#fff', cursor: advancing ? 'wait' : 'pointer' }}>
              {advancing ? '…' : `→ ${next}`}
            </button>
          )}

          {/* Snooze */}
          <select disabled={snoozingId}
            onChange={e => { if (e.target.value) onSnooze(Number(e.target.value)); e.target.value = ''; }}
            style={{ padding: '5px 7px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 11, background: '#f9fafb', cursor: 'pointer', color: '#374151' }}>
            <option value="">Snooze…</option>
            <option value="1">Tomorrow</option>
            <option value="3">3 days</option>
            <option value="7">1 week</option>
            <option value="14">2 weeks</option>
          </select>

          {/* View contact */}
          <button onClick={onViewContact}
            style={{ padding: '5px 9px', borderRadius: 7, fontSize: 11, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer' }}>
            →
          </button>
        </div>
      </div>

      {/* Email draft panel */}
      {draftOpen && (
        <div style={{ borderTop: '1px solid #f0f0ee', background: '#fafaf9', padding: '16px 18px' }}>
          {drafting ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#7c3aed', fontSize: 13 }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>✨</div>
              Generating {STAGE_LABELS[c.status]} email…
            </div>
          ) : draft ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', flex: 1 }}>
                  ✉️ {STAGE_LABELS[c.status]} — AI Draft
                </div>
                <button onClick={onDraft} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#7c3aed', cursor: 'pointer', fontWeight: 500 }}>
                  ↻ Regenerate
                </button>
                <button onClick={onCopy} style={{ fontSize: 11, padding: '3px 12px', borderRadius: 6, border: 'none', background: copied ? '#059669' : '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }}>
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
              {/* Subject */}
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginTop: 3, padding: '7px 10px', background: '#fff', borderRadius: 7, border: '1px solid #e5e7eb' }}>
                  {draft.subject}
                </div>
              </div>
              {/* Body */}
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Body</span>
                <div style={{ fontSize: 12, lineHeight: 1.75, color: '#374151', marginTop: 4, padding: '10px 12px', background: '#fff', borderRadius: 7, border: '1px solid #e5e7eb', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                  {draft.body}
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af' }}>
                AI draft — review and personalise before sending
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
