import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  prospecting:  { bg: '#e0f2fe', color: '#0369a1' },
  engaged:      { bg: '#fef9c3', color: '#854d0e' },
  demo_booked:  { bg: '#ede9fe', color: '#6d28d9' },
  closed_won:   { bg: '#dcfce7', color: '#15803d' },
  closed_lost:  { bg: '#f1f5f9', color: '#475569' },
};

const INTENT_TYPES = [
  { value: 'qa_hiring', label: '🧑‍💼 QA Hiring', desc: 'Hiring QA engineers / testers' },
  { value: 'competitor_tool', label: '⚔️ Competitor Tool', desc: 'Using Selenium, Cypress, etc.' },
  { value: 'recent_funding', label: '💰 Recent Funding', desc: 'Series A/B/C or IPO' },
  { value: 'recent_launch', label: '🚀 Recent Launch', desc: 'New product or major release' },
  { value: 'outage', label: '🔴 Outage', desc: 'Public outage or incident' },
  { value: 'cicd', label: '⚙️ CI/CD', desc: 'CI/CD pipeline activity' },
  { value: 'tech_stack', label: '🛠️ Tech Stack', desc: 'Relevant tech stack signal' },
  { value: 'website_traffic', label: '📈 Website Traffic', desc: 'Traffic spike detected' },
  { value: 'g2_review', label: '⭐ G2 Review', desc: 'Posted a G2 review' },
  { value: 'other', label: '📌 Other', desc: 'Custom signal' },
];

