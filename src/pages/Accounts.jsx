import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const LEGACY_TOOLS = ['selenium','uft','tosca','soapui','qtp','silktest','winrunner','loadrunner','jmeter','rational'];
const MODERN_TOOLS = ['cypress','playwright','webdriverio','testcafe','k6','appium','detox','jest','pytest','robot framework'];

const TOOL_STATUS_OPTIONS = ['Legacy','Modern','Evaluating','Pain Point','Active'];
const TOOL_STATUS_COLORS = {
  Legacy:      { bg: '#fee2e2', color: '#dc2626' },
  Modern:      { bg: '#e0f2fe', color: '#0369a1' },
  Evaluating:  { bg: '#fef3c7', color: '#d97706' },
  'Pain Point':{ bg: '#fce7f3', color: '#9d174d' },
  Active:      { bg: '#dcfce7', color: '#16a34a' },
};

const SIGNAL_DEFS = [
  { key: 'funding',          icon: '💰', label: 'Recent Funding / IPO',       color: '#059669', bg: '#d1fae5' },
  { key: 'hiringQA',         icon: '👥', label: 'Hiring QA / SDET',           color: '#7c3aed', bg: '#ede9fe' },
  { key: 'recentLaunch',     icon: '🚀', label: 'Recent Product Launch',      color: '#0891b2', bg: '#e0f2fe' },
  { key: 'leadershipChange', icon: '👤', label: 'Leadership Change',          color: '#d97706', bg: '#fef3c7' },
  { key: 'outage',           icon: '⚠️', label: 'Outage / Quality Incident',  color: '#dc2626', bg: '#fee2e2' },
  { key: 'cicd',             icon: '⚙️', label: 'Active CI/CD Pipeline',      color: '#475569', bg: '#f1f5f9' },
];

const RESEARCH_DEFAULTS = [
  { key: 'whyTarget',   label: 'Why Target',         hint: 'why this company is a good fit for ACCELQ test automation' },
  { key: 'techStack',   label: 'Tech Stack',         hint: 'known languages, frameworks, CI/CD, cloud, testing tools' },
  { key: 'qaHiring',    label: 'QA Hiring Signals',  hint: 'likelihood of hiring QA/automation engineers: Low/Med/High with reason' },
  { key: 'recentNews',  label: 'Recent News',        hint: 'one relevant news item, funding, or digital transformation initiative' },
  { key: 'painPoints',  label: 'Pain Points',        hint: 'top 2 QA/testing pain points ACCELQ solves for this company' },
];

const COMMON_ENTERPRISE_APPS = ['SAP','Oracle','Workday','ServiceNow','Salesforce','Microsoft Dynamics','SAP S/4HANA','Oracle EBS','PeopleSoft','Guidewire','Siebel','Veeva'];

const STAGE_COLORS = {
  Fresh: { bg: '#dbeafe', color: '#1d4ed8' },
  F1:    { bg: '#d1fae5', color: '#065f46' },
  F2:    { bg: '#a7f3d0', color: '#064e3b' },
  F3:    { bg: '#fef3c7', color: '#92400e' },
  F4:    { bg: '#fed7aa', color: '#92400e' },
  F5:    { bg: '#fee2e2', color: '#991b1b' },
  won:   { bg: '#dcfce7', color: '#15803d' },
  lost:  { bg: '#f1f5f9', color: '#475569' },
};

function scoreColor(s) {
  if (s >= 80) return { bg: '#dcfce7', color: '#15803d' };
  if (s >= 60) return { bg: '#d1fae5', color: '#065f46' };
  if (s >= 40) return { bg: '#fef3c7', color: '#92400e' };
  return { bg: '#fee2e2', color: '#991b1b' };
}

function calcScore(account, contacts) {
  let score = 0;
  const sig = account.signals || {};
  const tools = account.testing_tools || [];
  if (tools.some(t => t.status === 'Legacy')) score += 30;
  else if (tools.some(t => t.status === 'Evaluating')) score += 20;
  else if (tools.length > 0) score += 15;
  if (sig.hiringQA) score += 10;
  if (sig.funding) score += 10;
  if (sig.outage) score += 8;
  if (sig.recentLaunch) score += 6;
  if (sig.leadershipChange) score += 6;
  if (sig.cicd) score += 5;
  const replied = (contacts || []).filter(c => c.response === 'warm' || c.response === 'prospect').length;
  score += Math.min(replied * 5, 15);
  const r = account.research || {};
  score += Math.min(Object.values(r).filter(v => v && v.length > 10).length * 2, 10);
  return Math.min(score, 100);
}

