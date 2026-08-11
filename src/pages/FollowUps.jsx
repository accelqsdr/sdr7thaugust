import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// Ã¢ÂÂÃ¢ÂÂ CADENCE Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
// Fresh contact: CADENCE.Fresh days until initial email is due (usually 0 = immediately)
// F1 contact: CADENCE.F1 days after marking Fresh sent before F2 email is due
// etc.
const DEFAULT_CADENCE = { Fresh: 0, F1: 3, F2: 4, F3: 7, F4: 7 };

// For a contact in status X, look up cadence from this key (what was just sent)
const STATUS_CADENCE_KEY = { F1: 'Fresh', F2: 'F1', F3: 'F2', F4: 'F3', F5: 'F4' };

const NEXT_STAGE = { Fresh: 'F1', F1: 'F2', F2: 'F3', F3: 'F4', F4: 'F5', F5: null };
const FOLLOWUP_STAGES = ['F1', 'F2', 'F3', 'F4', 'F5'];
const ALL_STAGES = ['Fresh', ...FOLLOWUP_STAGES];

const STAGE_META = {
  Fresh: { bg: '#dbeafe', color: '#1d4ed8', label: 'Fresh' },
  F1:    { bg: '#d1fae5', color: '#065f46', label: 'Follow-up 01' },
  F2:    { bg: '#fef9c3', color: '#854d0e', label: 'Follow-up 02' },
  F3:    { bg: '#ffedd5', color: '#9a3412', label: 'Follow-up 03' },
  F4:    { bg: '#fee2e2', color: '#991b1b', label: 'Follow-up 04' },
  F5:    { bg: '#f3e8ff', color: '#6b21a8', label: 'Follow-up 05' },
  yet_to_contact: { bg: '#f1f5f9', color: '#475569', label: 'Yet to Contact' },
  cooling_off:    { bg: '#e0f2fe', color: '#0369a1', label: 'Cooling Off' },
};
const RESPONSE_META = {
  warm:           { bg: '#fef3c7', color: '#d97706', label: 'Ã°ÂÂÂ¡ Warm' },
  prospect:       { bg: '#d1fae5', color: '#059669', label: 'Ã°ÂÂÂ¢ Prospect' },
  cold:           { bg: '#e0f2fe', color: '#0369a1', label: 'Ã°ÂÂÂµ Cold' },
  negative:       { bg: '#fee2e2', color: '#dc2626', label: 'Ã°ÂÂÂ´ Negative' },
  not_interested: { bg: '#f1f5f9', color: '#475569', label: 'Ã¢Â¬Â Not interested' },
};

const TIMING_GROUPS = [
  { key: 'overdue', label: 'Ã°ÂÂÂ´ Overdue',     color: '#dc2626' },
  { key: 'today',   label: 'Ã°ÂÂÂ¢ Due Today',   color: '#059669' },
  { key: 'week',    label: 'Ã°ÂÂÂ¡ This Week',   color: '#d97706' },
  { key: 'later',   label: 'Ã°ÂÂÂ Later',       color: '#6b7280' },
  { key: 'nodate',  label: 'Ã¢ÂÂ³ No Date Set', color: '#94a3b8' },
];

// Ã¢ÂÂÃ¢ÂÂ Helpers Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

