import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  fresh: { bg: '#e0f2fe', color: '#0369a1' },
  contacted: { bg: '#f0fdf4', color: '#166534' },
  replied: { bg: '#fef9c3', color: '#854d0e' },
  meeting: { bg: '#ede9fe', color: '#6d28d9' },
  won: { bg: '#dcfce7', color: '#15803d' },
  lost: { bg: '#f1f5f9', color: '#475569' },
  bounced: { bg: '#fee2e2', color: '#991b1b' },
  unsubscribed: { bg: '#fef3c7', color: '#92400e' },
  cooling_off: { bg: '#f0f0ee', color: '#666' },
};

const ALL_STATUSES = ['fresh','contacted','replied','meeting','won','lost','unsubscribed','cooling_off'];

const RESEARCH_FIELDS = [
  { key: 'whyTarget', label: 'Why target this account', placeholder: 'Why this company fits ACCELQ ICP...' },
  { key: 'techStack', label: 'Known tech stack', placeholder: 'SAP, Selenium, Jenkins, Jira...' },
  { key: 'qaHiring', label: 'QA hiring activity', placeholder: 'Currently hiring 3 SDET roles on LinkedIn...' },
  { key: 'recentNews', label: 'Recent news', placeholder: 'Raised $50M Series B in March...' },
  { key: 'painPoints', label: 'Pain points', placeholder: 'Manual regression takes 2 weeks per release...' },
  { key: 'openingLine', label: 'Opening line idea', placeholder: 'Draft a hook to start the cold email...' },
];

const SIGNAL_FIELDS = [
  { key: 'competitorTools', label: 'Competitor tools detected', icon: '🔍' },
  { key: 'recentFunding', label: 'Recent funding', icon: '💰' },
  { key: 'hiringQA', label: 'Hiring QA engineers', icon: '👥' },
  { key: 'recentLaunch', label: 'Recent product launch', icon: '🚀' },
  { key: 'outage', label: 'Recent outage / incident', icon: '⚠️' },
  { key: 'cicd', label: 'Active CI/CD pipeline', icon: '⚙️' },
];

const ACTIVITY_LABELS = {
  status_changed: 'Status changed',
  bounce_detected: 'Marked bounced',
  email_sent: 'Email sent',
  reply_logged: 'Reply logged',
  note_added: 'Note added',
  research_updated: 'Research updated',
  signals_updated: 'Signals updated',
};