function getInitials(name) {
  return (name || '').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

function getSignalBadges(account) {
  const sig = account.signals || {};
  const tools = account.testing_tools || [];
  const badges = [];
  if (tools.some(t => t.status === 'Legacy')) badges.push({ label: 'Legacy Tool', color: '#dc2626', bg: '#fee2e2' });
  if (sig.hiringQA) badges.push({ label: 'Hiring QA', color: '#7c3aed', bg: '#ede9fe' });
  if (sig.funding) badges.push({ label: 'Funded', color: '#059669', bg: '#d1fae5' });
  if (sig.outage) badges.push({ label: 'Outage', color: '#dc2626', bg: '#fee2e2' });
  if (sig.leadershipChange) badges.push({ label: 'New Leader', color: '#d97706', bg: '#fef3c7' });
  return badges;
}

export default function Accounts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [accounts, setAccounts] = useState([]);
  const [contactsByAccount, setContactsByAccount] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [filterBy, setFilterBy] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAcct, setNewAcct] = useState({ name: '', industry: '', country: '', linkedin_url: '', revenue_millions: '' });
  const [adding, setAdding] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: accs }, { data: cts }] = await Promise.all([
      supabase.from('accounts').select('*').eq('owner_id', user.id),
      supabase.from('contacts').select('id, account_id, full_name, title, seniority, status, response, email, pitch, last_contacted, next_followup').eq('owner_id', user.id),
    ]);
    const byAcct = {};
    (cts || []).forEach(c => {
      if (c.account_id) {
        if (!byAcct[c.account_id]) byAcct[c.account_id] = [];
        byAcct[c.account_id].push(c);
      }
    });
    setContactsByAccount(byAcct);
    setAccounts(accs || []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (location.state?.selectId) {
      setSelectedId(location.state.selectId);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  async function addAccount() {
    if (!newAcct.name.trim()) return;
    setAdding(true);
    const { data } = await supabase.from('accounts').insert({
      name: newAcct.name.trim(),
      industry: newAcct.industry || null,
      country: newAcct.country || null,
      linkedin_url: newAcct.linkedin_url || null,
      revenue_millions: newAcct.revenue_millions ? parseFloat(newAcct.revenue_millions) : null,
      owner_id: user.id,
    }).select().single();
    setAdding(false);
    setShowAddAccount(false);
    setNewAcct({ name: '', industry: '', country: '', linkedin_url: '', revenue_millions: '' });
    await fetchAll();
    if (data) setSelectedId(data.id);
  }

  const filtered = accounts.filter(a => {
    const sig = a.signals || {};
    const tools = a.testing_tools || [];
    if (filterBy === 'legacy' && !tools.some(t => t.status === 'Legacy')) return false;
    if (filterBy === 'hiring' && !sig.hiringQA) return false;
    if (filterBy === 'funded' && !sig.funding) return false;
    if (filterBy === 'signals' && getSignalBadges(a).length === 0) return false;
    if (filterBy === 'notes' && !(a.notes || '').trim()) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!a.name?.toLowerCase().includes(s) && !a.industry?.toLowerCase().includes(s) && !a.country?.toLowerCase().includes(s)) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'score') return calcScore(b, contactsByAccount[b.id]) - calcScore(a, contactsByAccount[a.id]);
    if (sortBy === 'contacts') return (contactsByAccount[b.id]?.length || 0) - (contactsByAccount[a.id]?.length || 0);
    return a.name.localeCompare(b.name);
  });

  const selected = accounts.find(a => a.id === selectedId) || null;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* LEFT PANEL */}
      <div style={{ width: 300, minWidth: 260, borderRight: '1px solid #e8e8e4', display: 'flex', flexDirection: 'column', background: '#fafaf9' }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #e8e8e4' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Accounts</div>
              <div style={{ fontSize: 11, color: '#888' }}>{filtered.length} of {accounts.length} companies</div>
            </div>
            <button onClick={() => setShowAddAccount(true)}
              style={{ padding: '5px 11px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none' }}>
              + Add
            </button>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search accounts…"
            style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ flex: 1, fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer' }}>
              <option value="score">Sort: Score</option>
              <option value="contacts">Sort: Contacts</option>
              <option value="name">Sort: A–Z</option>
            </select>
            <select value={filterBy} onChange={e => setFilterBy(e.target.value)}
              style={{ flex: 1, fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer' }}>
              <option value="all">All Accounts</option>
              <option value="legacy">Legacy Tools</option>
              <option value="hiring">Hiring QA</option>
              <option value="funded">Funded</option>
              <option value="signals">Has Signals</option>
              <option value="notes">Has Notes</option>
            </select>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>No accounts found</div>
          ) : filtered.map(a => {
            const ctcs = contactsByAccount[a.id] || [];
            const score = calcScore(a, ctcs);
            const sc = scoreColor(score);
            const badges = getSignalBadges(a).slice(0, 2);
            const isSelected = a.id === selectedId;
            return (
              <div key={a.id} onClick={() => setSelectedId(a.id)}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f0f0ee',
                  background: isSelected ? '#eff6ff' : 'transparent',
                  borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {getInitials(a.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{ctcs.length} contact{ctcs.length !== 1 ? 's' : ''}{a.country ? ` · ${a.country}` : ''}{a.revenue_millions ? ` · $${Number(a.revenue_millions).toLocaleString()}M` : ''}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: sc.bg, color: sc.color, flexShrink: 0 }}>{score}</span>
                </div>
                {badges.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 5, marginLeft: 40 }}>
                    {badges.map(b => (
                      <span key={b.label} style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: b.bg, color: b.color }}>{b.label}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
        {!selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#aaa' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Select an account to view details</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>or click + Add to create one</div>
          </div>
        ) : (
          <AccountDetail key={selected.id} account={selected} contacts={contactsByAccount[selected.id] || []} onUpdate={fetchAll} navigate={navigate} />
        )}
      </div>

      {/* ADD ACCOUNT MODAL */}
      {showAddAccount && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setShowAddAccount(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 440, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Add Account</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'name', label: 'Company Name *', placeholder: 'e.g. Infosys' },
                { key: 'industry', label: 'Industry', placeholder: 'e.g. Banking, Insurance' },
                { key: 'country', label: 'Country', placeholder: 'e.g. India' },
                { key: 'linkedin_url', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/company/…' },
                { key: 'revenue_millions', label: 'Revenue (USD millions)', placeholder: 'e.g. 1500' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input value={newAcct[f.key]} onChange={e => setNewAcct({ ...newAcct, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={addAccount} disabled={adding || !newAcct.name.trim()}
                style={{ flex: 1, padding: '9px 0', background: '#2563eb', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', opacity: adding || !newAcct.name.trim() ? 0.6 : 1 }}>
                {adding ? 'Adding…' : 'Add Account'}
              </button>
              <button onClick={() => setShowAddAccount(false)}
                style={{ padding: '9px 18px', background: '#f5f5f5', color: '#555', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: 'none' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Account Detail Panel
function AccountDetail({ account, contacts, onUpdate, navigate }) {
  const [data, setData] = useState(account);
  const [saving, setSaving] = useState(false);
  const [editingLinkedIn, setEditingLinkedIn] = useState(false);
  const [linkedInDraft, setLinkedInDraft] = useState(account.linkedin_url || '');
  const [researchGenerating, setResearchGenerating] = useState({});
  const [newToolName, setNewToolName] = useState('');
  const [newToolStatus, setNewToolStatus] = useState('Legacy');
  const [showAddTool, setShowAddTool] = useState(false);
  const [newEnterpriseApp, setNewEnterpriseApp] = useState('');
  const [showAddEnterprise, setShowAddEnterprise] = useState(false);
  const [newSaasApp, setNewSaasApp] = useState('');
  const [showAddSaas, setShowAddSaas] = useState(false);
  const [newCustomSection, setNewCustomSection] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [notesValue, setNotesValue] = useState(account.notes || '');
  const notesTimer = useRef(null);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

  const score = calcScore(data, contacts);
  const sc = scoreColor(score);
  const linkedInGuess = data.linkedin_url ||
    `https://linkedin.com/company/${(data.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

  async function patch(updates) {
    setSaving(true);
    const merged = { ...data, ...updates };
    setData(merged);
    await supabase.from('accounts').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', data.id);
    setSaving(false);
    onUpdate();
  }

  async function addTool() {
    if (!newToolName.trim()) return;
    const tools = [...(data.testing_tools || []), { tool: newToolName.trim(), status: newToolStatus, addedAt: new Date().toISOString().slice(0, 10) }];
    await patch({ testing_tools: tools });
    setNewToolName(''); setShowAddTool(false);
  }
  async function removeTool(idx) { await patch({ testing_tools: (data.testing_tools || []).filter((_, i) => i !== idx) }); }
  async function updateToolStatus(idx, status) {
    await patch({ testing_tools: (data.testing_tools || []).map((t, i) => i === idx ? { ...t, status } : t) });
  }
  async function addEnterpriseApp(name) {
    if (!name.trim()) return;
    const apps = data.enterprise_apps || [];
    if (apps.find(a => a.app.toLowerCase() === name.toLowerCase())) return;
    await patch({ enterprise_apps: [...apps, { app: name.trim(), addedAt: new Date().toISOString().slice(0, 10) }] });
    setNewEnterpriseApp(''); setShowAddEnterprise(false);
  }
  async function removeEnterpriseApp(idx) { await patch({ enterprise_apps: (data.enterprise_apps || []).filter((_, i) => i !== idx) }); }
  async function addSaasApp() {
    if (!newSaasApp.trim()) return;
    const apps = data.saas_apps || [];
    if (apps.find(a => a.app.toLowerCase() === newSaasApp.toLowerCase())) return;
    await patch({ saas_apps: [...apps, { app: newSaasApp.trim(), addedAt: new Date().toISOString().slice(0, 10) }] });
    setNewSaasApp(''); setShowAddSaas(false);
  }
  async function removeSaasApp(idx) { await patch({ saas_apps: (data.saas_apps || []).filter((_, i) => i !== idx) }); }
  async function toggleSignal(key) {
    await patch({ signals: { ...(data.signals || {}), [key]: !data.signals?.[key] } });
  }
  async function saveResearch(key, value) {
    await patch({ research: { ...(data.research || {}), [key]: value } });
  }
  async function addCustomSection() {
    if (!newCustomSection.trim()) return;
    const custom = [...(data.custom_research || []), { key: `custom_${Date.now()}`, label: newCustomSection.trim(), value: '' }];
    await patch({ custom_research: custom });
    setNewCustomSection(''); setShowAddCustom(false);
  }
  async function removeCustomSection(idx) {
    await patch({ custom_research: (data.custom_research || []).filter((_, i) => i !== idx) });
  }
  async function saveCustomResearch(idx, value) {
    await patch({ custom_research: (data.custom_research || []).map((s, i) => i === idx ? { ...s, value } : s) });
  }
  function handleNotesChange(val) {
    setNotesValue(val);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => patch({ notes: val }), 800);
  }
  async function saveLinkedIn() { await patch({ linkedin_url: linkedInDraft }); setEditingLinkedIn(false); }

  async function generateResearch(key, label) {
    setResearchGenerating(g => ({ ...g, [key]: true }));
    try {
      const result = await supabase.functions.invoke('generate-research', {
        body: { account: { name: data.name, industry: data.industry, country: data.country, revenue_millions: data.revenue_millions, signals: data.signals, testing_tools: data.testing_tools }, sectionKey: key, sectionLabel: label }
      });
      if (!result.error && result.data?.text) {
        await saveResearch(key, result.data.text);
      }
    } catch(e) { console.error('Generate research error:', e); }
    setResearchGenerating(g => ({ ...g, [key]: false }));
  }

  const tools = data.testing_tools || [];
  const eApps = data.enterprise_apps || [];
  const saasApps = data.saas_apps || [];
  const signals = data.signals || {};
  const research = data.research || {};
  const customResearch = data.custom_research || [];

  return (
    <div style={{ padding: 24, maxWidth: 920 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, flexShrink: 0 }}>
          {getInitials(data.name)}
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>{data.name}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {data.revenue_millions ? `$${Number(data.revenue_millions).toLocaleString()}M · ` : ''}
            {data.country || ''}{data.industry ? ` · ${data.industry}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setShowScoreBreakdown(true)} title="Click to see breakdown" style={{ fontSize: 14, fontWeight: 700, padding: '4px 12px', borderRadius: 8, background: sc.bg, color: sc.color, border: 'none', cursor: 'pointer' }}>{score} ▾</button>
          {editingLinkedIn ? (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input value={linkedInDraft} onChange={e => setLinkedInDraft(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #2563eb', fontSize: 12, width: 220, outline: 'none' }}
                placeholder="https://linkedin.com/company/…" />
              <button onClick={saveLinkedIn} style={{ padding: '5px 10px', background: '#2563eb', color: '#fff', borderRadius: 6, fontSize: 12, border: 'none', cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditingLinkedIn(false)} style={{ padding: '5px 8px', background: '#f0f0f0', borderRadius: 6, fontSize: 12, border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 4 }}>
              <a href={linkedInGuess} target="_blank" rel="noopener noreferrer"
                style={{ padding: '5px 12px', background: '#0a66c2', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                🔗 LinkedIn
              </a>
              <button onClick={() => { setLinkedInDraft(data.linkedin_url || linkedInGuess); setEditingLinkedIn(true); }}
                style={{ padding: '5px 8px', background: '#f0f0f0', borderRadius: 7, fontSize: 11, border: 'none', cursor: 'pointer', color: '#555' }} title="Edit LinkedIn URL">✏️</button>
            </div>
          )}
          <button onClick={() => {
            const csv = contacts.map(c => `"${c.full_name}","${c.title || ''}","${c.email || ''}","${c.status}"`).join('\n');
            const blob = new Blob([`Name,Title,Email,Stage\n${csv}`], { type: 'text/csv' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = `${data.name.replace(/[^a-z0-9]/gi,'_')}.csv`; a.click();
          }} style={{ padding: '5px 12px', background: '#f5f5f5', borderRadius: 7, fontSize: 12, border: '1px solid #e0e0e0', cursor: 'pointer', color: '#555' }}>
            ⬇️ Export CSV
          </button>
          {saving && <span style={{ fontSize: 11, color: '#aaa' }}>Saving…</span>}
        </div>
      </div>

      {/* Signal badges */}
      {getSignalBadges(data).length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 16 }}>
          {getSignalBadges(data).map(b => (
            <span key={b.label} style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 10, background: b.bg, color: b.color }}>{b.label}</span>
          ))}
        </div>
      )}

      {/* Dashboard Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
        <div style={{ background: '#f8faff', border: '1px solid #dbeafe', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 3 }}>Total Contacts</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>{contacts.length}</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 3 }}>Contacted</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{contacts.filter(c => c.status !== 'Fresh').length}</div>
        </div>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 3 }}>Remaining</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#d97706' }}>{contacts.filter(c => c.status === 'Fresh').length}</div>
        </div>
        <div style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 3 }}>Warm / Prospect</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#7c3aed' }}>{contacts.filter(c => c.response === 'warm' || c.response === 'prospect').length}</div>
        </div>
      </div>
      {contacts.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          {['F1','F2','F3','F4','F5','won','lost','bounced','unsubscribed'].map(s => {
            const cnt = contacts.filter(c => c.status === s).length;
            if (!cnt) return null;
            const sc2 = STAGE_COLORS[s] || { bg: '#f1f5f9', color: '#475569' };
            return <span key={s} style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 10, background: sc2.bg, color: sc2.color }}>{s}: {cnt}</span>;
          })}
          {data.revenue_millions && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 10, background: '#f0f9ff', color: '#0369a1', marginLeft: 'auto' }}>
              💰 ${Number(data.revenue_millions).toLocaleString()}M revenue
            </span>
          )}
        </div>
      )}

      {/* 2-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>

        {/* Tech Stack — full width */}
        <div style={{ border: '1px solid #e8e8e4', borderRadius: 10, overflow: 'hidden', gridColumn: 'span 2' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #e8e8e4', background: '#fafaf9' }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>🔧 Tech Stack & Tools</span>
          </div>
          <div style={{ padding: '12px 14px' }}>
            {/* Testing Tools */}
            <SectionDivider label="⚙️ Testing Tools" onAdd={() => setShowAddTool(t => !t)} />
            {tools.length === 0 && !showAddTool && <div style={{ fontSize: 12, color: '#aaa', marginBottom: 10 }}>No tools recorded yet</div>}
            {tools.map((t, idx) => {
              const tc = TOOL_STATUS_COLORS[t.status] || TOOL_STATUS_COLORS.Active;
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 9px', borderRadius: 5, background: tc.bg, color: tc.color }}>
                    {t.status === 'Legacy' ? '⚠️' : '🔵'} {t.tool}
                  </span>
                  <select value={t.status} onChange={e => updateToolStatus(idx, e.target.value)}
                    style={{ fontSize: 11, padding: '2px 5px', borderRadius: 5, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer' }}>
                    {TOOL_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <button onClick={() => removeTool(idx)} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
              );
            })}
            {showAddTool && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 10px', background: '#f8faff', borderRadius: 7, border: '1px solid #dbeafe', marginBottom: 8 }}>
                <input value={newToolName} onChange={e => setNewToolName(e.target.value)}
                  placeholder="Tool name (e.g. Playwright, Selenium)"
                  onKeyDown={e => e.key === 'Enter' && addTool()}
                  style={{ flex: 1, minWidth: 140, padding: '5px 8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 12, outline: 'none' }} />
                <select value={newToolStatus} onChange={e => setNewToolStatus(e.target.value)}
                  style={{ padding: '5px 7px', fontSize: 12, borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer' }}>
                  {TOOL_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
                <button onClick={addTool} style={{ padding: '5px 12px', background: '#2563eb', color: '#fff', borderRadius: 6, fontSize: 12, border: 'none', cursor: 'pointer' }}>Add</button>
                <button onClick={() => setShowAddTool(false)} style={{ padding: '5px 8px', background: '#f0f0f0', borderRadius: 6, fontSize: 12, border: 'none', cursor: 'pointer' }}>Cancel</button>
              </div>
            )}

            {/* Enterprise Apps */}
            <SectionDivider label="🏢 Enterprise Apps" onAdd={() => setShowAddEnterprise(t => !t)} />
            {eApps.length === 0 && !showAddEnterprise && <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>No enterprise apps recorded</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {eApps.map((a, idx) => (
                <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 9px', borderRadius: 12, background: '#e0f2fe', color: '#0369a1', fontSize: 11, fontWeight: 600 }}>
                  {a.app}
                  <button onClick={() => removeEnterpriseApp(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', fontSize: 10, padding: 0 }}>✕</button>
                </span>
              ))}
            </div>
            {showAddEnterprise && (
              <div style={{ padding: '8px 10px', background: '#f8faff', borderRadius: 7, border: '1px solid #dbeafe', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input value={newEnterpriseApp} onChange={e => setNewEnterpriseApp(e.target.value)}
                    placeholder="App name (e.g. Guidewire)"
                    onKeyDown={e => e.key === 'Enter' && addEnterpriseApp(newEnterpriseApp)}
                    style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 12, outline: 'none' }} />
                  <button onClick={() => addEnterpriseApp(newEnterpriseApp)} style={{ padding: '5px 12px', background: '#2563eb', color: '#fff', borderRadius: 6, fontSize: 12, border: 'none', cursor: 'pointer' }}>Add</button>
                  <button onClick={() => setShowAddEnterprise(false)} style={{ padding: '5px 8px', background: '#f0f0f0', borderRadius: 6, fontSize: 12, border: 'none', cursor: 'pointer' }}>Cancel</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontSize: 10, color: '#888', alignSelf: 'center' }}>Quick add:</span>
                  {COMMON_ENTERPRISE_APPS.filter(a => !eApps.find(x => x.app === a)).map(a => (
                    <button key={a} onClick={() => addEnterpriseApp(a)}
                      style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, border: '1px dashed #0891b2', color: '#0891b2', background: 'none', cursor: 'pointer' }}>{a}</button>
                  ))}
                </div>
              </div>
            )}

            {/* SaaS Apps */}
            <SectionDivider label="📦 SaaS & Industry Apps" onAdd={() => setShowAddSaas(t => !t)} />
            {saasApps.length === 0 && !showAddSaas && <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>No SaaS apps recorded</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {saasApps.map((a, idx) => (
                <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 9px', borderRadius: 12, background: '#ede9fe', color: '#7c3aed', fontSize: 11, fontWeight: 600 }}>
                  {a.app}
                  <button onClick={() => removeSaasApp(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: 10, padding: 0 }}>✕</button>
                </span>
              ))}
            </div>
            {showAddSaas && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={newSaasApp} onChange={e => setNewSaasApp(e.target.value)}
                  placeholder="e.g. Temenos, Finastra"
                  onKeyDown={e => e.key === 'Enter' && addSaasApp()}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 12, outline: 'none' }} />
                <button onClick={addSaasApp} style={{ padding: '5px 12px', background: '#2563eb', color: '#fff', borderRadius: 6, fontSize: 12, border: 'none', cursor: 'pointer' }}>Add</button>
                <button onClick={() => setShowAddSaas(false)} style={{ padding: '5px 8px', background: '#f0f0f0', borderRadius: 6, fontSize: 12, border: 'none', cursor: 'pointer' }}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* Intent Signals */}
        <div style={{ border: '1px solid #e8e8e4', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #e8e8e4', background: '#fafaf9' }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>📡 Intent Signals</span>
            <span style={{ fontSize: 11, color: '#aaa', marginLeft: 8 }}>click to toggle</span>
          </div>
          <div style={{ padding: '12px 14px' }}>
            {SIGNAL_DEFS.map(s => {
              const active = !!signals[s.key];
              return (
                <div key={s.key} onClick={() => toggleSignal(s.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 7, cursor: 'pointer', marginBottom: 4,
                    background: active ? s.bg : '#fafaf9', border: `1px solid ${active ? s.color + '33' : '#f0f0ee'}`, transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 15 }}>{active ? s.icon : '○'}</span>
                  <span style={{ fontSize: 12, flex: 1, fontWeight: active ? 600 : 400, color: active ? s.color : '#666' }}>{s.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: active ? s.color : '#ccc' }}>{active ? 'ON' : 'OFF'}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Account Notes */}
        <div style={{ border: '1px solid #e8e8e4', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #e8e8e4', background: '#fafaf9' }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>📝 Account Notes</span>
          </div>
          <div style={{ padding: '12px 14px' }}>
            <textarea value={notesValue} onChange={e => handleNotesChange(e.target.value)}
              placeholder="Add intel: tech stack, deal status, pain points, next steps…"
              rows={7}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 12, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#333' }} />
          </div>
        </div>

        {/* Research sections */}
        {RESEARCH_DEFAULTS.map(r => (
          <ResearchCard key={r.key} label={r.label} value={research[r.key] || ''}
            generating={!!researchGenerating[r.key]}
            onGenerate={() => generateResearch(r.key, r.label)}
            onSave={val => saveResearch(r.key, val)} />
        ))}

        {/* Custom sections */}
        {customResearch.map((s, idx) => (
          <ResearchCard key={s.key} label={s.label} value={s.value || ''}
            generating={false} onGenerate={() => {}}
            onSave={val => saveCustomResearch(idx, val)}
            onRemove={() => removeCustomSection(idx)} />
        ))}

        {/* Add custom section tile */}
        <div style={{ border: '1px dashed #d0d0d0', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 90, cursor: showAddCustom ? 'default' : 'pointer' }}
          onClick={() => !showAddCustom && setShowAddCustom(true)}>
          {showAddCustom ? (
            <div style={{ width: '100%', display: 'flex', gap: 6 }}>
              <input value={newCustomSection} onChange={e => setNewCustomSection(e.target.value)}
                placeholder="Section name (e.g. Competitor Landscape)"
                autoFocus onKeyDown={e => e.key === 'Enter' && addCustomSection()}
                style={{ flex: 1, padding: '6px 10px', borderRadius: 7, border: '1px solid #2563eb', fontSize: 12, outline: 'none' }} />
              <button onClick={addCustomSection} style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: 12, border: 'none', cursor: 'pointer' }}>Add</button>
              <button onClick={() => setShowAddCustom(false)} style={{ padding: '6px 8px', background: '#f0f0f0', borderRadius: 7, fontSize: 12, border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <>
              <span style={{ fontSize: 24, color: '#d0d0d0' }}>+</span>
              <span style={{ fontSize: 12, color: '#aaa' }}>Add custom research section</span>
            </>
          )}
        </div>
      </div>

      {/* Contacts list */}
      <div style={{ border: '1px solid #e8e8e4', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #e8e8e4', background: '#fafaf9' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Contacts ({contacts.length})</span>
        </div>
        {contacts.length === 0 ? (
          <div style={{ padding: '20px 14px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>No contacts linked to this account</div>
        ) : contacts.map(c => {
          const sc2 = STAGE_COLORS[c.status] || { bg: '#f1f5f9', color: '#475569' };
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f0f0ee' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.full_name}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{[c.title, c.seniority].filter(Boolean).join(' · ')}</div>
                {c.pitch && <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>"{c.pitch}"</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: sc2.bg, color: sc2.color }}>{c.status}</span>
                {c.email ? (
                  <span style={{ fontSize: 11, color: '#555', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.email}>✉️ {c.email}</span>
                ) : (
                  <button onClick={() => window.open(`https://app.apollo.io/#/people?name=${encodeURIComponent(c.full_name)}&organization_name=${encodeURIComponent(data.name)}`, '_blank')}
                    style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, border: '1px dashed #d97706', background: 'none', color: '#d97706', cursor: 'pointer' }}>
                    🔍 Find Email
                  </button>
                )}
                <button onClick={() => navigate(`/contacts/${c.id}`, { state: { from: 'account', accountId: data.id, accountName: data.name } })}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', color: '#2563eb', cursor: 'pointer', fontWeight: 500 }}>
                  View →
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {/* Score Breakdown Popup */}
      {showScoreBreakdown && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowScoreBreakdown(false)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 380, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>Score Breakdown</div>
              <button onClick={() => setShowScoreBreakdown(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 36, fontWeight: 800, padding: '8px 20px', borderRadius: 12, background: sc.bg, color: sc.color }}>{score}</span>
            </div>
            {[
              { label: '🔧 Tool Fit', pts: tools.some(t => t.status === 'Legacy') ? 30 : tools.some(t => t.status === 'Evaluating') ? 20 : tools.length > 0 ? 15 : 0, max: 30,
                detail: tools.some(t => t.status === 'Legacy') ? `Legacy: ${tools.filter(t=>t.status==='Legacy').map(t=>t.tool).join(', ')}` : tools.some(t=>t.status==='Evaluating') ? 'Evaluating tools' : tools.length > 0 ? 'Modern tools' : 'No tools recorded' },
              { label: '📡 Intent Signals', pts: Math.min([signals.hiringQA&&10,signals.funding&&10,signals.outage&&8,signals.recentLaunch&&6,signals.leadershipChange&&6,signals.cicd&&5].filter(Boolean).reduce((a,b)=>a+b,0),45), max: 45,
                detail: SIGNAL_DEFS.filter(s=>signals[s.key]).map(s=>s.label).join(', ') || 'No signals active' },
              { label: '💬 Engagement', pts: Math.min(contacts.filter(c=>c.response==='warm'||c.response==='prospect').length*5,15), max: 15,
                detail: `${contacts.filter(c=>c.response==='warm'||c.response==='prospect').length} warm/prospect contacts` },
              { label: '🔬 Research', pts: Math.min(Object.values(data.research||{}).filter(v=>v&&v.length>10).length*2,10), max: 10,
                detail: `${Object.values(data.research||{}).filter(v=>v&&v.length>10).length} research sections filled` },
            ].map(row => (
              <div key={row.label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.pts > 0 ? '#2563eb' : '#ccc' }}>{row.pts}<span style={{ fontSize: 11, fontWeight: 400, color: '#aaa' }}>/{row.max}</span></span>
                </div>
                <div style={{ height: 6, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', marginBottom: 3 }}>
                  <div style={{ height: '100%', width: `${row.max > 0 ? (row.pts/row.max)*100 : 0}%`, background: row.pts > 0 ? '#2563eb' : '#f0f0f0', borderRadius: 4, transition: 'width 0.4s' }} />
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>{row.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function SectionDivider({ label, onAdd }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 7px', paddingTop: 10, borderTop: '1px solid #f0f0ee' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <button onClick={onAdd}
        style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, border: '1px dashed #2563eb', color: '#2563eb', background: 'none', cursor: 'pointer' }}>+ Add</button>
    </div>
  );
}

function ResearchCard({ label, value, generating, onGenerate, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  return (
    <div style={{ border: '1px solid #e8e8e4', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #e8e8e4', background: '#fafaf9', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{label}</span>
        {onRemove && (
          <button onClick={onRemove} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }} title="Remove section">✕</button>
        )}
        <button onClick={onGenerate} disabled={generating}
          style={{ padding: '3px 10px', background: generating ? '#e0e0e0' : '#7c3aed', color: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none', cursor: generating ? 'wait' : 'pointer' }}>
          {generating ? '⏳' : '✨ Generate'}
        </button>
      </div>
      <div style={{ padding: '10px 14px', minHeight: 60 }}>
        {editing ? (
          <div>
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4}
              style={{ width: '100%', padding: '7px 9px', borderRadius: 7, border: '1px solid #2563eb', fontSize: 12, lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={() => { onSave(draft); setEditing(false); }}
                style={{ padding: '4px 12px', background: '#2563eb', color: '#fff', borderRadius: 6, fontSize: 11, border: 'none', cursor: 'pointer' }}>Save</button>
              <button onClick={() => { setDraft(value); setEditing(false); }}
                style={{ padding: '4px 10px', background: '#f0f0f0', borderRadius: 6, fontSize: 11, border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div onClick={() => setEditing(true)}
            style={{ fontSize: 12, lineHeight: 1.6, color: value ? '#333' : '#bbb', cursor: 'text', minHeight: 40, whiteSpace: 'pre-wrap' }}>
            {value || 'Click to write manually, or click ✨ Generate'}
          </div>
        )}
      </div>
    </div>
  );
}
