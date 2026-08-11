import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const LEGACY_TOOLS = ['selenium','uft','tosca','soapui','qtp','silktest','winrunner','loadrunner','jmeter','rational'];
const MODERN_TOOLS = ['cypress','playwright','webdriverio','testcafe','k6','appium','detox','jest','pytest','robot framework'];
const TOOL_STATUS_OPTIONS = ['Legacy','Modern','Evaluating','Pain Point','Active'];
const TOOL_STATUS_COLORS = {
  Legacy:       { bg: '#fee2e2', color: '#dc2626' },
  Modern:       { bg: '#e0f2fe', color: '#0369a1' },
  Evaluating:   { bg: '#fef3c7', color: '#d97706' },
  'Pain Point': { bg: '#fce7f3', color: '#9d174d' },
  Active:       { bg: '#dcfce7', color: '#16a34a' },
};
const SIGNAL_DEFS = [
  { key: 'funding',          icon: 'Ã°ÂÂÂ°', label: 'Recent Funding / IPO',      color: '#059669', bg: '#d1fae5' },
  { key: 'hiringQA',         icon: 'Ã°ÂÂÂ¥', label: 'Hiring QA / SDET',          color: '#7c3aed', bg: '#ede9fe' },
  { key: 'recentLaunch',     icon: 'Ã°ÂÂÂ', label: 'Recent Product Launch',     color: '#0891b2', bg: '#e0f2fe' },
  { key: 'leadershipChange', icon: 'Ã°ÂÂÂ¤', label: 'Leadership Change',         color: '#d97706', bg: '#fef3c7' },
  { key: 'outage',           icon: 'Ã¢ÂÂ Ã¯Â¸Â',  label: 'Outage / Quality Incident', color: '#dc2626', bg: '#fee2e2' },
  { key: 'cicd',             icon: 'Ã¢ÂÂÃ¯Â¸Â',  label: 'Active CI/CD Pipeline',    color: '#475569', bg: '#f1f5f9' },
];
const RESEARCH_DEFAULTS = [
  { key: 'whyTarget',  label: 'Why Target',        icon: 'Ã°ÂÂÂ¯', hint: 'why this company is a good fit for ACCELQ test automation' },
  { key: 'techStack',  label: 'Tech Stack',        icon: 'Ã°ÂÂÂ§', hint: 'known languages, frameworks, CI/CD, cloud, testing tools' },
  { key: 'qaHiring',   label: 'QA Hiring Signals', icon: 'Ã°ÂÂÂ¥', hint: 'likelihood of hiring QA/automation engineers: Low/Med/High with reason' },
  { key: 'recentNews', label: 'Recent News',       icon: 'Ã°ÂÂÂ°', hint: 'one relevant news item, funding, or digital transformation initiative' },
  { key: 'painPoints', label: 'Pain Points',       icon: 'Ã°ÂÂÂ¥', hint: 'top 2 QA/testing pain points ACCELQ solves for this company' },
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
  bounced:      { bg: '#fce7f3', color: '#9d174d' },
  unsubscribed: { bg: '#f3f4f6', color: '#6b7280' },
};
const AVATAR_PALETTE = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#9333ea','#16a34a','#c2410c','#0f766e'];

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name||'').length; i++) h = (name.charCodeAt(i) + ((h << 5) - h)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
function scoreColor(s) {
  if (s >= 80) return { bg: '#dcfce7', color: '#15803d', bar: '#16a34a' };
  if (s >= 60) return { bg: '#d1fae5', color: '#065f46', bar: '#059669' };
  if (s >= 40) return { bg: '#fef3c7', color: '#92400e', bar: '#d97706' };
  return { bg: '#fee2e2', color: '#991b1b', bar: '#dc2626' };
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
  const replied = (contacts || []).filter(c => c.response_type === 'warm' || c.response_type === 'prospect').length;
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
  if (tools.some(t => t.status === 'Legacy')) badges.push({ label: 'Ã¢ÂÂ Ã¯Â¸Â Legacy Tool', color: '#dc2626', bg: '#fee2e2' });
  if (sig.hiringQA) badges.push({ label: 'Ã°ÂÂÂ¥ Hiring QA', color: '#7c3aed', bg: '#ede9fe' });
  if (sig.funding) badges.push({ label: 'Ã°ÂÂÂ° Funded', color: '#059669', bg: '#d1fae5' });
  if (sig.outage) badges.push({ label: 'Ã¢ÂÂ Ã¯Â¸Â Outage', color: '#dc2626', bg: '#fee2e2' });
  if (sig.leadershipChange) badges.push({ label: 'Ã°ÂÂÂ¤ New Leader', color: '#d97706', bg: '#fef3c7' });
  return badges;
}

/* Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ FILTER PILL Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */
function FilterPill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
      background: active ? '#2563eb' : '#f0f0ee', color: active ? '#fff' : '#666', transition: 'all 0.15s',
      whiteSpace: 'nowrap',
    }}>{label}</button>
  );
}

/* Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ MAIN COMPONENT Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */
export default function Accounts() {
  const { user, profile } = useAuth();
  const canViewAll = ['director', 'manager'].includes(profile?.role);
  const [viewAll, setViewAll] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [accounts, setAccounts] = useState([]);
  const [hqsList, setHqsList] = useState([]);
  const [hqReassignModal, setHqReassignModal] = useState(false);
  const [hqReassignTarget, setHqReassignTarget] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState(new Set());
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
    let aQ = supabase.from('accounts').select('*');
    let cQ = supabase.from('contacts').select('id, account_id, first_name, last_name, title, status, response_type, response_state, email, notes, next_followup, linkedin_url, sender_email');
    if (!viewAll || !canViewAll) { aQ = aQ.eq('owner_id', user.id); cQ = cQ.eq('owner_id', user.id); }
    const [{ data: accs }, { data: cts }] = await Promise.all([aQ, cQ]);
    const byAcct = {};
    (cts || []).forEach(c => {
      if (c.account_id) { if (!byAcct[c.account_id]) byAcct[c.account_id] = []; byAcct[c.account_id].push(c); }
    });
    setContactsByAccount(byAcct);
    setAccounts(accs || []);
    supabase.from('hqs').select('id,name').then(({data}) => setHqsList(data||[]));
    setLoading(false);
  }, [user.id, viewAll, canViewAll]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    if (location.state?.selectId) { setSelectedId(location.state.selectId); window.history.replaceState({}, ''); }
  }, [location.state]);

  async function reassignToHQ(hqId) {
    if(!hqId || selectedAccounts.size===0) return;
    await supabase.from('accounts').update({ hq_id: hqId }).in('id', [...selectedAccounts]);
    setSelectedAccounts(new Set());
    setHqReassignModal(false);
    setHqReassignTarget('');
    // Re-fetch accounts
    const { data } = await supabase.from('accounts').select('*').order('name', { ascending: true });
    setAccounts(data || []);
  }

  async function addAccount() {
    if (!newAcct.name.trim()) return;
    setAdding(true);
    const { data } = await supabase.from('accounts').insert({
      name: newAcct.name.trim(), industry: newAcct.industry || null, country: newAcct.country || null,
      linkedin_url: newAcct.linkedin_url || null,
      revenue_millions: newAcct.revenue_millions ? parseFloat(newAcct.revenue_millions) : null,
      owner_id: user.id,
    }).select().single();
    setAdding(false); setShowAddAccount(false);
    setNewAcct({ name: '', industry: '', country: '', linkedin_url: '', revenue_millions: '' });
    await fetchAll();
    if (data) setSelectedId(data.id);
  }

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'legacy', label: 'Ã¢ÂÂ Ã¯Â¸Â Legacy' },
    { key: 'hiring', label: 'Ã°ÂÂÂ¥ Hiring QA' },
    { key: 'funded', label: 'Ã°ÂÂÂ° Funded' },
    { key: 'signals', label: 'Ã°ÂÂÂ¡ Signals' },
    { key: 'notes', label: 'Ã°ÂÂÂ Notes' },
  ];

  const filtered = accounts.filter(a => {
    const sig = a.signals || {}; const tools = a.testing_tools || [];
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
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden', background: '#f8f9fb' }}>

      {/* Ã¢ÂÂÃ¢ÂÂ LEFT PANEL Ã¢ÂÂÃ¢ÂÂ */}
      <div style={{ width: 300, minWidth: 260, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fff' }}>

        {/* Header */}
        <div style={{ padding: '16px 14px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111', letterSpacing: '-0.2px' }}>
                  {viewAll && canViewAll ? 'All Accounts' : 'Accounts'}
                </div>
                {canViewAll && (
                  <button onClick={() => setViewAll(v => !v)}
                    style={{ padding: '2px 8px', borderRadius: 20, border: '1px solid #e0e0e0',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      background: viewAll ? '#111' : '#fff', color: viewAll ? '#fff' : '#555' }}>
                    {viewAll ? 'Team' : 'All'}
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{filtered.length} of {accounts.length} companies</div>
            </div>
            <button onClick={() => setShowAddAccount(true)} style={{
              padding: '6px 14px', background: '#2563eb', color: '#fff', borderRadius: 8,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', letterSpacing: '0.01em',
            }}>+ Add</button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9ca3af', pointerEvents: 'none' }}>Ã°ÂÂÂ</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accountsÃ¢ÂÂ¦"
              style={{ width: '100%', padding: '7px 10px 7px 28px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#f9fafb', color: '#111' }} />
          </div>

          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
            width: '100%', fontSize: 11, padding: '5px 8px', borderRadius: 7, border: '1px solid #e5e7eb',
            background: '#f9fafb', cursor: 'pointer', color: '#555', marginBottom: 10,
          }}>
            <option value="score">Ã¢ÂÂ Sort by Score</option>
            <option value="contacts">Ã¢ÂÂ Sort by Contacts</option>
            <option value="name">Ã¢ÂÂ Sort AÃ¢ÂÂZ</option>
          </select>

          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {FILTERS.map(f => <FilterPill key={f.key} label={f.label} active={filterBy === f.key} onClick={() => setFilterBy(f.key)} />)}
          </div>
        </div>

        {/* Account list */}
        <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #f3f4f6' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>LoadingÃ¢ÂÂ¦</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No accounts found</div>
          ) : filtered.map(a => {
            const ctcs = contactsByAccount[a.id] || [];
            const score = calcScore(a, ctcs);
            const sc = scoreColor(score);
            const isSelected = a.id === selectedId;
            const ac = avatarColor(a.name);
            const signals = a.signals || {};
            const activeSignalCount = SIGNAL_DEFS.filter(s => signals[s.key]).length;
            return (
              <div key={a.id} onClick={() => setSelectedId(a.id)} style={{
                padding: '11px 14px', cursor: 'pointer',
                borderBottom: '1px solid #f3f4f6',
                background: isSelected ? '#eff6ff' : 'white',
                borderLeft: `3px solid ${isSelected ? '#2563eb' : 'transparent'}`,
                transition: 'background 0.1s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Avatar */}
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: ac, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, letterSpacing: '0.5px' }}>
                    {getInitials(a.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                      {ctcs.length} contact{ctcs.length !== 1 ? 's' : ''}
                      {a.industry ? ` ÃÂ· ${a.industry}` : ''}
                      {a.country ? ` ÃÂ· ${a.country}` : ''}
                    </div>
                  </div>
                  {/* Score badge */}
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: sc.color }}>{score}</div>
                    <div style={{ width: 28, height: 3, borderRadius: 2, background: '#f0f0f0', marginTop: 2 }}>
                      <div style={{ width: `${score}%`, height: '100%', borderRadius: 2, background: sc.bar }} />
                    </div>
                  </div>
                  {(()=>{ const w=ctcs.filter(c=>c.response_state==='Warm'||c.response_state==='Lead').length; const p=ctcs.filter(c=>c.response_state==='Prospecting').length; return (w||p) ? <div style={{display:'flex',flexDirection:'column',gap:2,flexShrink:0}}>{w>0&&<span style={{fontSize:10,fontWeight:700,color:'#059669',background:'#d1fae5',padding:'1px 5px',borderRadius:6}}>{w}ð¢</span>}{p>0&&<span style={{fontSize:10,fontWeight:700,color:'#d97706',background:'#fef3c7',padding:'1px 5px',borderRadius:6}}>{p}ð¡</span>}</div> : null; })()}
                </div>
                {/* Signal + revenue row */}
                {(activeSignalCount > 0 || a.revenue_millions) && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 7, marginLeft: 46, flexWrap: 'wrap' }}>
                    {SIGNAL_DEFS.filter(s => signals[s.key]).slice(0, 3).map(s => (
                      <span key={s.key} style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 8, background: s.bg, color: s.color }}>{s.icon} {s.label.split('/')[0].trim()}</span>
                    ))}
                    {a.revenue_millions && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 8, background: '#f0f9ff', color: '#0369a1' }}>
                        ${Number(a.revenue_millions).toLocaleString()}M
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Ã¢ÂÂÃ¢ÂÂ RIGHT PANEL Ã¢ÂÂÃ¢ÂÂ */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f8f9fb' }}>
        {!selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>Ã°ÂÂÂ¢</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>Select an account</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>or click + Add to create one</div>
          </div>
        ) : (
          <AccountDetail key={selected.id} account={selected} contacts={contactsByAccount[selected.id] || []} onUpdate={fetchAll} navigate={navigate} hqsList={hqsList} />
        )}
      </div>

      {/* Ã¢ÂÂÃ¢ÂÂ ADD ACCOUNT MODAL Ã¢ÂÂÃ¢ÂÂ */}
      {showAddAccount && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setShowAddAccount(false)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 460, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: '#111' }}>Add Account</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'name', label: 'Company Name *', placeholder: 'e.g. Infosys' },
                { key: 'industry', label: 'Industry', placeholder: 'e.g. Banking, Insurance' },
                { key: 'country', label: 'Country', placeholder: 'e.g. India' },
                { key: 'linkedin_url', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/company/Ã¢ÂÂ¦' },
                { key: 'revenue_millions', label: 'Revenue (USD millions)', placeholder: 'e.g. 1500' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 5, fontWeight: 500 }}>{f.label}</label>
                  <input value={newAcct[f.key]} onChange={e => setNewAcct({ ...newAcct, [f.key]: e.target.value })} placeholder={f.placeholder}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', transition: 'border 0.15s' }}
                    onFocus={e => e.target.style.borderColor = '#2563eb'}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={addAccount} disabled={adding || !newAcct.name.trim()} style={{
                flex: 1, padding: '10px 0', background: '#2563eb', color: '#fff', borderRadius: 9, fontSize: 13,
                fontWeight: 600, cursor: 'pointer', border: 'none', opacity: adding || !newAcct.name.trim() ? 0.6 : 1,
              }}>{adding ? 'AddingÃ¢ÂÂ¦' : 'Add Account'}</button>
              <button onClick={() => setShowAddAccount(false)} style={{
                padding: '10px 20px', background: '#f5f5f5', color: '#555', borderRadius: 9, fontSize: 13, cursor: 'pointer', border: 'none',
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */
/*  ACCOUNT DETAIL                                            */
/* Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */
function AccountDetail({ account, contacts, onUpdate, navigate, hqsList = [] }) {
  const { user, profile } = useAuth();
  const canViewAll = ['director', 'manager'].includes(profile?.role);
  const [viewAll, setViewAll] = useState(false);
  const [data, setData] = useState(account);
  const [qualifying, setQualifying] = useState(null); // contact id being qualified
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [editingLinkedIn, setEditingLinkedIn] = useState(false);
  const [linkedInDraft, setLinkedInDraft] = useState(account.linkedin_url || '');
  const [researchGenerating, setResearchGenerating] = useState({});
  const [aiResearching, setAiResearching] = useState(false);
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
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const notesTimer = useRef(null);

  const score = calcScore(data, contacts);
  const sc = scoreColor(score);
  const ac = avatarColor(data.name);
  const linkedInGuess = data.linkedin_url || `https://linkedin.com/company/${(data.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

  const tools = data.testing_tools || [];
  const eApps = data.enterprise_apps || [];
  const saasApps = data.saas_apps || [];
  const signals = data.signals || {};
  const research = data.research || {};
  const customResearch = data.custom_research || [];

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
    await patch({ testing_tools: [...tools, { tool: newToolName.trim(), status: newToolStatus, addedAt: new Date().toISOString().slice(0, 10) }] });
    setNewToolName(''); setShowAddTool(false);
  }
  async function removeTool(idx) { await patch({ testing_tools: tools.filter((_, i) => i !== idx) }); }
  async function updateToolStatus(idx, status) { await patch({ testing_tools: tools.map((t, i) => i === idx ? { ...t, status } : t) }); }
  async function addEnterpriseApp(name) {
    if (!name.trim() || eApps.find(a => a.app.toLowerCase() === name.toLowerCase())) return;
    await patch({ enterprise_apps: [...eApps, { app: name.trim(), addedAt: new Date().toISOString().slice(0, 10) }] });
    setNewEnterpriseApp(''); setShowAddEnterprise(false);
  }
  async function removeEnterpriseApp(idx) { await patch({ enterprise_apps: eApps.filter((_, i) => i !== idx) }); }
  async function addSaasApp() {
    if (!newSaasApp.trim() || saasApps.find(a => a.app.toLowerCase() === newSaasApp.toLowerCase())) return;
    await patch({ saas_apps: [...saasApps, { app: newSaasApp.trim(), addedAt: new Date().toISOString().slice(0, 10) }] });
    setNewSaasApp(''); setShowAddSaas(false);
  }
  async function removeSaasApp(idx) { await patch({ saas_apps: saasApps.filter((_, i) => i !== idx) }); }
  async function toggleSignal(key) { await patch({ signals: { ...signals, [key]: !signals[key] } }); }
  async function saveResearch(key, value) { await patch({ research: { ...research, [key]: value } }); }
  async function addCustomSection() {
    if (!newCustomSection.trim()) return;
    await patch({ custom_research: [...customResearch, { key: `custom_${Date.now()}`, label: newCustomSection.trim(), value: '' }] });
    setNewCustomSection(''); setShowAddCustom(false);
  }
  async function removeCustomSection(idx) { await patch({ custom_research: customResearch.filter((_, i) => i !== idx) }); }
  async function saveCustomResearch(idx, value) { await patch({ custom_research: customResearch.map((s, i) => i === idx ? { ...s, value } : s) }); }
  function handleNotesChange(val) {
    setNotesValue(val);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => patch({ notes: val }), 800);
  }
  async function saveLinkedIn() { await patch({ linkedin_url: linkedInDraft }); setEditingLinkedIn(false); }

  async function startContact(c) {
    setQualifying(c.id);
    // Keep status as Fresh Ã¢ÂÂ contact will appear in Follow-up Queue "New Contacts" section
    const now = new Date().toISOString();
    await supabase.from('contacts').update({
      status: 'Fresh',
      next_followup: now,  // mark as "ready to start" so queue picks it up
    }).eq('id', c.id);
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: c.id,
      activity_type: 'outreach_started', details: { started_from: 'accounts' }
    });
    setQualifying(null);
    onUpdate();
  }
  async function generateResearch(key, label) {
    setResearchGenerating(g => ({ ...g, [key]: true }));
    try {
      const result = await supabase.functions.invoke('generate-research', {
        body: { account: { name: data.name, industry: data.industry, country: data.country, revenue_millions: data.revenue_millions, signals: data.signals, testing_tools: data.testing_tools }, sectionKey: key, sectionLabel: label }
      });
      if (!result.error && result.data?.text) await saveResearch(key, result.data.text);
    } catch(e) { console.error(e); }
    setResearchGenerating(g => ({ ...g, [key]: false }));
  }
  async function generateAll() {
    for (const r of RESEARCH_DEFAULTS) {
      if (!research[r.key]) await generateResearch(r.key, r.label);
    }
  }
  async function runFullAIResearch() {
    setAiResearching(true);
    try {
      const result = await supabase.functions.invoke('generate-research', {
        body: {
          mode: 'full',
          account: {
            name: data.name,
            industry: data.industry,
            country: data.country,
            revenue_millions: data.revenue_millions,
            notes: data.notes,
            testing_tools: data.testing_tools,
            contacts: contacts.slice(0, 5).map(c => ({ full_name: (c.first_name + ' ' + (c.last_name || '')).trim(), title: c.title })),
          }
        }
      });
      if (result.error || !result.data?.full) {
        console.error('AI Research error:', result.error || result.data?.error);
        return;
      }
      const r = result.data.full;
      const updates = {};
      // Research text sections
      const newResearch = { ...research };
      if (r.why)  { newResearch.whyTarget  = r.why; }
      if (r.tech) { newResearch.techStack   = r.tech; }
      if (r.qaHiring) { newResearch.qaHiring = r.qaHiring; }
      if (r.news) { newResearch.recentNews  = r.news; }
      if (r.pain) { newResearch.painPoints  = r.pain; }
      updates.research = newResearch;
      // Testing tools Ã¢ÂÂ merge with existing, don't overwrite manually added ones
      if (Array.isArray(r.tools) && r.tools.length > 0) {
        const existingNames = (data.testing_tools || []).map(t => t.tool.toLowerCase());
        const newTools = r.tools
          .filter(t => !existingNames.includes(t.toLowerCase()))
          .map(t => ({ tool: t, status: 'Legacy', addedAt: new Date().toISOString().slice(0, 10), source: 'ai' }));
        if (newTools.length > 0) {
          updates.testing_tools = [...(data.testing_tools || []), ...newTools];
        }
      }
      // Enterprise apps Ã¢ÂÂ merge
      if (Array.isArray(r.enterpriseApps) && r.enterpriseApps.length > 0) {
        const existingApps = (data.enterprise_apps || []).map(a => a.app.toLowerCase());
        const newApps = r.enterpriseApps
          .filter(a => !existingApps.includes(a.toLowerCase()))
          .map(a => ({ app: a, addedAt: new Date().toISOString().slice(0, 10), source: 'ai' }));
        if (newApps.length > 0) {
          updates.enterprise_apps = [...(data.enterprise_apps || []), ...newApps];
        }
      }
      // SaaS apps Ã¢ÂÂ merge
      if (Array.isArray(r.saasApps) && r.saasApps.length > 0) {
        const existingSaas = (data.saas_apps || []).map(a => a.app.toLowerCase());
        const newSaas = r.saasApps
          .filter(a => !existingSaas.includes(a.toLowerCase()))
          .map(a => ({ app: a, addedAt: new Date().toISOString().slice(0, 10), source: 'ai' }));
        if (newSaas.length > 0) {
          updates.saas_apps = [...(data.saas_apps || []), ...newSaas];
        }
      }
      // Intent signals Ã¢ÂÂ merge (only set true, don't clear existing trues)
      const sigMap = { funding: 'funding', hiringQA: 'hiringQA', launch: 'recentLaunch', leadership: 'leadershipChange', outage: 'outage', cicd: 'cicd' };
      const newSignals = { ...signals };
      let signalsChanged = false;
      for (const [aiKey, sigKey] of Object.entries(sigMap)) {
        if (r[aiKey] === true && !newSignals[sigKey]) { newSignals[sigKey] = true; signalsChanged = true; }
      }
      if (signalsChanged) updates.signals = newSignals;
      await patch(updates);
    } catch(e) { console.error('runFullAIResearch error:', e); }
    setAiResearching(false);
  }

  const TABS = [
    { key: 'overview',  label: 'Overview'  },
    { key: 'contacts',  label: `Contacts ${contacts.length > 0 ? `(${contacts.length})` : ''}` },
    { key: 'techstack', label: 'Tech Stack' },
    { key: 'research',  label: 'Research'  },
    { key: 'notes',     label: 'Notes'     },
    { key: 'responses', label: 'Responses' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Ã¢ÂÂÃ¢ÂÂ STICKY HEADER Ã¢ÂÂÃ¢ÂÂ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '18px 24px 0', position: 'sticky', top: 0, zIndex: 10 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: ac, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0, letterSpacing: '0.5px' }}>
            {getInitials(data.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111', letterSpacing: '-0.3px' }}>{data.name}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.industry && <span>Ã°ÂÂÂ­ {data.industry}</span>}
              {data.country && <span>Ã°ÂÂÂ {data.country}</span>}
              {data.revenue_millions && <span>Ã°ÂÂÂ° ${Number(data.revenue_millions).toLocaleString()}M</span>}
            </div>
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            <button onClick={() => setShowScoreBreakdown(true)} title="Score breakdown" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8,
              background: sc.bg, color: sc.color, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
            }}>{score} <span style={{ fontSize: 10 }}>Ã¢ÂÂ¾</span></button>
            {editingLinkedIn ? (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <input value={linkedInDraft} onChange={e => setLinkedInDraft(e.target.value)}
                  style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid #2563eb', fontSize: 12, width: 200, outline: 'none' }}
                  placeholder="https://linkedin.com/company/Ã¢ÂÂ¦" />
                <button onClick={saveLinkedIn} style={{ padding: '6px 11px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: 12, border: 'none', cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditingLinkedIn(false)} style={{ padding: '6px 9px', background: '#f0f0f0', borderRadius: 7, fontSize: 12, border: 'none', cursor: 'pointer' }}>Ã¢ÂÂ</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 4 }}>
                <a href={linkedInGuess} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 13px', background: '#0a66c2', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                  Ã°ÂÂÂ LinkedIn
                </a>
                <button onClick={() => { setLinkedInDraft(data.linkedin_url || linkedInGuess); setEditingLinkedIn(true); }}
                  style={{ padding: '6px 9px', background: '#f5f5f5', borderRadius: 8, fontSize: 11, border: '1px solid #e5e7eb', cursor: 'pointer', color: '#555' }}>Ã¢ÂÂÃ¯Â¸Â</button>
              </div>
            )}
            <button onClick={() => {
              const csv = contacts.map(c => `"${(c.first_name + ' ' + (c.last_name || '')).trim()}","${c.title || ''}","${c.email || ''}","${c.status}"`).join('\n');
              const blob = new Blob([`Name,Title,Email,Stage\n${csv}`], { type: 'text/csv' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = `${data.name.replace(/[^a-z0-9]/gi,'_')}.csv`; a.click();
            }} style={{ padding: '6px 13px', background: '#f5f5f5', borderRadius: 8, fontSize: 12, border: '1px solid #e5e7eb', cursor: 'pointer', color: '#555' }}>
              Ã¢Â¬ÂÃ¯Â¸Â Export
            </button>
            <button onClick={runFullAIResearch} disabled={aiResearching} title="AI populates tools, apps, signals & research in one shot" style={{
              padding: '6px 14px', background: aiResearching ? '#e5e7eb' : 'linear-gradient(135deg, #7c3aed, #2563eb)',
              color: aiResearching ? '#9ca3af' : '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: aiResearching ? 'wait' : 'pointer', whiteSpace: 'nowrap',
            }}>
              {aiResearching ? 'Ã¢ÂÂ³ ResearchingÃ¢ÂÂ¦' : 'Ã°ÂÂ¤Â AI Research'}
            </button>
            {saving && <span style={{ fontSize: 11, color: '#9ca3af' }}>SavingÃ¢ÂÂ¦</span>}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: '9px 18px', fontSize: 13, fontWeight: activeTab === t.key ? 600 : 400,
              color: activeTab === t.key ? '#2563eb' : '#6b7280', background: 'none', border: 'none',
              borderBottom: `2px solid ${activeTab === t.key ? '#2563eb' : 'transparent'}`,
              cursor: 'pointer', transition: 'all 0.15s', marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Ã¢ÂÂÃ¢ÂÂ TAB CONTENT Ã¢ÂÂÃ¢ÂÂ */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {/* Ã¢ÂÂÃ¢ÂÂ OVERVIEW TAB Ã¢ÂÂÃ¢ÂÂ */}
        {activeTab === 'overview' && (
          <div style={{ maxWidth: 860 }}>
            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total Contacts', value: contacts.length, color: '#111', bg: '#fff', border: '#e5e7eb', icon: 'Ã°ÂÂÂ¤' },
                { label: 'Contacted', value: contacts.filter(c => c.status !== 'Fresh').length, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: 'Ã¢ÂÂ' },
                { label: 'Remaining', value: contacts.filter(c => c.status === 'Fresh').length, color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'Ã°ÂÂÂ' },
                { label: 'Warm / Prospect', value: contacts.filter(c => c.response_type === 'warm' || c.response_type === 'prospect').length, color: '#7c3aed', bg: '#fdf4ff', border: '#e9d5ff', icon: 'Ã°ÂÂÂ¥' },
              ].map(card => (
                <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 18, marginBottom: 6 }}>{card.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: card.color, letterSpacing: '-0.5px' }}>{card.value}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3, fontWeight: 500 }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* HQ / Company Info */}
            {(data.hq_id || data.employees || data.funding || data.about || data.revenue_millions) && (
              <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'16px 20px', marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>Company Info</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  {data.revenue_millions && <div><div style={{fontSize:10,color:'#9ca3af',fontWeight:600,marginBottom:2}}>REVENUE</div><div style={{fontSize:13,color:'#111'}}>${Number(data.revenue_millions).toLocaleString()}M</div></div>}
                  {data.employees && <div><div style={{fontSize:10,color:'#9ca3af',fontWeight:600,marginBottom:2}}>EMPLOYEES</div><div style={{fontSize:13,color:'#111'}}>{data.employees}</div></div>}
                  {data.funding && <div><div style={{fontSize:10,color:'#9ca3af',fontWeight:600,marginBottom:2}}>FUNDING</div><div style={{fontSize:13,color:'#111'}}>{data.funding}</div></div>}
                </div>
                {data.about && <div style={{marginTop:10,fontSize:13,color:'#374151',lineHeight:1.5}}>{data.about}</div>}
              </div>
            )}

            {/* HQ Assignment */}
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'16px 20px', marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>HQ Assignment</div>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <select value={data.hq_id||''} onChange={async e=>{
                  const newHqId = e.target.value || null;
                  await supabase.from('accounts').update({ hq_id: newHqId }).eq('id', data.id);
                  setData(d=>({...d, hq_id: newHqId}));
                  onUpdate();
                }} style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid #d1d5db', fontSize:13, background:'#f9fafb' }}>
                  <option value="">— No HQ assigned —</option>
                  {hqsList.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
            </div>

            {/* Stage pipeline */}
            {contacts.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Stage Pipeline</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['Fresh','F1','F2','F3','F4','F5','won','lost','bounced','unsubscribed'].map(s => {
                    const cnt = contacts.filter(c => c.status === s).length;
                    if (!cnt) return null;
                    const sc2 = STAGE_COLORS[s] || { bg: '#f1f5f9', color: '#475569' };
                    return (
                      <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: sc2.color }}>{cnt}</div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 10, background: sc2.bg, color: sc2.color }}>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Intent Signals */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Ã°ÂÂÂ¡ Intent Signals <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>Ã¢ÂÂ click to toggle</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {SIGNAL_DEFS.map(s => {
                  const active = !!signals[s.key];
                  return (
                    <div key={s.key} onClick={() => toggleSignal(s.key)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      background: active ? s.bg : '#f9fafb', border: `1px solid ${active ? s.color + '40' : '#f0f0ee'}`, transition: 'all 0.15s',
                    }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{active ? s.icon : 'Ã¢ÂÂ'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? s.color : '#6b7280' }}>{s.label}</div>
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? s.color : '#e5e7eb', flexShrink: 0 }} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick notes preview */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Ã°ÂÂÂ Notes</div>
              <textarea value={notesValue} onChange={e => handleNotesChange(e.target.value)}
                placeholder="Add intel: tech stack, deal status, pain points, next stepsÃ¢ÂÂ¦" rows={5}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #e5e7eb', fontSize: 13, lineHeight: 1.7, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#374151', background: '#f9fafb' }} />
            </div>
          </div>
        )}

        {/* Ã¢ÂÂÃ¢ÂÂ CONTACTS TAB Ã¢ÂÂÃ¢ÂÂ */}
        {activeTab === 'contacts' && (
          <div style={{ maxWidth: 860 }}>
            {contacts.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>Ã°ÂÂÂ¤</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>No contacts linked to this account</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {contacts.map(c => {
                  const sc2 = STAGE_COLORS[c.status] || { bg: '#f1f5f9', color: '#475569' };
                  const initColor = avatarColor((c.first_name + ' ' + (c.last_name || '')).trim());
                  return (
                    <div key={c.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* Avatar */}
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: initColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                        {getInitials((c.first_name + ' ' + (c.last_name || '')).trim())}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{(c.first_name + ' ' + (c.last_name || '')).trim()}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{c.title || ''}</div>
                        {c.notes && <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 4, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>"{c.notes}"</div>}
                      </div>
                      {/* Stage */}
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: sc2.bg, color: sc2.color, flexShrink: 0 }}>{c.status}</span>
                      {/* Email */}
                      {c.email ? (
                        <span style={{ fontSize: 12, color: '#374151', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={c.email}>Ã¢ÂÂÃ¯Â¸Â {c.email}</span>
                      ) : (
                        <button onClick={() => window.open(`https://app.apollo.io/#/people?name=${encodeURIComponent((c.first_name + ' ' + (c.last_name || '')).trim())}&organization_name=${encodeURIComponent(data.name)}`, '_blank')}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, border: '1px dashed #d97706', background: 'none', color: '#d97706', cursor: 'pointer', flexShrink: 0 }}>
                          Ã°ÂÂÂ Find Email
                        </button>
                      )}
                      {/* Start button Ã¢ÂÂ Fresh contacts not yet queued */}
                      {c.status === 'Fresh' && !c.next_followup && (
                        <button
                          onClick={() => startContact(c)}
                          disabled={qualifying === c.id}
                          title="Add to Follow-up Queue as Fresh"
                          style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: 'none',
                            background: qualifying === c.id ? '#d1fae5' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
                            color: '#fff', cursor: qualifying === c.id ? 'wait' : 'pointer', fontWeight: 600, flexShrink: 0,
                            boxShadow: '0 1px 4px rgba(37,99,235,0.3)' }}>
                          {qualifying === c.id ? 'Ã¢ÂÂ³ StartingÃ¢ÂÂ¦' : 'Ã°ÂÂÂ Start'}
                        </button>
                      )}
                      {/* In Queue badge Ã¢ÂÂ Fresh contacts already started */}
                      {c.status === 'Fresh' && c.next_followup && (
                        <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8,
                          background: '#d1fae5', color: '#059669', fontWeight: 600, flexShrink: 0,
                          border: '1px solid #6ee7b7' }}>
                          Ã°ÂÂÂ¬ In Queue
                        </span>
                      )}
                      {/* View button */}
                      <button onClick={() => navigate(`/contacts/${c.id}`, { state: { from: 'account', accountId: data.id, accountName: data.name } })}
                        style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#2563eb', cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}>
                        View Ã¢ÂÂ
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Ã¢ÂÂÃ¢ÂÂ TECH STACK TAB Ã¢ÂÂÃ¢ÂÂ */}
        {activeTab === 'techstack' && (
          <div style={{ maxWidth: 860 }}>
            {/* AI generate bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '12px 16px', background: 'linear-gradient(135deg, #f5f3ff, #eff6ff)', borderRadius: 12, border: '1px solid #ddd6fe' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#5b21b6' }}>Ã°ÂÂ¤Â AI-Powered Tech Intelligence</div>
                <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>Auto-detect testing tools, enterprise apps & SaaS platforms. Manual add always available below.</div>
              </div>
              <button onClick={runFullAIResearch} disabled={aiResearching} style={{
                padding: '8px 18px', background: aiResearching ? '#e5e7eb' : 'linear-gradient(135deg, #7c3aed, #2563eb)',
                color: aiResearching ? '#9ca3af' : '#fff', borderRadius: 9, fontSize: 13, fontWeight: 600,
                border: 'none', cursor: aiResearching ? 'wait' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {aiResearching ? 'Ã¢ÂÂ³ GeneratingÃ¢ÂÂ¦' : 'Ã¢ÂÂ¨ Generate with AI'}
              </button>
            </div>
            {/* Testing Tools */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111', flex: 1 }}>Ã¢ÂÂÃ¯Â¸Â Testing Tools</span>
                <button onClick={() => setShowAddTool(t => !t)} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 7, border: '1px dashed #2563eb', color: '#2563eb', background: 'none', cursor: 'pointer' }}>+ Add Manually</button>
              </div>
              {tools.length === 0 && !showAddTool && <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>No tools recorded yet</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tools.map((t, idx) => {
                  const tc = TOOL_STATUS_COLORS[t.status] || TOOL_STATUS_COLORS.Active;
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 9, background: '#f9fafb', border: '1px solid #f0f0ee' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: '#374151' }}>{t.status === 'Legacy' ? 'Ã¢ÂÂ Ã¯Â¸Â' : 'Ã°ÂÂÂµ'} {t.tool}{t.source === 'ai' && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#ede9fe', color: '#7c3aed', marginLeft: 5 }}>AI</span>}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: tc.bg, color: tc.color }}>{t.status}</span>
                      <select value={t.status} onChange={e => updateToolStatus(idx, e.target.value)}
                        style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                        {TOOL_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                      <button onClick={() => removeTool(idx)} style={{ fontSize: 13, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>Ã¢ÂÂ</button>
                    </div>
                  );
                })}
              </div>
              {showAddTool && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, padding: '12px 14px', background: '#f0f7ff', borderRadius: 9, border: '1px solid #dbeafe' }}>
                  <input value={newToolName} onChange={e => setNewToolName(e.target.value)} placeholder="Tool name (e.g. Playwright)"
                    onKeyDown={e => e.key === 'Enter' && addTool()}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none' }} />
                  <select value={newToolStatus} onChange={e => setNewToolStatus(e.target.value)}
                    style={{ padding: '7px 8px', fontSize: 12, borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                    {TOOL_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <button onClick={addTool} style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: 13, border: 'none', cursor: 'pointer' }}>Add</button>
                  <button onClick={() => setShowAddTool(false)} style={{ padding: '7px 10px', background: '#f0f0f0', borderRadius: 7, fontSize: 13, border: 'none', cursor: 'pointer' }}>Ã¢ÂÂ</button>
                </div>
              )}
            </div>

            {/* Enterprise Apps */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111', flex: 1 }}>Ã°ÂÂÂ¢ Enterprise Apps</span>
                <button onClick={() => setShowAddEnterprise(t => !t)} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 7, border: '1px dashed #0891b2', color: '#0891b2', background: 'none', cursor: 'pointer' }}>+ Add Manually</button>
              </div>
              {eApps.length === 0 && !showAddEnterprise && <div style={{ fontSize: 13, color: '#9ca3af' }}>No enterprise apps recorded</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: eApps.length > 0 ? 10 : 0 }}>
                {eApps.map((a, idx) => (
                  <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, background: '#e0f2fe', color: '#0369a1', fontSize: 12, fontWeight: 600 }}>
                    {a.app}{a.source === 'ai' && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: '#dbeafe', color: '#1d4ed8', marginLeft: 4 }}>AI</span>}
                    <button onClick={() => removeEnterpriseApp(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', fontSize: 11, padding: 0, lineHeight: 1 }}>Ã¢ÂÂ</button>
                  </span>
                ))}
              </div>
              {showAddEnterprise && (
                <div style={{ padding: 12, background: '#f0f9ff', borderRadius: 9, border: '1px solid #bae6fd' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input value={newEnterpriseApp} onChange={e => setNewEnterpriseApp(e.target.value)} placeholder="App name (e.g. Guidewire)"
                      onKeyDown={e => e.key === 'Enter' && addEnterpriseApp(newEnterpriseApp)}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none' }} />
                    <button onClick={() => addEnterpriseApp(newEnterpriseApp)} style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: 13, border: 'none', cursor: 'pointer' }}>Add</button>
                    <button onClick={() => setShowAddEnterprise(false)} style={{ padding: '7px 10px', background: '#f0f0f0', borderRadius: 7, fontSize: 13, border: 'none', cursor: 'pointer' }}>Ã¢ÂÂ</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Quick add:</span>
                    {COMMON_ENTERPRISE_APPS.filter(a => !eApps.find(x => x.app === a)).map(a => (
                      <button key={a} onClick={() => addEnterpriseApp(a)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, border: '1px dashed #0891b2', color: '#0891b2', background: 'none', cursor: 'pointer' }}>{a}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SaaS Apps */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111', flex: 1 }}>Ã°ÂÂÂ¦ SaaS & Industry Apps</span>
                <button onClick={() => setShowAddSaas(t => !t)} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 7, border: '1px dashed #7c3aed', color: '#7c3aed', background: 'none', cursor: 'pointer' }}>+ Add Manually</button>
              </div>
              {saasApps.length === 0 && !showAddSaas && <div style={{ fontSize: 13, color: '#9ca3af' }}>No SaaS apps recorded</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: saasApps.length > 0 ? 10 : 0 }}>
                {saasApps.map((a, idx) => (
                  <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, background: '#ede9fe', color: '#7c3aed', fontSize: 12, fontWeight: 600 }}>
                    {a.app}{a.source === 'ai' && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: '#f3e8ff', color: '#7c3aed', marginLeft: 4 }}>AI</span>}
                    <button onClick={() => removeSaasApp(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: 11, padding: 0, lineHeight: 1 }}>Ã¢ÂÂ</button>
                  </span>
                ))}
              </div>
              {showAddSaas && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newSaasApp} onChange={e => setNewSaasApp(e.target.value)} placeholder="e.g. Temenos, Finastra"
                    onKeyDown={e => e.key === 'Enter' && addSaasApp()}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none' }} />
                  <button onClick={addSaasApp} style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: 13, border: 'none', cursor: 'pointer' }}>Add</button>
                  <button onClick={() => setShowAddSaas(false)} style={{ padding: '7px 10px', background: '#f0f0f0', borderRadius: 7, fontSize: 13, border: 'none', cursor: 'pointer' }}>Ã¢ÂÂ</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ã¢ÂÂÃ¢ÂÂ RESEARCH TAB Ã¢ÂÂÃ¢ÂÂ */}
        {activeTab === 'research' && (
          <div style={{ maxWidth: 860 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={generateAll} style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                Ã¢ÂÂ¨ Generate All Missing
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {RESEARCH_DEFAULTS.map(r => (
                <ResearchCard key={r.key} icon={r.icon} label={r.label} value={research[r.key] || ''}
                  generating={!!researchGenerating[r.key]}
                  onGenerate={() => generateResearch(r.key, r.label)}
                  onSave={val => saveResearch(r.key, val)} />
              ))}
              {customResearch.map((s, idx) => (
                <ResearchCard key={s.key} icon="Ã°ÂÂÂ" label={s.label} value={s.value || ''}
                  generating={false} onGenerate={() => {}}
                  onSave={val => saveCustomResearch(idx, val)}
                  onRemove={() => removeCustomSection(idx)} />
              ))}
              {/* Add custom */}
              <div style={{ border: '2px dashed #e5e7eb', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 100, cursor: showAddCustom ? 'default' : 'pointer' }}
                onClick={() => !showAddCustom && setShowAddCustom(true)}>
                {showAddCustom ? (
                  <div style={{ width: '100%', display: 'flex', gap: 8 }}>
                    <input value={newCustomSection} onChange={e => setNewCustomSection(e.target.value)}
                      placeholder="Section name" autoFocus onKeyDown={e => e.key === 'Enter' && addCustomSection()}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid #2563eb', fontSize: 13, outline: 'none' }} />
                    <button onClick={addCustomSection} style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: 13, border: 'none', cursor: 'pointer' }}>Add</button>
                    <button onClick={() => setShowAddCustom(false)} style={{ padding: '7px 10px', background: '#f0f0f0', borderRadius: 7, fontSize: 13, border: 'none', cursor: 'pointer' }}>Ã¢ÂÂ</button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 28, color: '#d1d5db' }}>+</span>
                    <span style={{ fontSize: 13, color: '#9ca3af' }}>Add custom section</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Ã¢ÂÂÃ¢ÂÂ NOTES TAB Ã¢ÂÂÃ¢ÂÂ */}
        {activeTab === 'responses' && (
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:'#374151', marginBottom:16 }}>Response Tracker</div>
            {contacts.length === 0 ? (
              <div style={{color:'#9ca3af',fontSize:13}}>No contacts yet.</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {contacts.map(c => (
                  <div key={c.id} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#111'}}>{c.full_name}</div>
                      <div style={{fontSize:11,color:'#6b7280'}}>{c.title}</div>
                    </div>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:'#f3f4f6',color:'#374151'}}>{c.status||'â'}</span>
                      {c.response_state && <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:8,background:c.response_state==='Lead'?'#d1fae5':c.response_state==='Warm'?'#fef9c3':c.response_state==='Prospecting'?'#fef3c7':c.response_state==='Bounce'?'#fee2e2':'#f3f4f6',color:c.response_state==='Lead'?'#065f46':c.response_state==='Warm'?'#854d0e':c.response_state==='Prospecting'?'#92400e':c.response_state==='Bounce'?'#991b1b':'#374151'}}>{c.response_state}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

                {activeTab === 'notes' && (
          <div style={{ maxWidth: 860 }}>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Ã°ÂÂÂ Account Notes</div>
              <textarea value={notesValue} onChange={e => handleNotesChange(e.target.value)}
                placeholder="Add intel: tech stack, deal status, pain points, next steps, objections, key stakeholdersÃ¢ÂÂ¦"
                rows={18}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, lineHeight: 1.8, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#374151', background: '#f9fafb' }} />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Auto-saves as you type</div>
            </div>
          </div>
        )}
      </div>

      {/* Ã¢ÂÂÃ¢ÂÂ SCORE BREAKDOWN POPUP Ã¢ÂÂÃ¢ÂÂ */}
      {showScoreBreakdown && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowScoreBreakdown(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 400, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, flex: 1, color: '#111' }}>Score Breakdown</div>
              <button onClick={() => setShowScoreBreakdown(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>Ã¢ÂÂ</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: sc.color, background: sc.bg, padding: '10px 28px', borderRadius: 14 }}>{score}</div>
            </div>
            {[
              { label: 'Ã°ÂÂÂ§ Tool Fit', pts: tools.some(t => t.status === 'Legacy') ? 30 : tools.some(t => t.status === 'Evaluating') ? 20 : tools.length > 0 ? 15 : 0, max: 30,
                detail: tools.some(t => t.status === 'Legacy') ? `Legacy: ${tools.filter(t=>t.status==='Legacy').map(t=>t.tool).join(', ')}` : tools.some(t=>t.status==='Evaluating') ? 'Evaluating tools detected' : tools.length > 0 ? 'Modern tools' : 'No tools recorded' },
              { label: 'Ã°ÂÂÂ¡ Intent Signals', pts: Math.min([signals.hiringQA&&10,signals.funding&&10,signals.outage&&8,signals.recentLaunch&&6,signals.leadershipChange&&6,signals.cicd&&5].filter(Boolean).reduce((a,b)=>a+b,0),45), max: 45,
                detail: SIGNAL_DEFS.filter(s=>signals[s.key]).map(s=>s.label).join(', ') || 'No signals active' },
              { label: 'Ã°ÂÂÂ¬ Engagement', pts: Math.min(contacts.filter(c=>c.response_type==='warm'||c.response_type==='prospect').length*5,15), max: 15,
                detail: `${contacts.filter(c=>c.response_type==='warm'||c.response_type==='prospect').length} warm/prospect contacts` },
              { label: 'Ã°ÂÂÂ¬ Research', pts: Math.min(Object.values(data.research||{}).filter(v=>v&&v.length>10).length*2,10), max: 10,
                detail: `${Object.values(data.research||{}).filter(v=>v&&v.length>10).length} of ${RESEARCH_DEFAULTS.length} sections filled` },
            ].map(row => (
              <div key={row.label} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: '#374151' }}>{row.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: row.pts > 0 ? '#2563eb' : '#d1d5db' }}>{row.pts}<span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>/{row.max}</span></span>
                </div>
                <div style={{ height: 7, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ height: '100%', width: `${row.max > 0 ? (row.pts/row.max)*100 : 0}%`, background: row.pts > 0 ? '#2563eb' : '#f3f4f6', borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{row.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ RESEARCH CARD Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */
function ResearchCard({ icon, label, value, generating, onGenerate, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8, background: '#fafafa' }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1, color: '#374151' }}>{label}</span>
        {onRemove && (
          <button onClick={onRemove} style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>Ã¢ÂÂ</button>
        )}
        <button onClick={onGenerate} disabled={generating} style={{
          padding: '4px 12px', background: generating ? '#e5e7eb' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
          color: generating ? '#9ca3af' : '#fff', borderRadius: 7, fontSize: 11, fontWeight: 600, border: 'none',
          cursor: generating ? 'wait' : 'pointer',
        }}>{generating ? 'Ã¢ÂÂ³ GeneratingÃ¢ÂÂ¦' : 'Ã¢ÂÂ¨ Generate'}</button>
      </div>
      <div style={{ padding: '12px 16px', minHeight: 70 }}>
        {editing ? (
          <div>
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #2563eb', fontSize: 13, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => { onSave(draft); setEditing(false); }} style={{ padding: '5px 14px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: 12, border: 'none', cursor: 'pointer' }}>Save</button>
              <button onClick={() => { setDraft(value); setEditing(false); }} style={{ padding: '5px 12px', background: '#f0f0f0', borderRadius: 7, fontSize: 12, border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div onClick={() => setEditing(true)} style={{ fontSize: 13, lineHeight: 1.65, color: value ? '#374151' : '#9ca3af', cursor: 'text', minHeight: 44, whiteSpace: 'pre-wrap' }}>
            {value || 'Click to write, or click Ã¢ÂÂ¨ Generate'}
          </div>
        )}
      </div>
    </div>
  );
}