function getInitials(name) {
  return (name || '').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

const AVATAR_PALETTE = ['#2563eb','#7c3aed','#059669','#d97706','#0891b2','#9333ea','#dc2626'];
function avatarColor(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function computeDue(contact, cadence) {
  // Fresh contacts: use next_followup directly (set when "Start" is clicked)
  if (contact.status === 'Fresh') {
    return contact.next_followup ? new Date(contact.next_followup) : null;
  }
  // F1-F5: compute from last_contacted + cadence for the previous stage
  const key = STATUS_CADENCE_KEY[contact.status];
  if (!key) return null;
  const days = (cadence || DEFAULT_CADENCE)[key] ?? 3;
  if (contact.last_contacted) {
    const d = new Date(contact.last_contacted);
    d.setDate(d.getDate() + days);
    return d;
  }
  return contact.next_followup ? new Date(contact.next_followup) : null;
}

function getBucket(due) {
  if (!due) return 'nodate';
  const now = new Date();
  if (due < now) return 'overdue';
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  if (due <= todayEnd) return 'today';
  const weekEnd = new Date(); weekEnd.setDate(now.getDate() + 7);
  if (due <= weekEnd) return 'week';
  return 'later';
}

function formatDue(due) {
  if (!due) return 'No date';
  const now = new Date();
  if (due < now) {
    const days = Math.floor((now - due) / 86400000);
    return days === 0 ? 'Today' : days === 1 ? '1d ago' : `${days}d ago`;
  }
  if (due.toDateString() === now.toDateString()) return 'Today';
  const tomorrow = new Date(); tomorrow.setDate(now.getDate() + 1);
  if (due.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return due.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
export default function FollowUps() {
  const { user, profile } = useAuth();
  const canViewAll = ['director', 'manager'].includes(profile?.role);
  const [viewAll, setViewAll] = useState(false);
  const navigate = useNavigate();

  // Settings
  const [cadence, setCadence] = useState(() => {
    try { return { ...DEFAULT_CADENCE, ...JSON.parse(localStorage.getItem('sdr_cadence') || '{}') }; }
    catch { return DEFAULT_CADENCE; }
  });
  const [autoGenerate, setAutoGenerate] = useState(
    () => localStorage.getItem('sdr_auto_generate') !== 'false'
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Data
  const [contacts,   setContacts]   = useState([]);
  const [accounts,   setAccounts]   = useState({});
  const [sentEmails, setSentEmails] = useState({});
  const [loading,    setLoading]    = useState(true);

  // Filters
  const [search,         setSearch]         = useState('');
  const [stageFilter,    setStageFilter]    = useState('all');
  const [timingFilter,   setTimingFilter]   = useState('all');
  const [responseFilter, setResponseFilter] = useState('all');
  const [companyFilter,  setCompanyFilter]  = useState('all');

  // Email draft
  const [drafts, setDraftsRaw] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('sdr_drafts') || '{}');
      // Prune entries older than 7 days so localStorage stays lean
      const cutoff = Date.now() - 7 * 86400000;
      const pruned = {};
      Object.entries(raw).forEach(([id, val]) => {
        if (!val._savedAt || val._savedAt > cutoff) pruned[id] = val;
      });
      return pruned;
    } catch { return {}; }
  });
  function setDrafts(updater) {
    setDraftsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Stamp each new/changed draft with _savedAt for expiry
      const stamped = {};
      Object.entries(next).forEach(([id, val]) => {
        stamped[id] = val._savedAt ? val : { ...val, _savedAt: Date.now() };
      });
      try { localStorage.setItem('sdr_drafts', JSON.stringify(stamped)); } catch {}
      return stamped;
    });
  }
  const [drafting,    setDrafting]    = useState(null);
  const [draftOpen,   setDraftOpen]   = useState(null);
  const [copied,      setCopied]      = useState(null);
  const [markingSent, setMarkingSent] = useState(null);
  const [customPrompts, setCustomPrompts] = useState({});
  const [exportRows, setExportRows] = useState([]);

  const autoGenRanRef = useRef(false);

  useEffect(() => { fetchData(); }, [viewAll]);

  async function fetchData() {
    setLoading(true);
    let cQuery = supabase.from('contacts').select('*');
    if (!viewAll || !canViewAll) cQuery = cQuery.eq('owner_id', user.id);
    cQuery = cQuery
      .or('status.in.(F1,F2,F3,F4,F5,cooling_off),and(status.eq.Fresh,next_followup.not.is.null)')
      .order('last_contacted', { ascending: false, nullsFirst: false }).limit(5000);

    let aQuery = supabase.from('accounts').select('id, name, industry, research, icp_notes, description');
    if (!viewAll || !canViewAll) aQuery = aQuery.eq('owner_id', user.id);

    const [cRes, aRes, lRes] = await Promise.all([
      cQuery,
      aQuery,
      supabase.from('activity_log').select('contact_id, details, created_at')
        .eq('actor_id', user.id).eq('activity_type', 'email_sent')
        .order('created_at', { ascending: false }),
    ]);

    // Fallback: if the complex OR query fails, try simpler approach
    let rows = cRes.data;
    if (cRes.error || !rows) {
      let fallback = supabase.from('contacts').select('*');
      if (!viewAll || !canViewAll) fallback = fallback.eq('owner_id', user.id);
      const fallbackRes = await fallback
        .in('status', [...ALL_STAGES, 'cooling_off'])
        .order('last_contacted', { ascending: false, nullsFirst: false }).limit(5000);
      rows = (fallbackRes.data || []).filter(c =>
        c.status === 'cooling_off' || c.status !== 'Fresh' || (c.status === 'Fresh' && c.next_followup)
      );
    }

    setContacts(rows || []);
    const accMap = {};
    (aRes.data || []).forEach(a => { accMap[a.id] = a; });
    setAccounts(accMap);
    const emailMap = {};
    (lRes.data || []).forEach(row => {
      if (!emailMap[row.contact_id]) emailMap[row.contact_id] = [];
      if (row.details?.body) emailMap[row.contact_id].push({ body: row.details.body });
    });
    setSentEmails(emailMap);
    setLoading(false);
    return rows || [];
  }

  // Auto-generate on first load Ã¢ÂÂ throttled: one at a time, 400ms gap
  useEffect(() => {
    if (loading || autoGenRanRef.current || !autoGenerate) return;
    autoGenRanRef.current = true;

    const queue = contacts.filter(c => {
      const due = computeDue(c, cadence);
      const b = getBucket(due);
      return (b === 'overdue' || b === 'today') && !drafts[c.id];
    });

    if (queue.length === 0) return;

    let i = 0;
    async function runNext() {
      if (i >= queue.length) return;
      const contact = queue[i++];
      await doGenerate(contact, true);
      setTimeout(runNext, 400); // 400ms gap between calls
    }
    runNext();
  }, [loading]);

  function saveCadence(next) {
    setCadence(next);
    localStorage.setItem('sdr_cadence', JSON.stringify(next));
  }

  function toggleAutoGen() {
    const next = !autoGenerate;
    setAutoGenerate(next);
    localStorage.setItem('sdr_auto_generate', String(next));
  }

  async function doGenerate(contact, silent = false, customPrompt = null) {
    if (!silent) { setDrafting(contact.id); setDraftOpen(contact.id); }
    const account    = accounts[contact.account_id] || {};
    const senderName = profile?.full_name || user?.email?.split('@')[0] || 'SDR';
    const priorBodies = (sentEmails[contact.id] || []).slice(0, 3).map(e => e.body);
    // Fresh contacts use 'Fresh' stage (initial email)
    const emailStage = contact.status === 'Fresh' ? 'Fresh' : contact.status;
    try {
      const res = await supabase.functions.invoke('generate-email', {
        body: {
          contact: {
            full_name: ((contact.first_name || '') + ' ' + (contact.last_name || '')).trim(), title: contact.title,
            company: contact.company, email: contact.email,
            response: contact.response_type, pitch: contact.notes,
            industry: account.industry,
          },
          stage: emailStage,
          customPrompt: customPrompt || null,
          accountResearch: account.research || {},
          accountNotes: account.icp_notes || null,
          accountDescription: account.description || null,
          senderName,
          priorEmailBodies: priorBodies,
        },
      });
      if (!res.error && res.data?.subject) {
        setDrafts(d => ({ ...d, [contact.id]: { subject: res.data.subject, body: res.data.body } }));
        setExportRows(prev => [...prev, {
          name: contact.full_name || '',
          title: contact.title || '',
          company: contact.company || account.name || '',
          industry: account.industry || contact.industry || '',
          stage: contact.status || '',
          subject: res.data.subject,
          body: res.data.body,
          sender: senderName,
          generatedAt: new Date().toLocaleString()
        }]);
        if (!silent) setDraftOpen(contact.id);
      }
    } catch (e) { console.error(e); }
    if (!silent) setDrafting(null);
  }

  async function markSent(contact) {
    const next = NEXT_STAGE[contact.status];
    if (!next) return;
    setMarkingSent(contact.id);
    const draft = drafts[contact.id];
    const now   = new Date().toISOString();

    // For Fresh: next due = now + CADENCE.Fresh days (0 = immediately in F1 queue)
    // For F1-F5: next due = now + CADENCE[currentStage] days
    const cadenceKey = contact.status; // cadence for what was just sent
    const daysToNext = (cadence[cadenceKey] ?? 3);
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + daysToNext);

    await supabase.from('contacts').update({
      status:         next,
      sequence_step:  ALL_STAGES.indexOf(next),
      last_contacted: now,
      next_followup:  nextDue.toISOString(),
    }).eq('id', contact.id);

    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: contact.id,
      activity_type: 'email_sent',
      details: {
        from_stage: contact.status, to_stage: next,
        subject: draft?.subject || '', body: draft?.body || '',
      },
    });

    setDrafts(d => { const nd = { ...d }; delete nd[contact.id]; return nd; });
    setDraftOpen(o => o === contact.id ? null : o);
    setMarkingSent(null);
    fetchData();
  }

  async function snooze(id, days) {
    const d = new Date(); d.setDate(d.getDate() + days);
    await supabase.from('contacts').update({
      next_followup:  d.toISOString(),
      last_contacted: d.toISOString(),
    }).eq('id', id);
    fetchData();
  }

  function copyDraft(id) {
    const draft = drafts[id]; if (!draft) return;
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopied(id);
    setTimeout(() => setCopied(c => c === id ? null : c), 2000);
  }

  // Ã¢ÂÂÃ¢ÂÂ Computed values Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  const freshContacts  = contacts.filter(c => c.status === 'Fresh');
  const activeContacts = contacts.filter(c => c.status !== 'Fresh' && c.status !== 'cooling_off');
  const coolingOffList  = contacts.filter(c => c.status === 'cooling_off');

  const enriched = activeContacts.map(c => {
    const due = computeDue(c, cadence);
    return { ...c, _due: due, _bucket: getBucket(due), _hasDraft: !!drafts[c.id] };
  });

  const enrichedFresh = freshContacts.map(c => ({
    ...c,
    _due: computeDue(c, cadence),
    _bucket: getBucket(computeDue(c, cadence)),
    _hasDraft: !!drafts[c.id],
  }));

  const stageCounts = {};
  ALL_STAGES.forEach(s => { stageCounts[s] = contacts.filter(c => c.status === s).length; });

  const overdueCt = [...enriched, ...enrichedFresh].filter(c => c._bucket === 'overdue').length;
  const todayCt   = [...enriched, ...enrichedFresh].filter(c => c._bucket === 'today').length;
  const readyCt   = [...enriched, ...enrichedFresh].filter(c => c._hasDraft).length;
  const uniqueCompanies = [...new Set(contacts.map(c => c.company).filter(Boolean))].sort();

  function applyFilters(list) {
    return list.filter(c => {
      if (stageFilter    !== 'all' && c.status   !== stageFilter)    return false;
      if (timingFilter   !== 'all' && c._bucket  !== timingFilter)   return false;
      if (responseFilter !== 'all' && c.response_type !== responseFilter) return false;
      if (companyFilter  !== 'all' && c.company  !== companyFilter)  return false;
      if (search) {
        const q = search.toLowerCase();
        if (!((c.first_name || '') + ' ' + (c.last_name || '')).trim()?.toLowerCase().includes(q) && !c.company?.toLowerCase().includes(q) && !c.email?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  const filteredFresh  = applyFilters(enrichedFresh);
  const filteredActive = applyFilters(enriched);
  const coolingOffList = contacts.filter(c => c.status === 'cooling_off');

  // Build timing groups for F1-F5
  const groups = TIMING_GROUPS.map(g => {
    const items = filteredActive.filter(c => c._bucket === g.key);
    items.sort((a, b) => {
      if (a._hasDraft !== b._hasDraft) return a._hasDraft ? -1 : 1;
      if (a._due && b._due) return a._due - b._due;
      return 0;
    });
    return { ...g, items };
  }).filter(g => g.items.length > 0);

  const activeGroups = timingFilter === 'all' ? groups : groups.filter(g => g.key === timingFilter);
  const showFresh = stageFilter === 'all' || stageFilter === 'Fresh';
  const anyFilter = search || stageFilter !== 'all' || timingFilter !== 'all' || responseFilter !== 'all' || companyFilter !== 'all';
  function clearFilters() { setSearch(''); setStageFilter('all'); setTimingFilter('all'); setResponseFilter('all'); setCompanyFilter('all'); }

  const totalInQueue = contacts.length;
  const sharedProps = {
    accounts, drafts, drafting, draftOpen, copied, markingSent,
    onGenerate:    (c, cp) => doGenerate(c, false, cp),
    onToggleDraft: c => setDraftOpen(d => d === c.id ? null : c.id),
    onRegenerate:  (c, cp) => doGenerate(c, false, cp),
    onMarkSent:    c => markSent(c),
    onSnooze:      (id, days) => snooze(id, days),
    onCopy:        id => copyDraft(id),
    onView:        id => navigate(`/contacts/${id}`),
    customPrompts, onCustomPromptChange: (id, val) => setCustomPrompts(p => ({ ...p, [id]: val })),
  };

  const noResults = filteredFresh.length === 0 && filteredActive.length === 0;

  function exportCSV() {
    if (!exportRows.length) return;
    const headers = ['Name','Title','Company','Industry','Stage','Subject','Body','Sender','Generated At'];
    const rows = exportRows.map(r => [
      r.name, r.title, r.company, r.industry, r.stage,
      r.subject, r.body, r.sender, r.generatedAt
    ].map(v => '"' + (v || '').replace(/"/g, '""') + '"'));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'accelq-drafts-' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'#f8f9fb' }}>

      {/* Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ HEADER Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', flexShrink:0 }}>

        {/* Title row */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 24px 10px' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 style={{ fontSize:18, fontWeight:700, color:'#111', margin:0, letterSpacing:'-0.01em' }}>Ã°ÂÂÂ¬ Follow-up Queue</h1>
              {canViewAll && (
                <button onClick={() => setViewAll(v => !v)}
                  style={{ padding:'3px 10px', borderRadius:20, border:'1.5px solid #e0e0e0',
                    fontSize:11, fontWeight:600, cursor:'pointer',
                    background: viewAll ? '#111' : '#fff', color: viewAll ? '#fff' : '#555' }}>
                  {viewAll ? 'Ã°ÂÂÂ¥ Team' : 'View all'}
                </button>
              )}
            </div>
            <p style={{ fontSize:12, color:'#6b7280', margin:'2px 0 0' }}>
              Fresh Ã¢ÂÂ F1 Ã¢ÂÂ F2 Ã¢ÂÂ F3 Ã¢ÂÂ F4 Ã¢ÂÂ F5 Ã¢ÂÂ draft, review, mark sent
            </p>
          </div>
          <div style={{ flex:1 }} />

          {/* Stat pills */}
          <div style={{ display:'flex', gap:7, alignItems:'center' }}>
            {overdueCt > 0 && (
              <div onClick={() => setTimingFilter(f => f==='overdue'?'all':'overdue')}
                style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700, color:'#dc2626', cursor:'pointer',
                  background:timingFilter==='overdue'?'#fee2e2':'#fff5f5', border:`1.5px solid ${timingFilter==='overdue'?'#dc2626':'#fca5a5'}` }}>
                Ã°ÂÂÂ´ {overdueCt} overdue
              </div>
            )}
            {todayCt > 0 && (
              <div onClick={() => setTimingFilter(f => f==='today'?'all':'today')}
                style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700, color:'#059669', cursor:'pointer',
                  background:timingFilter==='today'?'#d1fae5':'#f0fdf4', border:`1.5px solid ${timingFilter==='today'?'#059669':'#6ee7b7'}` }}>
                Ã°ÂÂÂ¢ {todayCt} today
              </div>
            )}
            {readyCt > 0 && (
              <div style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700, color:'#7c3aed',
                background:'#f5f3ff', border:'1.5px solid #c4b5fd' }}>
                Ã¢ÂÂ¨ {readyCt} ready
              </div>
            )}
            {freshContacts.length > 0 && (
              <div onClick={() => setStageFilter(f => f==='Fresh'?'all':'Fresh')}
                style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700, color:'#1d4ed8', cursor:'pointer',
                  background:stageFilter==='Fresh'?'#dbeafe':'#eff6ff', border:`1.5px solid ${stageFilter==='Fresh'?'#2563eb':'#93c5fd'}` }}>
                Ã°ÂÂÂ© {freshContacts.length} new
              </div>
            )}
            <div style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, color:'#6b7280',
              background:'#f9fafb', border:'1px solid #e5e7eb' }}>
              {totalInQueue} in queue
            </div>
          </div>

          {exportRows.length > 0 && (
            <button onClick={exportCSV}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px',
                borderRadius:8, border:'1.5px solid #059669', background:'#ecfdf5',
                color:'#065f46', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              ⬇ Export CSV ({exportRows.length})
            </button>
          )}

          {/* Settings */}
          <button onClick={() => setSettingsOpen(s => !s)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8,
              border:`1.5px solid ${settingsOpen?'#2563eb':'#e5e7eb'}`,
              background:settingsOpen?'#dbeafe':'#fff', color:settingsOpen?'#1d4ed8':'#374151',
              fontSize:12, fontWeight:600, cursor:'pointer' }}>
            Ã¢ÂÂÃ¯Â¸Â Settings {settingsOpen ? 'Ã¢ÂÂ²' : 'Ã¢ÂÂ¼'}
          </button>
        </div>

        {/* Ã¢ÂÂÃ¢ÂÂ SETTINGS PANEL Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */}
        {settingsOpen && (
          <div style={{ borderTop:'1px solid #f3f4f6', background:'linear-gradient(to bottom,#f9fafb,#f3f4f6)', padding:'16px 24px 18px' }}>
            <div style={{ display:'flex', gap:28, alignItems:'flex-start', flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                  Ã°ÂÂÂ Cadence (days between emails)
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                  {['Fresh','F1','F2','F3','F4'].map(key => (
                    <div key={key} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'#6b7280', marginBottom:4, fontWeight:600 }}>{key}</div>
                      <input type="number" min="0" max="60"
                        value={cadence[key] ?? DEFAULT_CADENCE[key]}
                        onChange={e => saveCadence({ ...cadence, [key]: Number(e.target.value) })}
                        style={{ width:52, padding:'5px 4px', textAlign:'center', borderRadius:7,
                          border:`1.5px solid ${cadence[key]!==DEFAULT_CADENCE[key]?'#2563eb':'#d1d5db'}`,
                          fontSize:14, fontWeight:700, color:'#1d4ed8', background:'#fff', outline:'none' }} />
                    </div>
                  ))}
                  <button onClick={() => saveCadence({ ...DEFAULT_CADENCE })}
                    style={{ padding:'5px 11px', borderRadius:7, border:'1px solid #d1d5db', background:'#fff', fontSize:11, color:'#6b7280', cursor:'pointer', marginBottom:1 }}>
                    Reset
                  </button>
                </div>
                <div style={{ fontSize:10, color:'#9ca3af', marginTop:6, lineHeight:1.5 }}>
                  "Fresh" = days after Start before initial email is due (0 = immediately).<br />
                  "F1" = days after initial email sent before F2 is due. And so on.
                </div>
              </div>

              <div style={{ width:1, background:'#e5e7eb', alignSelf:'stretch', flexShrink:0 }} />

              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                  Ã¢ÂÂ¨ Auto-generation
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div onClick={toggleAutoGen}
                    style={{ position:'relative', width:46, height:26, borderRadius:13, cursor:'pointer',
                      background:autoGenerate?'#2563eb':'#d1d5db', transition:'background 0.2s', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:3, left:autoGenerate?23:3, width:20, height:20,
                      borderRadius:'50%', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.25)', transition:'left 0.2s' }} />
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:autoGenerate?'#2563eb':'#6b7280' }}>
                      {autoGenerate ? 'On Ã¢ÂÂ auto-drafts overdue & today on page open' : 'Off Ã¢ÂÂ manual only'}
                    </div>
                    <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
                      {autoGenerate ? 'AI silently generates drafts when you open this queue' : 'Click "Draft Email" per contact'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ width:1, background:'#e5e7eb', alignSelf:'stretch', flexShrink:0 }} />

              <div style={{ fontSize:11, color:'#6b7280', lineHeight:1.7, maxWidth:260 }}>
                <div style={{ fontWeight:700, color:'#374151', marginBottom:4 }}>Journey</div>
                <div>1. Click <b>Ã°ÂÂÂ Start</b> on Accounts Ã¢ÂÂ contact appears here as <b>Fresh</b></div>
                <div>2. Draft initial email Ã¢ÂÂ <b>Ã¢ÂÂ Mark Sent</b> Ã¢ÂÂ becomes F1</div>
                <div>3. F1Ã¢ÂÂF2Ã¢ÂÂF3Ã¢ÂÂF4Ã¢ÂÂF5 with AI drafts each step</div>
                <div>4. <span style={{ color:'#7c3aed', fontWeight:600 }}>Ã¢ÂÂ¨ Ready</span> contacts float to top of each group</div>
              </div>
            </div>
          </div>
        )}

        {/* Ã¢ÂÂÃ¢ÂÂ FILTER ROW Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', padding:'8px 24px 12px' }}>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'#9ca3af', pointerEvents:'none' }}>Ã°ÂÂÂ</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, company, emailÃ¢ÂÂ¦"
              style={{ paddingLeft:28, paddingRight:10, paddingTop:6, paddingBottom:6,
                borderRadius:8, border:'1px solid #e5e7eb', fontSize:12, width:190, outline:'none', background:'#f9fafb' }} />
          </div>

          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <span style={{ fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Stage:</span>
            {['all', ...ALL_STAGES].map(s => {
              const m = STAGE_META[s]; const active = stageFilter === s;
              return (
                <button key={s} onClick={() => setStageFilter(s)}
                  style={{ padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:'none',
                    background:active?(m?.bg||'#dbeafe'):'#f3f4f6', color:active?(m?.color||'#1d4ed8'):'#6b7280' }}>
                  {s==='all' ? `All (${totalInQueue})` : `${s} (${stageCounts[s]||0})`}
                </button>
              );
            })}
          </div>

          <div style={{ display:'flex', gap:4 }}>
            {['overdue','today','week','later'].map(t => (
              <button key={t} onClick={() => setTimingFilter(f => f===t?'all':t)}
                style={{ padding:'4px 9px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:'none',
                  background:timingFilter===t?'#dbeafe':'#f3f4f6', color:timingFilter===t?'#1d4ed8':'#6b7280' }}>
                {t==='overdue'?'Ã°ÂÂÂ´':t==='today'?'Ã°ÂÂÂ¢':t==='week'?'Ã°ÂÂÂ¡':'Ã°ÂÂÂ'} {t}
              </button>
            ))}
          </div>

          <select value={responseFilter} onChange={e => setResponseFilter(e.target.value)}
            style={{ padding:'5px 8px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:12, background:'#f9fafb', color:'#374151', cursor:'pointer' }}>
            <option value="all">All responses</option>
            {Object.entries(RESPONSE_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          {uniqueCompanies.length > 1 && (
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
              style={{ padding:'5px 8px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:12, background:'#f9fafb', color:'#374151', cursor:'pointer', maxWidth:170 }}>
              <option value="all">All companies</option>
              {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {anyFilter && (
            <button onClick={clearFilters}
              style={{ padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:500, color:'#dc2626', background:'#fef2f2', border:'none', cursor:'pointer' }}>
              Ã¢ÂÂ Clear
            </button>
          )}
        </div>
      </div>

      {/* Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ CONTENT Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 20px', color:'#9ca3af' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>Ã¢ÂÂ³</div>Loading queueÃ¢ÂÂ¦
          </div>
        ) : totalInQueue === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 20px' }}>
            <div style={{ fontSize:44, marginBottom:14 }}>Ã°ÂÂÂ</div>
            <div style={{ fontSize:16, fontWeight:700, color:'#374151' }}>Queue is empty!</div>
            <div style={{ fontSize:13, color:'#6b7280', marginTop:6 }}>
              Go to Accounts Ã¢ÂÂ select a contact Ã¢ÂÂ click <strong>Ã°ÂÂÂ Start</strong> to begin outreach
            </div>
          </div>
        ) : noResults ? (
          <div style={{ textAlign:'center', padding:'80px 20px' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>Ã°ÂÂÂ</div>
            <div style={{ fontSize:14, fontWeight:600, color:'#374151' }}>No matches</div>
            <button onClick={clearFilters}
              style={{ marginTop:14, padding:'8px 18px', background:'#2563eb', color:'#fff', borderRadius:8, border:'none', fontSize:13, cursor:'pointer', fontWeight:600 }}>
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {/* Ã¢ÂÂÃ¢ÂÂ FRESH / NEW CONTACTS SECTION Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */}
            {showFresh && filteredFresh.length > 0 && (
              <FreshSection
                contacts={filteredFresh}
                {...sharedProps}
              />
            )}

            {/* Ã¢ÂÂÃ¢ÂÂ F1-F5 TIMING GROUPS Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */}
            {(stageFilter === 'all' || stageFilter !== 'Fresh') && activeGroups.map(group => (
              <TimingGroup key={group.key} group={group} {...sharedProps} />
            ))}
          
            {/* ── COOLING OFF SECTION ──────────────────────── */}
            {coolingOffList.length > 0 && stageFilter === 'all' && (
              <div style={{ marginBottom:28, marginTop:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#0369a1', padding:'3px 14px',
                    background:'#e0f2fe', borderRadius:20, flexShrink:0 }}>
                    ❄️ Cooling Off · {coolingOffList.length}
                  </span>
                  <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {coolingOffList.map(c => (
                    <div key={c.id} style={{ background:'#fff', border:'1px solid #bae6fd', borderLeft:'3px solid #0369a1', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>{c.first_name} {c.last_name}</div>
                        <div style={{ fontSize:11, color:'#6b7280' }}>{c.title}{c.title ? ' · ' : ''}{(accounts[c.account_id]||{}).name||c.company||''}</div>
                      </div>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:8, background:'#e0f2fe', color:'#0369a1' }}>Cooling Off</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Ã¢ÂÂÃ¢ÂÂ FreshSection Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

function FreshSection({ contacts, ...props }) {
  const readyItems = contacts.filter(c => c._hasDraft);
  const needsItems = contacts.filter(c => !c._hasDraft);

  // Sort: ready first, then by due date
  const sorted = [
    ...readyItems.sort((a, b) => (a._due || 0) - (b._due || 0)),
    ...needsItems.sort((a, b) => (a._due || 0) - (b._due || 0)),
  ];

  return (
    <div style={{ marginBottom:28 }}>
      {/* Section header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        <span style={{ fontSize:12, fontWeight:700, color:'#1d4ed8', padding:'3px 14px',
          background:'#dbeafe', borderRadius:20, flexShrink:0 }}>
          Ã°ÂÂÂ© New Contacts ÃÂ· {contacts.length}
        </span>
        <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
        <span style={{ fontSize:11, color:'#6b7280', flexShrink:0 }}>Draft initial email Ã¢ÂÂ Mark Sent Ã¢ÂÂ moves to F1</span>
        {readyItems.length > 0 && (
          <span style={{ fontSize:11, fontWeight:600, color:'#7c3aed', padding:'2px 9px',
            background:'#f5f3ff', borderRadius:12, border:'1px solid #ede9fe', flexShrink:0 }}>
            {readyItems.length} Ã¢ÂÂ¨ ready
          </span>
        )}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        {sorted.map(c => (
          <ContactRow key={c.id} contact={c} {...props} isFresh />
        ))}
      </div>
    </div>
  );
}

// Ã¢ÂÂÃ¢ÂÂ TimingGroup Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

function TimingGroup({ group, ...props }) {
  const readyItems = group.items.filter(c => c._hasDraft);
  const needsItems = group.items.filter(c => !c._hasDraft);

  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        <span style={{ fontSize:12, fontWeight:700, color:group.color, padding:'3px 14px',
          background:group.color+'18', borderRadius:20, flexShrink:0 }}>
          {group.label} ÃÂ· {group.items.length}
        </span>
        <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
        {readyItems.length > 0 && (
          <span style={{ fontSize:11, fontWeight:600, color:'#7c3aed', padding:'2px 9px',
            background:'#f5f3ff', borderRadius:12, border:'1px solid #ede9fe', flexShrink:0 }}>
            {readyItems.length} Ã¢ÂÂ¨ ready to send
          </span>
        )}
      </div>

      {readyItems.length > 0 && (
        <>
          <div style={{ fontSize:10, fontWeight:700, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, paddingLeft:4 }}>
            Ã¢ÂÂ Ready to Send
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom: needsItems.length ? 14 : 0 }}>
            {readyItems.map(c => <ContactRow key={c.id} contact={c} {...props} />)}
          </div>
        </>
      )}

      {needsItems.length > 0 && (
        <>
          {readyItems.length > 0 && (
            <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, paddingLeft:4 }}>
              Ã¢ÂÂ³ Needs Email
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {needsItems.map(c => <ContactRow key={c.id} contact={c} {...props} />)}
          </div>
        </>
      )}

      {/* Cooling Off Section */}
      {coolingOffList.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#0369a1', background:'#e0f2fe', padding:'4px 14px', borderRadius:20, flexShrink:0 }}>
              ❄️ Cooling Off · {coolingOffList.length}
            </span>
            <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {coolingOffList.map(c => (
              <div key={c.id} style={{ background:'#fff', border:'1px solid #bae6fd', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>{c.full_name}</div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>{c.title} · {(accounts[c.account_id]||{}).name||c.company||''}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:8, background:'#e0f2fe', color:'#0369a1' }}>Cooling Off</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// Ã¢ÂÂÃ¢ÂÂ ContactRow Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

function ContactRow({ contact:c, accounts, drafts, drafting, draftOpen, copied, markingSent,
  onGenerate, onToggleDraft, onRegenerate, onMarkSent, onSnooze, onCopy, onView, isFresh,
  customPrompts, onCustomPromptChange }) {

  const customPrompt = customPrompts?.[c.id] || '';

  const sm       = STAGE_META[c.status] || { bg:'#f1f5f9', color:'#475569', label:c.status };
  const rm       = c.response_type ? RESPONSE_META[c.response_type] : null;
  const account  = accounts[c.account_id];
  const draft    = drafts[c.id];
  const hasDraft = !!draft;
  const isOverdue   = c._bucket === 'overdue';
  const isDrafting  = drafting === c.id;
  const isDraftOpen = draftOpen === c.id;
  const isMarking   = markingSent === c.id;
  const isCopied    = copied === c.id;
  const ac = avatarColor(((c.first_name || '') + ' ' + (c.last_name || '')).trim());

  const markSentLabel = c.status === 'Fresh' ? 'Ã¢ÂÂ Send Ã¢ÂÂ F1' : 'Ã¢ÂÂ Mark Sent';
  const draftBtnLabel = isDrafting ? 'Ã¢ÂÂ¨ DraftingÃ¢ÂÂ¦'
    : hasDraft ? (isDraftOpen ? 'Ã°ÂÂÂ§ Hide' : 'Ã°ÂÂÂ§ Show Draft')
    : c.status === 'Fresh' ? 'Ã¢ÂÂ¨ Draft Initial Email'
    : 'Ã¢ÂÂ¨ Draft Email';

  return (
    <div style={{
      background:'#fff', borderRadius:10, overflow:'hidden',
      border:`1px solid ${hasDraft?'#e9d5ff':isFresh?'#bfdbfe':'#e5e7eb'}`,
      borderLeft:`3px solid ${hasDraft?'#7c3aed':isFresh?'#2563eb':isOverdue?'#ef4444':'#e5e7eb'}`,
      boxShadow:hasDraft?'0 1px 6px rgba(124,58,237,0.09)':isFresh?'0 1px 4px rgba(37,99,235,0.07)':'0 1px 3px rgba(0,0,0,0.04)',
    }}>

      {/* Main row */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px' }}>
        <div onClick={() => onView(c.id)}
          style={{ width:36, height:36, borderRadius:'50%', background:ac, color:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700,
            flexShrink:0, cursor:'pointer', userSelect:'none' }}>
          {getInitials(((c.first_name || '') + ' ' + (c.last_name || '')).trim())}
        </div>

        <div style={{ flex:'0 0 210px', minWidth:0, cursor:'pointer' }} onClick={() => onView(c.id)}>
          <div style={{ fontSize:13, fontWeight:600, color:'#111', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {((c.first_name || '') + ' ' + (c.last_name || '')).trim()}
          </div>
          <div style={{ fontSize:11, color:'#6b7280', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {c.title?`${c.title} ÃÂ· `:''}{c.company||'Ã¢ÂÂ'}
          </div>
        </div>

        <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:6, background:sm.bg, color:sm.color, flexShrink:0, whiteSpace:'nowrap' }}>
          {sm.label}
        </span>

        {rm && (
          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:rm.bg, color:rm.color, fontWeight:500, flexShrink:0 }}>
            {rm.label}
          </span>
        )}

        {account && (
          <span style={{ fontSize:11, color:'#6b7280', flexShrink:0, maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            Ã°ÂÂÂ¢ {account.name}
          </span>
        )}

        <div style={{ flex:1 }} />

        <div style={{ fontSize:11, fontWeight:600, flexShrink:0, width:72, textAlign:'right',
          color:isOverdue?'#dc2626':c._due?'#374151':'#d1d5db' }}>
          {isOverdue && 'Ã¢ÂÂ  '}{formatDue(c._due)}
        </div>

        <div style={{ display:'flex', gap:5, flexShrink:0, alignItems:'center' }}>
          <button onClick={hasDraft ? () => onToggleDraft(c) : () => onGenerate(c, customPrompt)} disabled={isDrafting}
            style={{ padding:'5px 11px', borderRadius:7, fontSize:11, fontWeight:600, border:'none',
              cursor:isDrafting?'wait':'pointer',
              background:hasDraft?(isDraftOpen?'#ede9fe':'#f5f3ff'):'linear-gradient(135deg,#7c3aed,#2563eb)',
              color:hasDraft?'#7c3aed':'#fff',
              boxShadow:!hasDraft?'0 1px 4px rgba(37,99,235,0.3)':'none' }}>
            {draftBtnLabel}
          </button>

          {hasDraft && (
            <button onClick={() => onMarkSent(c)} disabled={isMarking}
              style={{ padding:'5px 11px', borderRadius:7, fontSize:11, fontWeight:700, border:'none',
                background:isMarking?'#d1fae5':'#059669', color:'#fff', cursor:isMarking?'wait':'pointer',
                boxShadow:'0 1px 4px rgba(5,150,105,0.3)' }}>
              {isMarking ? 'Ã¢ÂÂ Done!' : markSentLabel}
            </button>
          )}

          <select onChange={e => { if(e.target.value){ onSnooze(c.id, Number(e.target.value)); e.target.value=''; } }}
            style={{ padding:'5px 6px', borderRadius:7, border:'1px solid #e5e7eb', fontSize:11, background:'#f9fafb', color:'#374151', cursor:'pointer' }}>
            <option value="">SnoozeÃ¢ÂÂ¦</option>
            <option value="1">Tomorrow</option>
            <option value="3">3 days</option>
            <option value="7">1 week</option>
            <option value="14">2 weeks</option>
          </select>

          <button onClick={() => onView(c.id)}
            style={{ padding:'5px 9px', borderRadius:7, fontSize:11, fontWeight:600, border:'1px solid #e5e7eb', background:'#fff', color:'#6b7280', cursor:'pointer' }}>
            Ã¢ÂÂ
          </button>
        </div>
      </div>

      {/* Draft panel */}
      {isDraftOpen && (
        <div style={{ borderTop:`1px solid ${hasDraft?'#ede9fe':'#f3f4f6'}`, background:'linear-gradient(to bottom,#fdf8ff,#faf5ff)', padding:'14px 16px' }}>
          {isDrafting ? (
            <div style={{ textAlign:'center', padding:'28px 0', color:'#7c3aed' }}>
              <div style={{ fontSize:26, marginBottom:10 }}>Ã¢ÂÂ¨</div>
              <div style={{ fontSize:13, fontWeight:700 }}>
                {c.status === 'Fresh' ? 'Generating initial cold emailÃ¢ÂÂ¦' : `Generating ${sm.label} emailÃ¢ÂÂ¦`}
              </div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:5 }}>Using account research + prior email context</div>
            </div>
          ) : draft ? (
            <>
              <div style={{ marginBottom:12 }}>
                <textarea
                  value={customPrompt}
                  onChange={e => onCustomPromptChange(c.id, e.target.value)}
                  placeholder="Add custom instructionsÃ¢ÂÂ¦ (e.g. 'mention their Selenium migration', 'keep under 80 words', 'focus on ROI')"
                  rows={2}
                  style={{ width:'100%', fontSize:12, padding:'8px 10px', borderRadius:7, border:'1px solid #d8b4fe',
                    background:'#faf5ff', color:'#374151', resize:'vertical', fontFamily:'inherit',
                    outline:'none', boxSizing:'border-box', lineHeight:1.5 }}
                />
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#374151', flex:1 }}>
                  Ã¢ÂÂÃ¯Â¸Â {c.status === 'Fresh' ? 'AI Draft Ã¢ÂÂ Initial Email' : `AI Draft Ã¢ÂÂ ${sm.label}`}
                </div>
                <button onClick={() => onRegenerate(c, customPrompt)}
                  style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'1px solid #e5e7eb', background:'#fff', color:'#7c3aed', cursor:'pointer', fontWeight:500 }}>
                  Ã¢ÂÂ» Regenerate
                </button>
                <button onClick={() => onCopy(c.id)}
                  style={{ fontSize:11, padding:'3px 12px', borderRadius:6, border:'none',
                    background:isCopied?'#059669':'#6d28d9', color:'#fff', cursor:'pointer', fontWeight:600, transition:'background 0.2s' }}>
                  {isCopied ? 'Ã¢ÂÂ Copied!' : 'Ã°ÂÂÂ Copy'}
                </button>
                <button onClick={() => onMarkSent(c)} disabled={isMarking}
                  style={{ fontSize:11, padding:'3px 12px', borderRadius:6, border:'none',
                    background:isMarking?'#6ee7b7':'#059669', color:'#fff', cursor:isMarking?'wait':'pointer', fontWeight:700 }}>
                  {isMarking ? 'Ã¢ÂÂ Done!' : markSentLabel}
                </button>
                <a href={`mailto:${c.email || ''}?subject=${encodeURIComponent(draft?.subject || '')}&body=${encodeURIComponent(draft?.body || '')}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:11, padding:'3px 12px', borderRadius:6, border:'1px solid #0078d4',
                    background:'#fff', color:'#0078d4', cursor:'pointer', fontWeight:600,
                    textDecoration:'none', display:'inline-block', whiteSpace:'nowrap' }}>
                  Ã°ÂÂÂ§ Draft in Outlook
                </a>
              </div>

              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Subject</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#111', padding:'8px 11px', background:'#fff', borderRadius:7, border:'1px solid #e5e7eb' }}>
                  {draft.subject}
                </div>
              </div>

              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Body</div>
                <div style={{ fontSize:12, lineHeight:1.85, color:'#374151', padding:'10px 13px', background:'#fff', borderRadius:7, border:'1px solid #e5e7eb', whiteSpace:'pre-wrap', fontFamily:'inherit' }}>
                  {draft.body}
                </div>
              </div>

              <div style={{ marginTop:10, fontSize:11, color:'#9ca3af' }}>
                Ã¢ÂÂ  Review and personalise before sending ÃÂ· click <strong style={{ color:'#059669' }}>{markSentLabel}</strong> after you send it
              </div>
            </>
          ) : !isDrafting ? (
            <div style={{ padding:'8px 0 4px' }}>
              <textarea
                value={customPrompt}
                onChange={e => onCustomPromptChange(c.id, e.target.value)}
                placeholder="Optional: add instructions before generatingÃ¢ÂÂ¦ (e.g. 'focus on cost savings', 'mention their SAP stack')"
                rows={2}
                style={{ width:'100%', fontSize:12, padding:'8px 10px', borderRadius:7, border:'1px solid #d8b4fe',
                  background:'#faf5ff', color:'#374151', resize:'vertical', fontFamily:'inherit',
                  outline:'none', boxSizing:'border-box', lineHeight:1.5, marginBottom:10 }}
              />
              <button onClick={() => onGenerate(c, customPrompt)}
                style={{ padding:'7px 18px', borderRadius:8, fontSize:12, fontWeight:700, border:'none',
                  background:'linear-gradient(135deg,#7c3aed,#2563eb)', color:'#fff', cursor:'pointer',
                  boxShadow:'0 1px 4px rgba(37,99,235,0.3)' }}>
                Ã¢ÂÂ¨ Generate Email
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