const ACTIVITY_ICONS = {
  status_changed: '🔄',
  bounce_detected: '⛔',
  email_sent: '✉️',
  reply_logged: '💬',
  note_added: '📝',
  research_updated: '🔍',
  signals_updated: '🎯',
};

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  // Research
  const [research, setResearch] = useState({});
  const [savingResearch, setSavingResearch] = useState(false);
  const [researchSaved, setResearchSaved] = useState(false);

  // Signals
  const [signals, setSignals] = useState({});
  const [savingSignals, setSavingSignals] = useState(false);
  const [signalsSaved, setSignalsSaved] = useState(false);

  // Notes
  const [contactNotes, setContactNotes] = useState([]);
  const [companyNotes, setCompanyNotes] = useState([]);
  const [newContactNote, setNewContactNote] = useState('');
  const [newCompanyNote, setNewCompanyNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Timeline
  const [timeline, setTimeline] = useState([]);

  const fetchContact = useCallback(async () => {
    const { data } = await supabase.from('contacts').select('*').eq('id', id).single();
    if (data) {
      setContact(data);
      setResearch(data.research || {});
      setSignals(data.signals || {});
    }
    setLoading(false);
  }, [id]);

  const fetchNotes = useCallback(async (companyName) => {
    const [{ data: cn }, { data: co }] = await Promise.all([
      supabase.from('contact_notes')
        .select('*, profiles(full_name)')
        .eq('contact_id', id)
        .order('created_at', { ascending: false }),
      companyName
        ? supabase.from('company_notes')
            .select('*, profiles(full_name)')
            .eq('company_name', companyName)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    setContactNotes(cn || []);
    setCompanyNotes(co || []);
  }, [id]);

  const fetchTimeline = useCallback(async () => {
    const { data } = await supabase
      .from('activity_log')
      .select('*, profiles(full_name)')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })
      .limit(50);
    setTimeline(data || []);
  }, [id]);

  useEffect(() => { fetchContact(); }, [fetchContact]);

  useEffect(() => {
    if (contact) {
      fetchNotes(contact.company);
      fetchTimeline();
    }
  }, [contact?.id]);

  async function updateStatus(status) {
    await supabase.from('contacts').update({ status }).eq('id', id);
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: id,
      activity_type: 'status_changed', details: { status }
    });
    setContact(c => ({ ...c, status }));
    fetchTimeline();
  }

  async function markBounced() {
    if (!window.confirm('Mark this contact as bounced? They will be excluded from follow-ups.')) return;
    await supabase.from('contacts').update({
      status: 'bounced', bounced: true, bounced_at: new Date().toISOString()
    }).eq('id', id);
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: id,
      activity_type: 'bounce_detected', details: {}
    });
    setContact(c => ({ ...c, status: 'bounced', bounced: true }));
    fetchTimeline();
  }

  async function saveResearch() {
    setSavingResearch(true);
    await supabase.from('contacts').update({ research }).eq('id', id);
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: id,
      activity_type: 'research_updated', details: {}
    });
    setSavingResearch(false);
    setResearchSaved(true);
    setTimeout(() => setResearchSaved(false), 2500);
    fetchTimeline();
  }

  async function saveSignals() {
    setSavingSignals(true);
    await supabase.from('contacts').update({ signals }).eq('id', id);
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: id,
      activity_type: 'signals_updated', details: { active: Object.keys(signals).filter(k => signals[k]) }
    });
    setSavingSignals(false);
    setSignalsSaved(true);
    setTimeout(() => setSignalsSaved(false), 2500);
    fetchTimeline();
  }

  async function addContactNote() {
    if (!newContactNote.trim()) return;
    setSavingNote(true);
    await supabase.from('contact_notes').insert({
      contact_id: id, author_id: user.id, body: newContactNote.trim()
    });
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: id,
      activity_type: 'note_added', details: { type: 'contact' }
    });
    setNewContactNote('');
    setSavingNote(false);
    fetchNotes(contact?.company);
    fetchTimeline();
  }

  async function addCompanyNote() {
    if (!newCompanyNote.trim() || !contact?.company) return;
    setSavingNote(true);
    await supabase.from('company_notes').insert({
      company_name: contact.company, author_id: user.id, body: newCompanyNote.trim()
    });
    setNewCompanyNote('');
    setSavingNote(false);
    fetchNotes(contact.company);
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#aaa', fontSize: 14 }}>
      Loading contact…
    </div>
  );

  if (!contact) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
      <div style={{ fontSize: 32 }}>🔍</div>
      <p style={{ color: '#aaa', fontSize: 14 }}>Contact not found</p>
      <button onClick={() => navigate('/contacts')} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
        Back to Contacts
      </button>
    </div>
  );

  const sc = STATUS_COLORS[contact.status] || { bg: '#f1f5f9', color: '#475569' };
  const activeSignalsCount = Object.values(signals).filter(Boolean).length;
  const totalNotes = contactNotes.length + companyNotes.length;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'research', label: 'Research' },
    { key: 'signals', label: activeSignalsCount > 0 ? `Signals (${activeSignalsCount})` : 'Signals' },
    { key: 'notes', label: totalNotes > 0 ? `Notes (${totalNotes})` : 'Notes' },
    { key: 'timeline', label: timeline.length > 0 ? `Timeline (${timeline.length})` : 'Timeline' },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>

      {/* Back */}
      <button
        onClick={() => navigate('/contacts')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}
      >
        ← Back to Contacts
      </button>

      {/* Header card */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {/* Avatar */}
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: '#e8f0fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 600, color: '#2563eb', flexShrink: 0
            }}>
              {contact.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 18, fontWeight: 600, color: '#111', margin: 0 }}>{contact.full_name}</h1>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: sc.bg, color: sc.color, fontWeight: 600 }}>
                  {contact.status}
                </span>
                {contact.bounced && (
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>
                    BOUNCED
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
                {contact.email && (
                  <a href={`mailto:${contact.email}`} style={{ fontSize: 12, color: '#555', textDecoration: 'none' }}>
                    ✉ {contact.email}
                  </a>
                )}
                {contact.phone && <span style={{ fontSize: 12, color: '#555' }}>📞 {contact.phone}</span>}
                {contact.industry && <span style={{ fontSize: 12, color: '#777' }}>🏢 {contact.industry}</span>}
                {contact.country && <span style={{ fontSize: 12, color: '#777' }}>📍 {contact.country}</span>}
                {contact.linkedin_url && (
                  <a href={contact.linkedin_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none' }}>
                    LinkedIn ↗
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          {!contact.bounced && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <select
                value={contact.status}
                onChange={e => updateStatus(e.target.value)}
                style={{ fontSize: 12, padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', cursor: 'pointer', color: '#333', background: '#fff' }}
              >
                {ALL_STATUSES.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>
                ))}
              </select>
              <button
                onClick={markBounced}
                style={{ fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer' }}
              >
                Mark bounced
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid #e8e8e4', marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 16px', border: 'none', background: 'none', fontSize: 13, cursor: 'pointer',
            color: tab === t.key ? '#111' : '#888',
            fontWeight: tab === t.key ? 600 : 400,
            borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -1,
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
          <InfoCard title="Sequence status">
            <InfoRow label="Status" value={contact.status?.charAt(0).toUpperCase() + contact.status?.slice(1).replace('_',' ')} />
            <InfoRow label="Sequence stage" value={contact.sequence_stage} />
            <InfoRow label="Last contacted" value={contact.last_contacted ? new Date(contact.last_contacted).toLocaleDateString() : null} />
            <InfoRow label="Next follow-up" value={contact.next_followup ? new Date(contact.next_followup).toLocaleDateString() : null} />
            <InfoRow label="Added on" value={contact.created_at ? new Date(contact.created_at).toLocaleDateString() : null} />
            {contact.bounced && <InfoRow label="Bounced on" value={contact.bounced_at ? new Date(contact.bounced_at).toLocaleDateString() : 'Yes'} danger />}
          </InfoCard>
          {/* Research summary if any */}
          {Object.values(research).some(Boolean) && (
            <div style={{ gridColumn: '1 / -1' }}>
              <InfoCard title="Research summary">
                {RESEARCH_FIELDS.filter(f => research[f.key]).map(f => (
                  <div key={f.key}>
                    <InfoRow label={f.label} value={research[f.key]} />
                  </div>
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
              <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
                Fills into AI email generation — the more you add, the better the emails
              </p>
            </div>
            <button
              onClick={saveResearch}
              disabled={savingResearch}
              style={{
                padding: '8px 20px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                background: researchSaved ? '#059669' : '#2563eb', color: '#fff', transition: 'background 0.2s'
              }}
            >
              {savingResearch ? 'Saving…' : researchSaved ? '✓ Saved' : 'Save research'}
            </button>
          </div>
          <div style={{ display: 'grid', gap: 18 }}>
            {RESEARCH_FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  {f.label}
                </label>
                <textarea
                  value={research[f.key] || ''}
                  onChange={e => setResearch(r => ({ ...r, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #e0e0e0', fontSize: 13, resize: 'vertical',
                    fontFamily: 'inherit', outline: 'none', color: '#333',
                    boxSizing: 'border-box', lineHeight: 1.5,
                    background: research[f.key] ? '#fafffe' : '#fff'
                  }}
                />
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
              <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
                Active signals strengthen email personalization and urgency
              </p>
            </div>
            <button
              onClick={saveSignals}
              disabled={savingSignals}
              style={{
                padding: '8px 20px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                background: signalsSaved ? '#059669' : '#2563eb', color: '#fff', transition: 'background 0.2s'
              }}
            >
              {savingSignals ? 'Saving…' : signalsSaved ? '✓ Saved' : 'Save signals'}
            </button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {SIGNAL_FIELDS.map(f => (
              <label
                key={f.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
                  borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${signals[f.key] ? '#2563eb' : '#e8e8e4'}`,
                  background: signals[f.key] ? '#eff6ff' : '#fafaf8',
                  transition: 'all 0.15s'
                }}
              >
                <input
                  type="checkbox"
                  checked={!!signals[f.key]}
                  onChange={e => setSignals(s => ({ ...s, [f.key]: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#2563eb' }}
                />
                <span style={{ fontSize: 16 }}>{f.icon}</span>
                <span style={{ fontSize: 13, color: signals[f.key] ? '#1d4ed8' : '#444', fontWeight: signals[f.key] ? 600 : 400 }}>
                  {f.label}
                </span>
                {signals[f.key] && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#2563eb', fontWeight: 600 }}>ACTIVE</span>
                )}
              </label>
            ))}
          </div>
          {activeSignalsCount > 0 && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#eff6ff', borderRadius: 8, fontSize: 12, color: '#1d4ed8' }}>
              💡 {activeSignalsCount} signal{activeSignalsCount > 1 ? 's' : ''} active — AI will reference {activeSignalsCount > 1 ? 'these' : 'this'} when generating emails
            </div>
          )}
        </div>
      )}

      {/* ── NOTES ── */}
      {tab === 'notes' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Contact notes */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: '0 0 4px' }}>
              Contact Notes
            </h2>
            <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px' }}>
              Notes about {contact.full_name} — visible to your team
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <textarea
                value={newContactNote}
                onChange={e => setNewContactNote(e.target.value)}
                placeholder="Add a note about this contact…"
                rows={3}
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addContactNote(); }}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e0e0',
                  fontSize: 13, resize: 'none', fontFamily: 'inherit', outline: 'none'
                }}
              />
              <button
                onClick={addContactNote}
                disabled={!newContactNote.trim() || savingNote}
                style={{
                  padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  alignSelf: 'flex-end', opacity: !newContactNote.trim() ? 0.5 : 1
                }}
              >
                Add
              </button>
            </div>
            {contactNotes.length === 0 ? (
              <p style={{ fontSize: 13, color: '#bbb', textAlign: 'center', padding: '24px 0' }}>No notes yet</p>
            ) : contactNotes.map(n => <NoteCard key={n.id} note={n} />)}
          </div>

          {/* Company notes */}
          {contact.company && (
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', padding: 24 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: '0 0 4px' }}>
                Company Notes — {contact.company}
              </h2>
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px' }}>
                Shared across all SDRs working this account
              </p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <textarea
                  value={newCompanyNote}
                  onChange={e => setNewCompanyNote(e.target.value)}
                  placeholder={`Add a note about ${contact.company}…`}
                  rows={3}
                  onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addCompanyNote(); }}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e0e0',
                    fontSize: 13, resize: 'none', fontFamily: 'inherit', outline: 'none'
                  }}
                />
                <button
                  onClick={addCompanyNote}
                  disabled={!newCompanyNote.trim() || savingNote}
                  style={{
                    padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none',
                    borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    alignSelf: 'flex-end', opacity: !newCompanyNote.trim() ? 0.5 : 1
                  }}
                >
                  Add
                </button>
              </div>
              {companyNotes.length === 0 ? (
                <p style={{ fontSize: 13, color: '#bbb', textAlign: 'center', padding: '24px 0' }}>No company notes yet</p>
              ) : companyNotes.map(n => <NoteCard key={n.id} note={n} isCompany />)}
            </div>
          )}
        </div>
      )}

      {/* ── TIMELINE ── */}
      {tab === 'timeline' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: '0 0 24px' }}>Activity Timeline</h2>
          {timeline.length === 0 ? (
            <p style={{ fontSize: 13, color: '#bbb', textAlign: 'center', padding: '24px 0' }}>No activity recorded yet</p>
          ) : (
            <div>
              {timeline.map((item, i) => (
                <TimelineItem key={item.id} item={item} isLast={i === timeline.length - 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function InfoCard({ title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', padding: 20 }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: '#aaa', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {title}
      </h3>
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    </div>
  );
}

function InfoRow({ label, value, isLink, danger }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, color: '#aaa', width: 110, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      {isLink ? (
        <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2563eb' }}>View profile ↗</a>
      ) : (
        <span style={{ fontSize: 13, color: danger ? '#dc2626' : '#333', lineHeight: 1.4 }}>{value}</span>
      )}
    </div>
  );
}

function NoteCard({ note, isCompany }) {
  const author = note.profiles?.full_name || 'Unknown';
  const date = note.created_at
    ? new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 8, marginBottom: 8,
      background: isCompany ? '#fffbeb' : '#f8f8f6',
      borderLeft: `3px solid ${isCompany ? '#f59e0b' : '#e0e0e0'}`
    }}>
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
  const date = item.created_at
    ? new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div style={{ display: 'flex', gap: 12, paddingBottom: isLast ? 0 : 20, position: 'relative' }}>
      {!isLast && (
        <div style={{ position: 'absolute', left: 17, top: 34, bottom: 0, width: 1, background: '#f0f0ee' }} />
      )}
      <div style={{
        width: 34, height: 34, borderRadius: '50%', background: '#f5f5f3',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, flexShrink: 0, zIndex: 1, border: '0.5px solid #e8e8e4'
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, paddingTop: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{label}</span>
          <span style={{ fontSize: 11, color: '#bbb' }}>{date}</span>
        </div>
        <span style={{ fontSize: 12, color: '#999' }}>{author}</span>
        {item.details?.status && (
          <span style={{ marginLeft: 8, fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '1px 8px', borderRadius: 10 }}>
            → {item.details.status}
          </span>
        )}
      </div>
    </div>
  );
}
