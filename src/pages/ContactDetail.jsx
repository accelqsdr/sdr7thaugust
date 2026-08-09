import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const STAGES = ['Fresh','F1','F2','F3','F4','F5'];
const OUTCOMES = ['won','lost','bounced','unsubscribed'];
const ALL_STATUSES = [...STAGES, ...OUTCOMES];

const STAGE_COLORS = {
  Fresh:        { bg: '#e0f2fe', color: '#0369a1' },
  F1:           { bg: '#f0fdf4', color: '#166534' },
  F2:           { bg: '#dcfce7', color: '#15803d' },
  F3:           { bg: '#fef9c3', color: '#854d0e' },
  F4:           { bg: '#ffedd5', color: '#9a3412' },
  F5:           { bg: '#fee2e2', color: '#991b1b' },
  won:          { bg: '#d1fae5', color: '#065f46' },
  lost:         { bg: '#f1f5f9', color: '#475569' },
  bounced:      { bg: '#fee2e2', color: '#991b1b' },
  unsubscribed: { bg: '#fef3c7', color: '#92400e' },
};

const RESPONSE_OPTIONS = [
  { value: 'cold',          label: '🔵 Cold',          bg: '#e0f2fe', color: '#0369a1' },
  { value: 'warm',          label: '🟡 Warm',          bg: '#fef9c3', color: '#854d0e' },
  { value: 'prospect',      label: '🟢 Prospect',      bg: '#d1fae5', color: '#065f46' },
  { value: 'negative',      label: '🔴 Negative',      bg: '#fee2e2', color: '#991b1b' },
  { value: 'not_interested',label: '⬜ Not interested', bg: '#f1f5f9', color: '#475569' },
  { value: 'bounce',        label: '⛔ Bounce',        bg: '#fee2e2', color: '#991b1b' },
];

const STEP_MAP = { Fresh: 0, F1: 1, F2: 2, F3: 3, F4: 4, F5: 5 };
const NEXT_STAGE = { Fresh: 'F1', F1: 'F2', F2: 'F3', F3: 'F4', F4: 'F5', F5: null };
const DAYS_UNTIL_NEXT = { F1: 3, F2: 4, F3: 5, F4: 7, F5: 10 };

const RESEARCH_FIELDS = [
  { key: 'whyTarget',    label: 'Why target this account', placeholder: 'Why this company fits ACCELQ ICP…' },
  { key: 'techStack',    label: 'Known tech stack',        placeholder: 'SAP, Selenium, Jenkins, Jira…' },
  { key: 'qaHiring',     label: 'QA hiring activity',      placeholder: 'Hiring 3 SDET roles on LinkedIn…' },
  { key: 'recentNews',   label: 'Recent news',             placeholder: 'Raised $50M Series B in March…' },
  { key: 'painPoints',   label: 'Pain points',             placeholder: 'Manual regression takes 2 weeks per release…' },
  { key: 'openingLine',  label: 'Opening line idea',       placeholder: 'Draft a hook to start the cold email…' },
];

const SIGNAL_FIELDS = [
  { key: 'competitorTools', label: 'Competitor tools detected', icon: '🔍' },
  { key: 'recentFunding',   label: 'Recent funding',           icon: '💰' },
  { key: 'hiringQA',        label: 'Hiring QA engineers',      icon: '👥' },
  { key: 'recentLaunch',    label: 'Recent product launch',     icon: '🚀' },
  { key: 'outage',          label: 'Recent outage / incident',  icon: '⚠️' },
  { key: 'cicd',            label: 'Active CI/CD pipeline',     icon: '⚙️' },
];