const CONTACT_STATUS_COLORS = {
  fresh: { bg: '#e0f2fe', color: '#0369a1' },
  contacted: { bg: '#f0fdf4', color: '#166534' },
  replied: { bg: '#fef9c3', color: '#854d0e' },
  meeting: { bg: '#ede9fe', color: '#6d28d9' },
  won: { bg: '#dcfce7', color: '#15803d' },
  lost: { bg: '#f1f5f9', color: '#475569' },
  bounced: { bg: '#fee2e2', color: '#991b1b' },
};

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [account, setAccount] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [intents, setIntents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [showAddIntent, setShowAddIntent] = useState(false);
  const [newIntent, setNewIntent] = useState({ intent_type: 'qa_hiring', notes: '' });
  const [addingIntent, setAddingIntent] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => { fetchAll(); }, [id]);

  async function fetchAll() {
    setLoading(true);
    const [{ data: acc }, { data: cts }, { data: ints }] = await Promise.all([
      supabase.from('accounts').select('*').eq('id', id).single(),
      supabase.from('contacts').select('*').eq('account_id', id).order('created_at', { ascending: false }),
      supabase.from('account_intents').select('*, profiles:created_by(full_name)').eq('account_id', id).order('detected_at', { ascending: false }),
    ]);
    setAccount(acc);
    setNotes(acc?.notes || '');
    setEditData(acc || {});
    setContacts(cts || []);
    setIntents(ints || []);
    setLoading(false);
  }

  async function saveNotes() {
    setSavingNotes(true);
    await supabase.from('accounts').update({ notes }).eq('id', id);
    setSavingNotes(false);
  }

  async function saveEdit() {
    await supabase.from('accounts').update({
      name: editData.name, domain: editData.domain, industry: editData.industry,
      size: editData.size, country: editData.country, website: editData.website, status: editData.status,
    }).eq('id', id);
    setEditing(false);
    fetchAll();
  }

  async function addIntent() {
    if (!newIntent.intent_type) return;
    setAddingIntent(true);
    await supabase.from('account_intents').insert({ account_id: id, intent_type: newIntent.intent_type, notes: newIntent.notes, created_by: user.id });
    setNewIntent({ intent_type: 'qa_hiring', notes: '' });
    setShowAddIntent(false);
    setAddingIntent(false);
    fetchAll();
  }

  async function deleteIntent(intentId) {
    await supabase.from('account_intents').delete().eq('id', intentId);
    fetchAll();
  }

  if (loading) return <div style={{ padding: 32, color: '#aaa', textAlign: 'center' }}>Loading…</div>;
  if (!account) return <div style={{ padding: 32, color: '#aaa', textAlign: 'center' }}>Account not found</div>;

  const sc = STATUS_COLORS[account.status] || STATUS_COLORS.prospecting;
  const tabs = ['overview', 'contacts', 'intents', 'notes'];

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Back */}
      <button onClick={() => navigate('/accounts')}
        style={{ fontSize: 13, color: '#888', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, padding: 0 }}>
        ← Back to Accounts
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0 }}>{account.name}</h1>
            <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 12, background: sc.bg, color: sc.color, fontWeight: 500 }}>
              {account.status?.replace('_', ' ')}
            </span>
            {intents.length > 0 && (
              <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 12, background: '#fef3c7', color: '#92400e', fontWeight: 500 }}>
                {intents.length} intent signal{intents.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            {[account.industry, account.size, account.country].filter(Boolean).join(' · ')}
            {account.domain && <span> · {account.domain}</span>}
          </div>
        </div>
        <button onClick={() => setEditing(!editing)}
          style={{ fontSize: 12, padding: '6px 14px', borderRadius: 7, border: '1px solid #e0e0e0', background: '#fff', color: '#555', cursor: 'pointer' }}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {/* Edit Form */}
      {editing && (
        <div style={{ background: '#f8f9fa', borderRadius: 10, padding: 18, marginBottom: 20, border: '1px solid #e0e0e0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            {[
              { key: 'name', label: 'Company Name' },
              { key: 'domain', label: 'Domain' },
              { key: 'industry', label: 'Industry' },
              { key: 'size', label: 'Size' },
              { key: 'country', label: 'Country' },
              { key: 'website', label: 'Website' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input value={editData[f.key] || ''} onChange={e => setEditData({ ...editData, [f.key]: e.target.value })}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Status</label>
            <select value={editData.status || 'prospecting'} onChange={e => setEditData({ ...editData, status: e.target.value })}
              style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 13 }}>
              <option value="prospecting">Prospecting</option>
              <option value="engaged">Engaged</option>
              <option value="demo_booked">Demo Booked</option>
              <option value="closed_won">Closed Won</option>
              <option value="closed_lost">Closed Lost</option>
            </select>
          </div>
          <button onClick={saveEdit}
            style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none' }}>
            Save Changes
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e8e8e4', marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
              color: tab === t ? '#2563eb' : '#888', fontWeight: tab === t ? 600 : 400,
              borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent', marginBottom: -1 }}>
            {t === 'overview' ? 'Overview' : t === 'contacts' ? `Contacts (${contacts.length})` : t === 'intents' ? `Intents (${intents.length})` : 'Notes'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e4', padding: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#888', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Company Info</h3>
            {[
              { label: 'Name', value: account.name },
              { label: 'Domain', value: account.domain },
              { label: 'Industry', value: account.industry },
              { label: 'Size', value: account.size },
              { label: 'Country', value: account.country },
              { label: 'Website', value: account.website },
            ].map(r => r.value ? (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f5f5f5' }}>
                <span style={{ fontSize: 13, color: '#888' }}>{r.label}</span>
                <span style={{ fontSize: 13, color: '#111', fontWeight: 500 }}>{r.value}</span>
              </div>
            ) : null)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e4', padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#888' }}>Contacts</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>{contacts.length}</span>
            </div>
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e4', padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#888' }}>Intent Signals</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{intents.length}</span>
            </div>
            {intents.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e4', padding: 18 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: '#888', margin: '0 0 10px' }}>Latest Signals</h4>
                {intents.slice(0, 3).map(i => {
                  const it = INTENT_TYPES.find(t => t.value === i.intent_type);
                  return (
                    <div key={i.id} style={{ fontSize: 12, color: '#555', padding: '4px 0', borderBottom: '1px solid #f5f5f5' }}>
                      {it?.label || i.intent_type}
                      {i.notes && <span style={{ color: '#aaa', marginLeft: 6 }}>— {i.notes}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contacts Tab */}
      {tab === 'contacts' && (
        <div>
          {contacts.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#aaa', background: '#fff', borderRadius: 10, border: '1px solid #e8e8e4' }}>
              No contacts linked to this account yet.<br />
              <span style={{ fontSize: 12 }}>Link contacts by editing them on the Contacts page.</span>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e4', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e8e8e4' }}>
                    {['Name', 'Title', 'Email', 'Status', 'Response', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#999', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c => {
                    const sc = CONTACT_STATUS_COLORS[c.status] || { bg: '#f1f5f9', color: '#475569' };
                    const isOwner = c.owner_id === user.id;
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f5f5f5', opacity: isOwner ? 1 : 0.85 }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                          {c.full_name}
                          {!isOwner && <span style={{ marginLeft: 6, fontSize: 10, color: '#aaa', fontWeight: 400 }}>view only</span>}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#555' }}>{c.title || '—'}</td>
                        <td style={{ padding: '10px 14px', color: '#555' }}>{c.email}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: sc.bg, color: sc.color, fontWeight: 500 }}>
                            {c.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>
                          {c.response ? c.response.replace('_', ' ') : '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {isOwner && (
                            <button onClick={() => navigate(`/contacts/${c.id}`)}
                              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', color: '#2563eb', cursor: 'pointer' }}>
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Intents Tab */}
      {tab === 'intents' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button onClick={() => setShowAddIntent(!showAddIntent)}
              style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none' }}>
              + Add Signal
            </button>
          </div>

          {showAddIntent && (
            <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Signal Type</label>
                  <select value={newIntent.intent_type} onChange={e => setNewIntent({ ...newIntent, intent_type: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 13 }}>
                    {INTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>)}
                  </select>
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Notes (optional)</label>
                  <input value={newIntent.notes} onChange={e => setNewIntent({ ...newIntent, notes: e.target.value })}
                    placeholder="e.g. Posted 3 QA job openings on LinkedIn"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={addIntent} disabled={addingIntent}
                  style={{ padding: '7px 18px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none' }}>
                  {addingIntent ? 'Adding…' : 'Add Signal'}
                </button>
                <button onClick={() => setShowAddIntent(false)}
                  style={{ padding: '7px 14px', background: '#f5f5f5', color: '#555', borderRadius: 7, fontSize: 13, cursor: 'pointer', border: 'none' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {intents.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#aaa', background: '#fff', borderRadius: 10, border: '1px solid #e8e8e4' }}>
              No intent signals yet — add buying signals above
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {intents.map(i => {
                const it = INTENT_TYPES.find(t => t.value === i.intent_type);
                return (
                  <div key={i.id} style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 4 }}>{it?.label || i.intent_type}</div>
                      {i.notes && <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{i.notes}</div>}
                      <div style={{ fontSize: 11, color: '#aaa' }}>
                        {new Date(i.detected_at).toLocaleDateString()}
                        {i.profiles?.full_name && ` · added by ${i.profiles.full_name}`}
                      </div>
                    </div>
                    {i.created_by === user.id && (
                      <button onClick={() => deleteIntent(i.id)}
                        style={{ fontSize: 12, color: '#dc2626', border: '1px solid #fecaca', background: '#fff', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Notes Tab */}
      {tab === 'notes' && (
        <div>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>Company-level notes — visible to all SDRs working this account.</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add company intelligence here — budget cycles, key decision makers, known blockers, recent conversations…"
            style={{ width: '100%', minHeight: 200, padding: 14, borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={saveNotes} disabled={savingNotes}
              style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none' }}>
              {savingNotes ? 'Saving…' : 'Save Notes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
