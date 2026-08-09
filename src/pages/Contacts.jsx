import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const STAGES = ['Fresh','F1','F2','F3','F4','F5','won','lost','bounced','unsubscribed'];
const STEP_MAP = { Fresh:0, F1:1, F2:2, F3:3, F4:4, F5:5 };
const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

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

const RESPONSE_COLORS = {
  warm:          { bg: '#fef9c3', color: '#854d0e', label: '🟡 Warm' },
  prospect:      { bg: '#d1fae5', color: '#065f46', label: '🟢 Prospect' },
  cold:          { bg: '#e0f2fe', color: '#0369a1', label: '🔵 Cold' },
  negative:      { bg: '#fee2e2', color: '#991b1b', label: '🔴 Negative' },
  not_interested:{ bg: '#f1f5f9', color: '#475569', label: '⬜ Not interested' },
  bounce:        { bg: '#fee2e2', color: '#991b1b', label: '⛔ Bounce' },
};

export default function Contacts() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data + pagination
  const [contacts, setContacts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stageCounts, setStageCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showBounced, setShowBounced] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Bulk select
  const [selected, setSelected] = useState(new Set());
  const [bulkStage, setBulkStage] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [toast, setToast] = useState(null);

  // Smart select popover
  const [showSmartSelect, setShowSmartSelect] = useState(false);
  const [smartN, setSmartN] = useState(25);
  const [smartMaxPerCompany, setSmartMaxPerCompany] = useState(false);
  const [smartMaxN, setSmartMaxN] = useState(1);
  const smartRef = useRef(null);

  // Add contact modal
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ full_name:'', email:'', company:'', title:'', country:'', seniority:'', status:'Fresh' });
  const [adding, setAdding] = useState(false);

  function showToast(msg, type='success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // Close smart select on outside click
  useEffect(() => {
    function handleClick(e) {
      if (smartRef.current && !smartRef.current.contains(e.target)) setShowSmartSelect(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch page + stage counts
  const fetchContacts = useCallback(async () => {
    setLoading(true);

    // Build base query
    let q = supabase.from('contacts').select('*', { count: 'exact' })
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (filter !== 'all') q = q.eq('status', filter);
    if (!showBounced) q = q.eq('bounced', false);
    if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);

    q = q.range(page * pageSize, (page + 1) * pageSize - 1);

    const { data, count } = await q;
    setContacts(data || []);
    setTotalCount(count || 0);
    setSelected(new Set());

    // Stage counts (separate query, no pagination)
    const { data: allForCount } = await supabase
      .from('contacts').select('status, bounced')
      .eq('owner_id', user.id);
    const counts = {};
    STAGES.forEach(s => { counts[s] = (allForCount || []).filter(c => c.status === s).length; });
    setStageCounts(counts);

    setLoading(false);
  }, [user.id, filter, search, page, pageSize, showBounced]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Reset to page 0 when filter/search changes
  useEffect(() => { setPage(0); }, [filter, search, showBounced, pageSize]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // ── Selection helpers ──
  const allChecked = contacts.length > 0 && contacts.every(c => selected.has(c.id));
  const someChecked = contacts.some(c => selected.has(c.id)) && !allChecked;

  function toggleOne(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    if (allChecked) {
      setSelected(prev => { const n = new Set(prev); contacts.forEach(c => n.delete(c.id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); contacts.forEach(c => n.add(c.id)); return n; });
    }
  }

  // Smart select: pick N contacts with optional max-per-company
  function applySmartSelect() {
    const companyCounts = {};
    const picked = new Set();
    for (const c of contacts) {
      if (picked.size >= smartN) break;
      if (smartMaxPerCompany) {
        const key = (c.company || '').toLowerCase();
        if ((companyCounts[key] || 0) >= smartMaxN) continue;
        companyCounts[key] = (companyCounts[key] || 0) + 1;
      }
      picked.add(c.id);
    }
    setSelected(picked);
    setShowSmartSelect(false);
  }

  // ── Bulk: change stage ──
  async function bulkChangeStage() {
    if (!bulkStage || selected.size === 0) return;
    setBulkWorking(true);
    const ids = Array.from(selected);
    const update = { status: bulkStage };
    if (STEP_MAP[bulkStage] !== undefined) update.sequence_step = STEP_MAP[bulkStage];
    await supabase.from('contacts').update(update).in('id', ids);
    setBulkStage('');
    await fetchContacts();
    setBulkWorking(false);
  }

  // ── Bulk: delete ──
  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} contact${selected.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkWorking(true);
    const ids = Array.from(selected);
    const { data: deletedCount, error } = await supabase.rpc('bulk_delete_contacts', { contact_ids: ids });
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else showToast(`${deletedCount} contact${deletedCount !== 1 ? 's' : ''} deleted`);
    await fetchContacts();
    setBulkWorking(false);
  }

  // ── Bulk: export CSV ──
  function bulkExport() {
    const rows = contacts.filter(c => selected.has(c.id));
    const headers = ['Name','Email','Company','Title','Seniority','Country','Stage','Response','Last Emailed','Next Follow-up'];
    const lines = rows.map(c => [
      c.full_name, c.email, c.company, c.title || '', c.seniority || '', c.country || '',
      c.status, c.response || '',
      c.last_contacted ? new Date(c.last_contacted).toLocaleDateString() : '',
      c.next_followup ? new Date(c.next_followup).toLocaleDateString() : '',
    ].map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','));
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `contacts_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  // ── Single: update status ──
  async function updateStatus(id, status) {
    const update = { status };
    if (STEP_MAP[status] !== undefined) update.sequence_step = STEP_MAP[status];
    await supabase.from('contacts').update(update).eq('id', id);
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: id, activity_type: 'status_changed', details: { status }
    });
    fetchContacts();
  }

  // ── Add contact ──
  async function addContact() {
    if (!newContact.full_name.trim()) return;
    setAdding(true);
    let account_id = null;
    if (newContact.company.trim()) {
      const { data: existing } = await supabase.from('accounts')
        .select('id').eq('owner_id', user.id).ilike('name', newContact.company.trim()).single();
      if (existing) account_id = existing.id;
      else {
        const { data: created } = await supabase.from('accounts').insert({
          name: newContact.company.trim(), owner_id: user.id
        }).select('id').single();
        if (created) account_id = created.id;
      }
    }
    await supabase.from('contacts').insert({
      owner_id: user.id,
      full_name: newContact.full_name.trim(),
      email: newContact.email.trim() || null,
      company: newContact.company.trim() || null,
      title: newContact.title.trim() || null,
      seniority: newContact.seniority.trim() || null,
      country: newContact.country.trim() || null,
      status: newContact.status,
      sequence_step: STEP_MAP[newContact.status] ?? 0,
      account_id,
    });
    setAdding(false);
    setShowAddContact(false);
    setNewContact({ full_name:'', email:'', company:'', title:'', country:'', seniority:'', status:'Fresh' });
    fetchContacts();
  }

  const selCount = selected.size;
  const activeCount = stageCounts ? Object.entries(stageCounts).filter(([s]) => !['bounced','unsubscribed'].includes(s)).reduce((a,b) => a + b[1], 0) : 0;

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>My Contacts</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>
            {totalCount} total · {stageCounts['bounced'] || 0} bounced
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowAddContact(true)}
            style={{ padding: '8px 16px', background: '#fff', border: '1px solid #e0e0e0', color: '#111', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            + Add Contact
          </button>
          <UploadCSV userId={user.id} onDone={fetchContacts} />
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, company…"
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, width: 220, outline: 'none', marginRight: 4 }} />
        <button onClick={() => setFilter('all')}
          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, cursor: 'pointer',
            background: filter === 'all' ? '#111' : '#f0f0ee', color: filter === 'all' ? '#fff' : '#666', fontWeight: 500 }}>
          All ({totalCount})
        </button>
        {STAGES.filter(s => stageCounts[s] > 0 || filter === s).map(s => {
          const sc = STAGE_COLORS[s];
          return (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${filter === s ? sc.color : '#e0e0e0'}`,
                fontSize: 12, cursor: 'pointer', fontWeight: filter === s ? 600 : 400,
                background: filter === s ? sc.bg : '#fff', color: filter === s ? sc.color : '#666' }}>
              {s} ({stageCounts[s] || 0})
            </button>
          );
        })}
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#888', cursor: 'pointer', marginLeft: 4 }}>
          <input type="checkbox" checked={showBounced} onChange={e => setShowBounced(e.target.checked)} />
          Show bounced
        </label>
      </div>

      {/* Bulk action bar */}
      {selCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>{selCount} selected</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8, flexWrap: 'wrap' }}>
            <select value={bulkStage} onChange={e => setBulkStage(e.target.value)}
              style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#fff', cursor: 'pointer' }}>
              <option value="">Change stage…</option>
              {STAGES.filter(s => s !== 'bounced').map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={bulkChangeStage} disabled={!bulkStage || bulkWorking}
              style={{ padding: '5px 12px', background: bulkStage ? '#2563eb' : '#e0e0e0', color: bulkStage ? '#fff' : '#999', borderRadius: 6, fontSize: 12, border: 'none', cursor: bulkStage ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
              {bulkWorking ? '…' : 'Apply'}
            </button>
            <div style={{ width: 1, height: 24, background: '#bfdbfe' }} />
            <button onClick={bulkExport}
              style={{ padding: '5px 12px', background: '#fff', color: '#2563eb', borderRadius: 6, fontSize: 12, border: '1px solid #bfdbfe', cursor: 'pointer', fontWeight: 500 }}>
              ⬇️ Export CSV
            </button>
            <button onClick={bulkDelete} disabled={bulkWorking}
              style={{ padding: '5px 12px', background: '#fff', color: '#dc2626', borderRadius: 6, fontSize: 12, border: '1px solid #fecaca', cursor: 'pointer', fontWeight: 500 }}>
              🗑 Delete
            </button>
            <button onClick={() => setSelected(new Set())}
              style={{ padding: '5px 10px', background: 'none', color: '#888', borderRadius: 6, fontSize: 12, border: 'none', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid #e8e8e4' }}>
              {/* Checkbox with smart select */}
              <th style={{ padding: '10px 14px', width: 36 }}>
                <div style={{ position: 'relative' }} ref={smartRef}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked; }}
                      onChange={toggleAll} style={{ cursor: 'pointer', width: 14, height: 14 }} />
                    <span onClick={() => setShowSmartSelect(v => !v)}
                      style={{ fontSize: 10, cursor: 'pointer', color: '#aaa', userSelect: 'none' }}>▾</span>
                  </div>
                  {/* Smart select popover */}
                  {showSmartSelect && (
                    <div style={{ position: 'absolute', top: 28, left: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 16, width: 240, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Select contacts</div>
                      {/* Option 1: Select N */}
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
                        <input type="radio" name="smartMode" defaultChecked style={{ marginTop: 2 }} />
                        <div>
                          <div style={{ fontSize: 13, color: '#111', marginBottom: 6 }}>Select number of people</div>
                          <input type="number" min={1} max={totalCount} value={smartN}
                            onChange={e => setSmartN(Number(e.target.value))}
                            style={{ width: 70, padding: '4px 8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 13 }} />
                          <div style={{ marginTop: 8 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', cursor: 'pointer' }}>
                              <input type="checkbox" checked={smartMaxPerCompany} onChange={e => setSmartMaxPerCompany(e.target.checked)} />
                              Max per company
                              <input type="number" min={1} value={smartMaxN}
                                onChange={e => setSmartMaxN(Number(e.target.value))}
                                disabled={!smartMaxPerCompany}
                                style={{ width: 45, padding: '3px 6px', borderRadius: 5, border: '1px solid #e0e0e0', fontSize: 12, opacity: smartMaxPerCompany ? 1 : 0.4 }} />
                            </label>
                          </div>
                        </div>
                      </label>
                      {/* Option 2: Select all visible */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}
                        onClick={() => { contacts.forEach(c => selected.add(c.id)); setSelected(new Set(selected)); setShowSmartSelect(false); }}>
                        <input type="radio" name="smartMode" />
                        <span style={{ fontSize: 13, color: '#111' }}>Select all visible <span style={{ color: '#888' }}>{contacts.length}</span></span>
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={applySmartSelect}
                          style={{ flex: 1, padding: '7px 0', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Apply
                        </button>
                        <button onClick={() => setShowSmartSelect(false)}
                          style={{ padding: '7px 12px', background: '#f5f5f5', color: '#555', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </th>
              {['Name','Company','Designation','Level','Email','Stage','Response','Last emailed','Next follow-up','Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#999', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>Loading…</td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>No contacts found</td></tr>
            ) : contacts.map(c => {
              const sc = STAGE_COLORS[c.status] || { bg: '#f1f5f9', color: '#475569' };
              const rc = c.response ? RESPONSE_COLORS[c.response] : null;
              const isSelected = selected.has(c.id);
              return (
                <tr key={c.id}
                  style={{ borderBottom: '0.5px solid #f0f0ee', opacity: c.bounced ? 0.6 : 1,
                    background: isSelected ? '#eff6ff' : 'transparent', cursor: 'pointer' }}
                  onClick={() => navigate(`/contacts/${c.id}`)}>
                  <td style={{ padding: '10px 14px' }} onClick={e => { e.stopPropagation(); toggleOne(c.id); }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleOne(c.id)}
                      style={{ cursor: 'pointer', width: 14, height: 14 }} />
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                    {c.full_name}
                    {c.bounced && <span style={{ marginLeft: 6, fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 10 }}>BOUNCED</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#555' }}>{c.company || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#666', fontSize: 12 }}>{c.title || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {c.seniority ? (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f1f5f9', color: '#475569', fontWeight: 500 }}>{c.seniority}</span>
                    ) : <span style={{ color: '#ccc', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#555', fontSize: 12 }}>{c.email || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{c.status}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {rc ? <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: rc.bg, color: rc.color }}>{rc.label}</span>
                       : <span style={{ color: '#ccc', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>
                    {c.last_contacted ? new Date(c.last_contacted).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>
                    {c.bounced ? <span style={{ color: '#991b1b', fontSize: 11 }}>Excluded</span>
                      : c.next_followup
                        ? <span style={{ color: new Date(c.next_followup) < new Date() ? '#dc2626' : '#555' }}>
                            {new Date(c.next_followup).toLocaleDateString()}
                          </span>
                        : <span style={{ color: '#ccc' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                    {!c.bounced && (
                      <select value={c.status} onChange={e => updateStatus(c.id, e.target.value)}
                        style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
                        {STAGES.filter(s => s !== 'bounced').map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#888' }}>Rows per page:</span>
          {PAGE_SIZE_OPTIONS.map(n => (
            <button key={n} onClick={() => setPageSize(n)}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 12, cursor: 'pointer',
                background: pageSize === n ? '#111' : '#fff', color: pageSize === n ? '#fff' : '#555', fontWeight: pageSize === n ? 600 : 400 }}>
              {n}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#888' }}>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
          </span>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 13, cursor: page === 0 ? 'not-allowed' : 'pointer', background: '#fff', color: page === 0 ? '#ccc' : '#111' }}>
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: '#555' }}>Page {page + 1} of {totalPages || 1}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 13, cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', background: '#fff', color: page >= totalPages - 1 ? '#ccc' : '#111' }}>
            Next →
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#fee2e2' : '#d1fae5',
          color: toast.type === 'error' ? '#991b1b' : '#065f46',
          border: `1px solid ${toast.type === 'error' ? '#fca5a5' : '#6ee7b7'}`,
          borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 2000 }}>
          {toast.msg}
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setShowAddContact(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 460, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Add Contact</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { key: 'full_name', label: 'Full Name *', placeholder: 'Jane Smith', full: true },
                { key: 'email', label: 'Email', placeholder: 'jane@company.com' },
                { key: 'company', label: 'Company', placeholder: 'Infosys' },
                { key: 'title', label: 'Title / Designation', placeholder: 'QA Lead' },
                { key: 'seniority', label: 'Seniority / Level', placeholder: 'VP / Director / Manager…' },
                { key: 'country', label: 'Country', placeholder: 'India' },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? 'span 2' : 'span 1' }}>
                  <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input value={newContact[f.key]} onChange={e => setNewContact({ ...newContact, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Stage</label>
                <select value={newContact.status} onChange={e => setNewContact({ ...newContact, status: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 13, cursor: 'pointer' }}>
                  {STAGES.filter(s => !['bounced','unsubscribed'].includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={addContact} disabled={adding || !newContact.full_name.trim()}
                style={{ flex: 1, padding: '9px 0', background: '#2563eb', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', opacity: adding || !newContact.full_name.trim() ? 0.6 : 1 }}>
                {adding ? 'Adding…' : 'Add Contact'}
              </button>
              <button onClick={() => setShowAddContact(false)}
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

// ── CSV field targets ──
const CSV_FIELDS = [
  { key: 'full_name',    label: 'Full Name' },
  { key: 'email',        label: 'Email' },
  { key: 'company',      label: 'Company' },
  { key: 'title',        label: 'Title / Designation' },
  { key: 'country',      label: 'Country' },
  { key: 'phone',        label: 'Phone' },
  { key: 'industry',     label: 'Industry' },
  { key: 'linkedin_url', label: 'LinkedIn URL' },
  { key: 'seniority',    label: 'Seniority / Level' },
  { key: 'pitch',        label: 'Pitch / Opening Line' },
];

// Auto-guess mapping based on header name similarity
function guessField(header) {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/fullname|name|firstname|lastname/.test(h)) return 'full_name';
  if (/email|mail/.test(h)) return 'email';
  if (/company|org|organisation|organization|employer|account/.test(h)) return 'company';
  if (/title|jobtitle|designation|position|role/.test(h)) return 'title';
  if (/country|location|geo|region/.test(h)) return 'country';
  if (/phone|mobile|cell|tel/.test(h)) return 'phone';
  if (/industry|sector|vertical/.test(h)) return 'industry';
  if (/linkedin|profile/.test(h)) return 'linkedin_url';
  if (/seniority|level|seniorit|grade|band/.test(h)) return 'seniority';
  if (/pitch|opening|intro|hook|message/.test(h)) return 'pitch';
  return '';
}

// Parse a CSV line respecting quoted fields
function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

function UploadCSV({ userId, onDone }) {
  const [step, setStep] = useState('idle'); // idle | mapping | importing | done
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.trim().split('\n').filter(l => l.trim());
      const hdrs = parseCSVLine(lines[0]);
      const dataRows = lines.slice(1).map(l => parseCSVLine(l));
      const autoMap = {};
      hdrs.forEach(h => { autoMap[h] = guessField(h); });
      setHeaders(hdrs);
      setRows(dataRows);
      setMapping(autoMap);
      setStep('mapping');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function doImport() {
    setImporting(true);
    const contacts = rows.map(row => {
      const obj = { owner_id: userId, status: 'Fresh', sequence_step: 0 };
      headers.forEach((h, i) => {
        const field = mapping[h];
        if (field) obj[field] = (row[i] || '').trim();
      });
      return obj;
    }).filter(r => r.full_name || r.email);

    // Batch insert in chunks of 500
    let total = 0;
    for (let i = 0; i < contacts.length; i += 500) {
      const chunk = contacts.slice(i, i + 500);
      const { error } = await supabase.from('contacts').insert(chunk);
      if (error) { setMsg('Import failed: ' + error.message); setImporting(false); return; }
      total += chunk.length;
    }
    // Auto-create accounts and link contacts
    await supabase.rpc('sync_accounts_from_contacts');
    setImporting(false);
    setStep('done');
    setMsg(`✓ ${total} contacts imported`);
    onDone();
    setTimeout(() => { setStep('idle'); setMsg(''); }, 4000);
  }

  function reset() { setStep('idle'); setHeaders([]); setRows([]); setMapping({}); setMsg(''); }

  // Preview: first 3 data rows
  const preview = rows.slice(0, 3);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {msg && <span style={{ fontSize: 12, color: msg.includes('failed') ? '#dc2626' : '#059669' }}>{msg}</span>}
        <label style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          + Import CSV
          <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
        </label>
      </div>

      {/* Mapping modal */}
      {step === 'mapping' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && reset()}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0ee' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Map CSV columns</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>
                {rows.length} rows detected · Match each column to a contact field
              </div>
            </div>

            {/* Mapping table */}
            <div style={{ padding: '16px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px', marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: '#999', fontWeight: 500, marginBottom: 8 }}>YOUR CSV COLUMN</div>
                <div style={{ fontSize: 11, color: '#999', fontWeight: 500, marginBottom: 8 }}>MAPS TO</div>
              </div>
              {headers.map(h => (
                <div key={h} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px', marginBottom: 10, alignItems: 'center' }}>
                  <div style={{ padding: '8px 12px', background: '#f8f8f6', borderRadius: 7, fontSize: 13, color: '#333', fontFamily: 'monospace' }}>
                    {h}
                  </div>
                  <select value={mapping[h] || ''} onChange={e => setMapping({ ...mapping, [h]: e.target.value })}
                    style={{ padding: '8px 10px', borderRadius: 7, border: `1px solid ${mapping[h] ? '#bfdbfe' : '#e0e0e0'}`, fontSize: 13, cursor: 'pointer', background: mapping[h] ? '#eff6ff' : '#fff', color: mapping[h] ? '#1d4ed8' : '#555' }}>
                    <option value="">— Skip —</option>
                    {CSV_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview */}
            {preview.length > 0 && (
              <div style={{ padding: '0 24px 16px' }}>
                <div style={{ fontSize: 11, color: '#999', fontWeight: 500, marginBottom: 8 }}>PREVIEW (first {preview.length} rows)</div>
                <div style={{ overflowX: 'auto', border: '1px solid #f0f0ee', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8f8f6' }}>
                        {headers.map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#888', fontWeight: 500, borderBottom: '1px solid #f0f0ee', whiteSpace: 'nowrap' }}>
                            {mapping[h] ? CSV_FIELDS.find(f => f.key === mapping[h])?.label : <span style={{ color: '#ccc' }}>Skip</span>}
                            <div style={{ color: '#bbb', fontWeight: 400, fontSize: 10 }}>{h}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f8f8f6' }}>
                          {row.map((cell, j) => (
                            <td key={j} style={{ padding: '6px 10px', color: mapping[headers[j]] ? '#333' : '#ccc', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cell || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #f0f0ee', display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={doImport} disabled={importing}
                style={{ padding: '9px 22px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: importing ? 0.7 : 1 }}>
                {importing ? `Importing…` : `Import ${rows.length} contacts`}
              </button>
              <button onClick={reset}
                style={{ padding: '9px 16px', background: '#f5f5f5', color: '#555', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <span style={{ fontSize: 12, color: '#aaa', marginLeft: 4 }}>
                {Object.values(mapping).filter(Boolean).length} of {headers.length} columns mapped
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