const ACTIVITY_LABELS = {
  status_changed:   'Status changed',
  bounce_detected:  'Marked bounced',
  email_sent:       'Email sent',
  reply_logged:     'Reply logged',
  note_added:       'Note added',
  research_updated: 'Research updated',
  signals_updated:  'Signals updated',
  stage_advanced:   'Stage advanced',
  followup_done:    'Follow-up done',
};
const ACTIVITY_ICONS = {
  status_changed: '🔄', bounce_detected: '⛔', email_sent: '✉️',
  reply_logged: '💬', note_added: '📝', research_updated: '🔍',
  signals_updated: '🎯', stage_advanced: '⬆️', followup_done: '✅',
};

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backState = location.state;
  const { user } = useAuth();
  const userId = user.id;

  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  const [research, setResearch] = useState({});
  const [savingResearch, setSavingResearch] = useState(false);
  const [researchSaved, setResearchSaved] = useState(false);

  const [signals, setSignals] = useState({});
  const [savingSignals, setSavingSignals] = useState(false);
  const [signalsSaved, setSignalsSaved] = useState(false);

  const [contactNotes, setContactNotes] = useState([]);
  const [companyNotes, setCompanyNotes] = useState([]);
  const [newContactNote, setNewContactNote] = useState('');
  const [newCompanyNote, setNewCompanyNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [pitch, setPitch] = useState('');
  const [savingPitch, setSavingPitch] = useState(false);
  const [pitchSaved, setPitchSaved] = useState(false);

  const [timeline, setTimeline] = useState([]);
  const [advancing, setAdvancing] = useState(false);
  const [emails, setEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);

  const fetchContact = useCallback(async () => {
    const { data } = await supabase.from('contacts').select('*').eq('id', id).single();
    if (data) {
      setContact(data);
      setResearch(data.research || {});
      setSignals(data.signals || {});
      setPitch(data.notes || '');
    }
    setLoading(false);
  }, [id]);

  const fetchNotes = useCallback(async (companyName) => {
    const [{ data: cn }, { data: co }] = await Promise.all([
      supabase.from('contact_notes').select('*, profiles(full_name)').eq('contact_id', id).order('created_at', { ascending: false }),
      companyName
        ? supabase.from('company_notes').select('*, profiles(full_name)').eq('company_name', companyName).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    setContactNotes(cn || []);
    setCompanyNotes(co || []);
  }, [id]);

  const fetchTimeline = useCallback(async () => {
    const { data } = await supabase.from('activity_log').select('*, profiles(full_name)')
      .eq('contact_id', id).order('created_at', { ascending: false }).limit(50);
    setTimeline(data || []);
  }, [id]);

  const fetchEmails = useCallback(async () => {
    setEmailsLoading(true);
    const { data } = await supabase.from('emails').select('*').eq('contact_id', id).order('sent_at', { ascending: false });
    setEmails(data || []);
    setEmailsLoading(false);
  }, [id]);

  useEffect(() => { fetchContact(); }, [fetchContact]);
  useEffect(() => {
    if (contact) { fetchNotes(contact.company); fetchTimeline(); fetchEmails(); }
  }, [contact?.id]);

  async function updateStatus(status) {
    const update = { status };
    if (STEP_MAP[status] !== undefined) update.sequence_step = STEP_MAP[status];
    await supabase.from('contacts').update(update).eq('id', id);
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: id,
      activity_type: 'status_changed', details: { status }
    });
    setContact(c => ({ ...c, ...update }));
    fetchTimeline();
  }

  async function setResponse(response) {
    const update = { response: response || null };
    await supabase.from('contacts').update(update).eq('id', id);
    setContact(c => ({ ...c, response: response || null }));
  }

  async function advanceStage() {
    const next = NEXT_STAGE[contact.status];
    if (!next) return;
    setAdvancing(true);
    const days = DAYS_UNTIL_NEXT[next] || 3;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + days);
    const update = {
      status: next,
      sequence_step: STEP_MAP[next],
      last_contacted: new Date().toISOString(),
      next_followup: nextDate.toISOString(),
    };
    await supabase.from('contacts').update(update).eq('id', id);
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: id,
      activity_type: 'stage_advanced', details: { from: contact.status, to: next }
    });
    setContact(c => ({ ...c, ...update }));
    setAdvancing(false);
    fetchTimeline();
  }

  async function markBounced() {
    if (!window.confirm('Mark as bounced? They will be excluded from follow-ups.')) return;
    await supabase.from('contacts').update({ status: 'bounced', bounced: true, bounced_at: new Date().toISOString() }).eq('id', id);
    await supabase.from('activity_log').insert({ actor_id: user.id, contact_id: id, activity_type: 'bounce_detected', details: {} });
    setContact(c => ({ ...c, status: 'bounced', bounced: true }));
    fetchTimeline();
  }

  async function saveResearch() {
    setSavingResearch(true);
    await supabase.from('contacts').update({ research }).eq('id', id);
    await supabase.from('activity_log').insert({ actor_id: user.id, contact_id: id, activity_type: 'research_updated', details: {} });
    setSavingResearch(false);
    setResearchSaved(true);
    setTimeout(() => setResearchSaved(false), 2500);
    fetchTimeline();
  }

  async function saveSignals() {
    setSavingSignals(true);
    await supabase.from('contacts').update({ signals }).eq('id', id);
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: id, activity_type: 'signals_updated',
      details: { active: Object.keys(signals).filter(k => signals[k]) }
    });
    setSavingSignals(false);
    setSignalsSaved(true);
    setTimeout(() => setSignalsSaved(false), 2500);
    fetchTimeline();
  }

  async function savePitch() {
    setSavingPitch(true);
    await supabase.from('contacts').update({ notes: pitch }).eq('id', id);
    setContact(c => ({ ...c, notes: pitch }));
    setSavingPitch(false);
    setPitchSaved(true);
    setTimeout(() => setPitchSaved(false), 2500);
  }

  async function addContactNote() {
    if (!newContactNote.trim()) return;
    setSavingNote(true);
    await supabase.from('contact_notes').insert({ contact_id: id, author_id: user.id, body: newContactNote.trim() });
    await supabase.from('activity_log').insert({ actor_id: user.id, contact_id: id, activity_type: 'note_added', details: { type: 'contact' } });
    setNewContactNote('');
    setSavingNote(false);
    fetchNotes(contact?.company);
    fetchTimeline();
  }

  async function addCompanyNote() {
    if (!newCompanyNote.trim() || !contact?.company) return;
    setSavingNote(true);
    await supabase.from('company_notes').insert({ company_name: contact.company, author_id: user.id, body: newCompanyNote.trim() });
    setNewCompanyNote('');
    setSavingNote(false);
    fetchNotes(contact.company);
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#aaa', fontSize: 14 }}>Loading…</div>;
  if (!contact) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
      <div style={{ fontSize: 32 }}>🔍</div>
      <p style={{ color: '#aaa', fontSize: 14 }}>Contact not found</p>
      <button onClick={() => backState?.from === 'account' ? navigate('/accounts', { state: { selectId: backState.accountId } }) : navigate('/contacts')} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
        {backState?.from === 'account' ? `← Back to ${backState.accountName}` : 'Back to Contacts'}
      </button>
    </div>
  );

  const sc = STAGE_COLORS[contact.status] || { bg: '#f1f5f9', color: '#475569' };
  const activeSignalsCount = Object.values(signals).filter(Boolean).length;
  const totalNotes = contactNotes.length + companyNotes.length;
  const currentStageIdx = STAGES.indexOf(contact.status);
  const nextStage = NEXT_STAGE[contact.status];
  const responseInfo = RESPONSE_OPTIONS.find(r => r.value === contact.response);

  const tabs = [
    { key: 'overview',  label: 'Overview' },
    { key: 'research',  label: 'Research' },
    { key: 'signals',   label: activeSignalsCount > 0 ? `Signals (${activeSignalsCount})` : 'Signals' },
    { key: 'notes',     label: totalNotes > 0 ? `Notes (${totalNotes})` : 'Notes' },
    { key: 'timeline',  label: timeline.length > 0 ? `Timeline (${timeline.length})` : 'Timeline' },
    { key: 'emails',    label: emails.length > 0 ? `Emails (${emails.length})` : 'Emails' },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <button onClick={() => backState?.from === 'account' ? navigate('/accounts', { state: { selectId: backState.accountId } }) : navigate('/contacts')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}>
        {backState?.from === 'account' ? `← Back to ${backState.accountName}` : '← Back to Contacts'}
      </button>

      {/* Header card */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e8f0fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, color: '#2563eb', flexShrink: 0 }}>
              {contact.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 18, fontWeight: 600, color: '#111', margin: 0 }}>{contact.full_name}</h1>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: sc.bg, color: sc.color, fontWeight: 700 }}>
                  {contact.status}
                </span>
                {contact.bounced && (
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>BOUNCED</span>
                )}
                {responseInfo && (
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: responseInfo.bg, color: responseInfo.color, fontWeight: 500 }}>
                    {responseInfo.label}
                  </span>
                )}
                {activeSignalsCount > 0 && (
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: '#fef9c3', color: '#854d0e', fontWeight: 500 }}>
                    🎯 {activeSignalsCount} signal{activeSignalsCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
                {contact.title && <span style={{ color: '#444' }}>{contact.title}</span>}
                {contact.title && contact.company && <span style={{ margin: '0 6px', color: '#ccc' }}>at</span>}
                {contact.company && <span style={{ fontWeight: 600, color: '#222' }}>{contact.company}</span>}
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {contact.email && <a href={`mailto:${contact.email}`} style={{ fontSize: 12, color: '#555', textDecoration: 'none' }}>✉ {contact.email}</a>}
                {contact.phone && <span style={{ fontSize: 12, color: '#555' }}>📞 {contact.phone}</span>}
                {contact.industry && <span style={{ fontSize: 12, color: '#777' }}>🏢 {contact.industry}</span>}
                {contact.country && <span style={{ fontSize: 12, color: '#777' }}>📍 {contact.country}</span>}
                {contact.linkedin_url && <a href={contact.linkedin_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none' }}>LinkedIn ↗</a>}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          {!contact.bounced && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={contact.status} onChange={e => updateStatus(e.target.value)}
                  style={{ fontSize: 12, padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', cursor: 'pointer', color: '#333', background: '#fff' }}>
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {nextStage && (
                  <button onClick={advanceStage} disabled={advancing}
                    style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, border: 'none',
                      background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
                    {advancing ? '…' : `→ ${nextStage}`}
                  </button>
                )}
                <button onClick={markBounced}
                  style={{ fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                  ⛔ Bounce
                </button>
              </div>
              {contact.next_followup && (
                <div style={{ fontSize: 11, color: new Date(contact.next_followup) < new Date() ? '#dc2626' : '#888' }}>
                  Next follow-up: {new Date(contact.next_followup).toLocaleDateString()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stage tracker — only show for outreach stages */}
        {currentStageIdx >= 0 && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '0.5px solid #f0f0ee' }}>
            <div style={{ fontSize: 11, color: '#aaa', fontWeight: 600, letterSpacing: '0.4px', marginBottom: 10, textTransform: 'uppercase' }}>
              Outreach progress
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {STAGES.map((s, i) => {
                const done = i < currentStageIdx;
                const active = i === currentStageIdx;
                const sc2 = STAGE_COLORS[s];
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700,
                        background: done ? '#2563eb' : active ? sc2.bg : '#f0f0ee',
                        color: done ? '#fff' : active ? sc2.color : '#bbb',
                        border: active ? `2px solid ${sc2.color}` : done ? '2px solid #2563eb' : '2px solid #e8e8e4',
                        transition: 'all 0.2s',
                      }}>
                        {done ? '✓' : s === 'Fresh' ? '0' : s.slice(1)}
                      </div>
                      <div style={{ fontSize: 10, color: active ? sc2.color : done ? '#2563eb' : '#bbb', marginTop: 4, fontWeight: active ? 700 : 400 }}>
                        {s}
                      </div>
                    </div>
                    {i < STAGES.length - 1 && (
                      <div style={{ height: 2, flex: 0.5, background: i < currentStageIdx ? '#2563eb' : '#f0f0ee', marginBottom: 18 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Response received (only for F1-F5) */}
        {currentStageIdx > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid #f0f0ee' }}>
            <div style={{ fontSize: 11, color: '#aaa', fontWeight: 600, letterSpacing: '0.4px', marginBottom: 8, textTransform: 'uppercase' }}>
              Response received
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {RESPONSE_OPTIONS.map(r => (
                <button key={r.value} onClick={() => setResponse(contact.response === r.value ? null : r.value)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s',
                    background: contact.response === r.value ? r.bg : '#f8f8f6',
                    color: contact.response === r.value ? r.color : '#888',
                    border: contact.response === r.value ? `1.5px solid ${r.color}` : '1.5px solid #e8e8e4' }}>
                  {r.label}
                </button>
              ))}
              {contact.response && (
                <button onClick={() => setResponse(null)}
                  style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, cursor: 'pointer', background: 'none', border: '1px solid #e8e8e4', color: '#bbb' }}>
                  ✕ Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid #e8e8e4', marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 16px', border: 'none', background: 'none', fontSize: 13, cursor: 'pointer',
            color: tab === t.key ? '#111' : '#888',
            fontWeight: tab === t.key ? 600 : 400,
            borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent', marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <InfoCard title="Contact info">
            <InfoRow label="Full name" value={contact.full_name} />
            <InfoRow label="Title" value={contact.title} />
            <InfoRow label="Company" value={contact.company} />
            <InfoRow label="Email" value={contact.email} />
            <InfoRow label="Phone" value={contact.phone} />
            <InfoRow label="Industry" value={contact.industry} />
            <InfoRow label="Country" value={contact.country} />
            <InfoRow label="LinkedIn" value={contact.linkedin_url} isLink />
          </InfoCard>
          <InfoCard title="Outreach status">
            <InfoRow label="Stage" value={contact.status} />
            <InfoRow label="Response" value={responseInfo?.label} />
            <InfoRow label="Last contacted" value={contact.last_contacted ? new Date(contact.last_contacted).toLocaleDateString() : null} />
            <InfoRow label="Next follow-up" value={contact.next_followup ? new Date(contact.next_followup).toLocaleDateString() : null} />
            <InfoRow label="Sequence step" value={contact.sequence_step != null ? `Step ${contact.sequence_step}` : null} />
            <InfoRow label="Added on" value={contact.created_at ? new Date(contact.created_at).toLocaleDateString() : null} />
            {contact.bounced && <InfoRow label="Bounced on" value={contact.bounced_at ? new Date(contact.bounced_at).toLocaleDateString() : 'Yes'} danger />}
          </InfoCard>
          <div style={{ gridColumn: '1 / -1' }}>
            <InfoCard title="Pitch">
              <div style={{ padding: '4px 0' }}>
                <textarea
                  value={pitch}
                  onChange={e => setPitch(e.target.value)}
                  placeholder="What angle to use for this contact — this feeds directly into AI email generation…"
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e0e0',
                    fontSize: 13, resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                    color: '#333', boxSizing: 'border-box', lineHeight: 1.5,
                    background: pitch ? '#fafffe' : '#fff' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button onClick={savePitch} disabled={savingPitch}
                    style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 13,
                      fontWeight: 500, cursor: 'pointer',
                      background: pitchSaved ? '#059669' : '#2563eb', color: '#fff', transition: 'background 0.2s' }}>
                    {savingPitch ? 'Saving…' : pitchSaved ? '✓ Saved' : 'Save Pitch'}
                  </button>
                </div>
              </div>
            </InfoCard>
          </div>
          {Object.values(research).some(Boolean) && (
            <div style={{ gridColumn: '1 / -1' }}>
              <InfoCard title="Research summary">
                {RESEARCH_FIELDS.filter(f => research[f.key]).map(f => (
                  <InfoRow key={f.key} label={f.label} value={research[f.key]} />
                ))}
              </InfoCard>
            </div>
          )}
        </div>
      )}

      {/* ── RESEARCH ── */}
      {tab === 'research' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: 0 }}>Account Research</h2>
              <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>Fills into AI email generation — the more you add, the better the emails</p>
            </div>
            <button onClick={saveResearch} disabled={savingResearch}
              style={{ padding: '8px 20px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                background: researchSaved ? '#059669' : '#2563eb', color: '#fff', transition: 'background 0.2s' }}>
              {savingResearch ? 'Saving…' : researchSaved ? '✓ Saved' : 'Save research'}
            </button>
          </div>
          <div style={{ display: 'grid', gap: 18 }}>
            {RESEARCH_FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{f.label}</label>
                <textarea value={research[f.key] || ''} onChange={e => setResearch(r => ({ ...r, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} rows={3}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, resize: 'vertical',
                    fontFamily: 'inherit', outline: 'none', color: '#333', boxSizing: 'border-box', lineHeight: 1.5,
                    background: research[f.key] ? '#fafffe' : '#fff' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SIGNALS ── */}
      {tab === 'signals' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: 0 }}>Account Signals</h2>
              <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>Active signals strengthen email personalization</p>
            </div>
            <button onClick={saveSignals} disabled={savingSignals}
              style={{ padding: '8px 20px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                background: signalsSaved ? '#059669' : '#2563eb', color: '#fff', transition: 'background 0.2s' }}>
              {savingSignals ? 'Saving…' : signalsSaved ? '✓ Saved' : 'Save signals'}
            </button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {SIGNAL_FIELDS.map(f => (
              <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 10, cursor: 'pointer',
                border: `1.5px solid ${signals[f.key] ? '#2563eb' : '#e8e8e4'}`,
                background: signals[f.key] ? '#eff6ff' : '#fafaf8', transition: 'all 0.15s' }}>
                <input type="checkbox" checked={!!signals[f.key]} onChange={e => setSignals(s => ({ ...s, [f.key]: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#2563eb' }} />
                <span style={{ fontSize: 16 }}>{f.icon}</span>
                <span style={{ fontSize: 13, color: signals[f.key] ? '#1d4ed8' : '#444', fontWeight: signals[f.key] ? 600 : 400 }}>{f.label}</span>
                {signals[f.key] && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#2563eb', fontWeight: 600 }}>ACTIVE</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── NOTES ── */}
      {tab === 'notes' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <NoteSection title="Contact Notes" subtitle={`About ${contact.full_name}`}
            notes={contactNotes} newNote={newContactNote} onChangeNote={setNewContactNote}
            onAdd={addContactNote} saving={savingNote} placeholder="Add a note about this contact…" />
          {contact.company && (
            <NoteSection title={`Company Notes — ${contact.company}`} subtitle="Shared across all SDRs on this account"
              notes={companyNotes} newNote={newCompanyNote} onChangeNote={setNewCompanyNote}
              onAdd={addCompanyNote} saving={savingNote} placeholder={`Add a note about ${contact.company}…`} isCompany />
          )}
        </div>
      )}

      {/* ── EMAILS ── */}
      {tab === 'emails' && (
        <EmailHistoryPanel emails={emails} loading={emailsLoading} contact={contact} userId={userId} onSaved={() => { fetchEmails(); fetchTimeline(); }} />
      )}

      {/* ── TIMELINE ── */}
      {tab === 'timeline' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: '0 0 24px' }}>Activity Timeline</h2>
          {timeline.length === 0 ? (
            <p style={{ fontSize: 13, color: '#bbb', textAlign: 'center', padding: '24px 0' }}>No activity recorded yet</p>
          ) : timeline.map((item, i) => (
            <TimelineItem key={item.id} item={item} isLast={i === timeline.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function InfoCard({ title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', padding: 20 }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: '#aaa', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h3>
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    </div>
  );
}

function InfoRow({ label, value, isLink, danger }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, color: '#aaa', width: 120, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      {isLink
        ? <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2563eb' }}>View profile ↗</a>
        : <span style={{ fontSize: 13, color: danger ? '#dc2626' : '#333', lineHeight: 1.4 }}>{value}</span>}
    </div>
  );
}

function NoteSection({ title, subtitle, notes, newNote, onChangeNote, onAdd, saving, placeholder, isCompany }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: '0 0 4px' }}>{title}</h2>
      <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px' }}>{subtitle}</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <textarea value={newNote} onChange={e => onChangeNote(e.target.value)} placeholder={placeholder} rows={3}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) onAdd(); }}
          style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, resize: 'none', fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={onAdd} disabled={!newNote.trim() || saving}
          style={{ padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', alignSelf: 'flex-end', opacity: !newNote.trim() ? 0.5 : 1 }}>
          Add
        </button>
      </div>
      {notes.length === 0
        ? <p style={{ fontSize: 13, color: '#bbb', textAlign: 'center', padding: '24px 0' }}>No notes yet</p>
        : notes.map(n => <NoteCard key={n.id} note={n} isCompany={isCompany} />)}
    </div>
  );
}

function NoteCard({ note, isCompany }) {
  const author = note.profiles?.full_name || 'Unknown';
  const date = note.created_at ? new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return (
    <div style={{ padding: '12px 14px', borderRadius: 8, marginBottom: 8, background: isCompany ? '#fffbeb' : '#f8f8f6', borderLeft: `3px solid ${isCompany ? '#f59e0b' : '#e0e0e0'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>{author}</span>
        <span style={{ fontSize: 11, color: '#bbb' }}>{date}</span>
      </div>
      <p style={{ fontSize: 13, color: '#333', margin: 0, lineHeight: 1.6 }}>{note.body}</p>
    </div>
  );
}

function TimelineItem({ item, isLast }) {
  const author = item.profiles?.full_name || 'System';
  const label = ACTIVITY_LABELS[item.activity_type] || item.activity_type?.replace(/_/g, ' ');
  const icon = ACTIVITY_ICONS[item.activity_type] || '●';
  const date = item.created_at ? new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div style={{ display: 'flex', gap: 12, paddingBottom: isLast ? 0 : 20, position: 'relative' }}>
      {!isLast && <div style={{ position: 'absolute', left: 17, top: 34, bottom: 0, width: 1, background: '#f0f0ee' }} />}
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, zIndex: 1, border: '0.5px solid #e8e8e4' }}>
        {icon}
      </div>
      <div style={{ flex: 1, paddingTop: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{label}</span>
          <span style={{ fontSize: 11, color: '#bbb' }}>{date}</span>
        </div>
        <span style={{ fontSize: 12, color: '#999' }}>{author}</span>
        {item.details?.from && item.details?.to && (
          <span style={{ marginLeft: 8, fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '1px 8px', borderRadius: 10 }}>
            {item.details.from} → {item.details.to}
          </span>
        )}
        {item.details?.status && !item.details?.from && (
          <span style={{ marginLeft: 8, fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '1px 8px', borderRadius: 10 }}>→ {item.details.status}</span>
        )}
      </div>
    </div>
  );
}


/* ── Email History Panel ── */
function EmailHistoryPanel({ emails, loading, contact, userId, onSaved }) {
  const [showLog, setShowLog] = useState(false);
  const [form, setForm] = useState({ stage: 'Fresh', subject: '', body: '', format: 'Cold Email', sender_email: '', sent_at: new Date().toISOString().slice(0,10) });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const FORMATS = ['Cold Email','LinkedIn Message','LinkedIn InMail','Follow-up','Voice Note Script','Twitter DM'];

  async function logEmail() {
    if (!form.subject && !form.body) return;
    setSaving(true);
    await supabase.from('emails').insert({
      contact_id: contact.id,
      owner_id: userId,
      stage: form.stage,
      subject: form.subject,
      body: form.body,
      format: form.format,
      sender_email: form.sender_email,
      sent_at: new Date(form.sent_at).toISOString(),
    });
    await supabase.from('activity_log').insert({
      actor_id: userId, contact_id: contact.id,
      activity_type: 'email_sent', details: { stage: form.stage, subject: form.subject }
    });
    setSaving(false);
    setShowLog(false);
    setForm(f => ({ ...f, subject: '', body: '' }));
    onSaved();
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: 0 }}>Email History</h2>
          <p style={{ fontSize: 12, color: '#888', margin: '3px 0 0' }}>All emails sent to {contact.full_name}</p>
        </div>
        <button onClick={() => setShowLog(v => !v)}
          style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          {showLog ? 'Cancel' : '+ Log email'}
        </button>
      </div>

      {/* Log form */}
      {showLog && (
        <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8', marginBottom: 14 }}>Log a sent email</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', marginBottom: 4 }}>Stage</label>
              <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13 }}>
                {['Fresh','F1','F2','F3','F4','F5'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', marginBottom: 4 }}>Format</label>
              <select value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13 }}>
                {FORMATS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', marginBottom: 4 }}>Sender email</label>
              <input value={form.sender_email} onChange={e => setForm(f => ({ ...f, sender_email: e.target.value }))}
                placeholder="you@domain.com"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', marginBottom: 4 }}>Sent date</label>
              <input type="date" value={form.sent_at} onChange={e => setForm(f => ({ ...f, sent_at: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', marginBottom: 4 }}>Subject line</label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Email subject…"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', marginBottom: 4 }}>Email body</label>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Paste the email you sent…" rows={6}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setShowLog(false)}
              style={{ padding: '8px 16px', background: '#f0f0ee', color: '#555', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={logEmail} disabled={saving || (!form.subject && !form.body)}
              style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                opacity: (!form.subject && !form.body) ? 0.5 : 1 }}>
              {saving ? 'Saving…' : '✓ Save email'}
            </button>
          </div>
        </div>
      )}

      {/* Email list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading…</div>
      ) : emails.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✉️</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No emails logged yet</div>
          <div style={{ fontSize: 13 }}>Click "+ Log email" to record a sent email</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {emails.map(e => {
            const sc = STAGE_COLORS[e.stage] || { bg: '#f1f5f9', color: '#475569' };
            const isOpen = expanded === e.id;
            const sentDate = e.sent_at ? new Date(e.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
            return (
              <div key={e.id} style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 10, overflow: 'hidden' }}>
                {/* Email header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                  onClick={() => setExpanded(isOpen ? null : e.id)}>
                  <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, flexShrink: 0 }}>
                    {e.stage}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.subject || <span style={{ color: '#aaa', fontStyle: 'italic' }}>No subject</span>}
                    </div>
                    {e.sender_email && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>From: {e.sender_email}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{sentDate}</div>
                  <div style={{ fontSize: 12, color: '#bbb', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</div>
                </div>
                {/* Expanded body */}
                {isOpen && e.body && (
                  <div style={{ padding: '0 16px 16px', borderTop: '0.5px solid #f0f0ee' }}>
                    <div style={{ marginTop: 12, padding: '12px 14px', background: '#f8f8f6', borderRadius: 8,
                      fontSize: 13, lineHeight: 1.75, color: '#333', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                      {e.body}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button onClick={() => navigator.clipboard.writeText((e.subject ? `Subject: ${e.subject}\n\n` : '') + e.body)}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', color: '#555', cursor: 'pointer' }}>
                        📋 Copy
                      </button>
                      <span style={{ fontSize: 11, color: '#bbb', padding: '4px 0' }}>{e.format}</span>
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
