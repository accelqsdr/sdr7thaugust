import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SENIORITY_OPTIONS = [
  { value: 'c_suite', label: 'C-Suite' }, { value: 'vp', label: 'VP' },
  { value: 'director', label: 'Director' }, { value: 'manager', label: 'Manager' },
  { value: 'senior', label: 'Senior' }, { value: 'entry', label: 'Entry' },
];
const COMPANY_SIZE_OPTIONS = [
  { value: '1,10', label: '1–10' }, { value: '11,50', label: '11–50' },
  { value: '51,200', label: '51–200' }, { value: '201,500', label: '201–500' },
  { value: '501,1000', label: '501–1K' }, { value: '1001,5000', label: '1K–5K' },
  { value: '5001,10000', label: '5K–10K' }, { value: '10001,99999', label: '10K+' },
];

const SUPABASE_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apollo-import`;

async function callFn(body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not logged in — please refresh and try again.');
  const r = await fetch(SUPABASE_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!text) throw new Error(`Server returned empty response (HTTP ${r.status})`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid response from server (HTTP ${r.status}): ${text.slice(0, 120)}`);
  }
}

function Tag({ label, onRemove }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff',
      color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>
      {label}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: 14, padding: 0 }}>×</button>
    </span>
  );
}

function ChipGroup({ options, selected, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => {
        const active = selected.includes(o.value);
        return (
          <button key={o.value} onClick={() => onChange(active ? selected.filter(v => v !== o.value) : [...selected, o.value])}
            style={{ padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${active ? '#2563eb' : '#e0e0e0'}`,
              background: active ? '#eff6ff' : '#fff', color: active ? '#2563eb' : '#555',
              fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer' }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ResultsTable({ results, selected, setSelected, onImport, importing }) {
  const selectable = results.filter(r => !r.already_imported);
  const allSelected = selectable.length > 0 && selectable.every(r => selected.has(r.apollo_id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map(r => r.apollo_id)));
  }
  function toggleOne(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  return (
    <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid #f0f0ee' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#555', cursor: 'pointer' }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ width: 14, height: 14 }} />
          Select all &nbsp;
          {selected.size > 0 && <span style={{ color: '#2563eb', fontWeight: 600 }}>({selected.size} selected)</span>}
        </label>
        <button onClick={onImport} disabled={importing || selected.size === 0}
          style={{ padding: '7px 18px', background: selected.size > 0 ? '#059669' : '#ccc',
            color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: selected.size > 0 ? 'pointer' : 'not-allowed' }}>
          {importing ? 'Importing…' : `⬇ Import ${selected.size > 0 ? selected.size + ' ' : ''}Selected`}
        </button>
      </div>
      {results.map(r => {
        const initials = ((r.first_name?.[0] || '') + (r.last_name?.[0] || '')).toUpperCase() || '?';
        const isSel = selected.has(r.apollo_id);
        return (
          <div key={r.apollo_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
            borderBottom: '0.5px solid #f5f5f3',
            background: isSel ? '#f0f7ff' : r.already_imported ? '#fafaf8' : '#fff',
            opacity: r.already_imported ? 0.6 : 1 }}>
            <input type="checkbox" checked={isSel} disabled={r.already_imported} onChange={() => toggleOne(r.apollo_id)}
              style={{ width: 14, height: 14, flexShrink: 0 }} />
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#dbeafe', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
              {initials}
            </div>
            <div style={{ flex: 1.2, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                {r.first_name} {r.last_name}
                {r.already_imported && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '1px 6px', borderRadius: 4 }}>Imported</span>}
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>{r.title}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#333' }}>{r.company}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{r.location}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
              {r.email ? <span style={{ fontSize: 12, color: '#2563eb' }}>{r.email}</span>
                       : <span style={{ fontSize: 11, color: '#ccc' }}>No email</span>}
            </div>
            {r.linkedin_url && (
              <a href={r.linkedin_url} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: '#0a66c2', textDecoration: 'none', flexShrink: 0, fontWeight: 700 }}>in</a>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ApolloImport() {
  const [mode, setMode] = useState('search'); // 'search' | 'lists'

  // Search filters
  const [keywords, setKeywords] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [titles, setTitles] = useState([]);
  const [locationInput, setLocationInput] = useState('');
  const [locations, setLocations] = useState([]);
  const [seniorities, setSeniorities] = useState([]);
  const [companySizes, setCompanySizes] = useState([]);

  // Lists
  const [lists, setLists] = useState([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [selectedList, setSelectedList] = useState(null);

  // Results
  const [results, setResults] = useState([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  function addTag(val, list, setList, setInput) {
    const t = val.trim();
    if (t && !list.includes(t)) setList([...list, t]);
    setInput('');
  }

  // Load Apollo lists when switching to lists tab
  useEffect(() => {
    if (mode === 'lists' && lists.length === 0) {
      setListsLoading(true);
      callFn({ action: 'get_lists' })
        .then(data => { setLists(data.lists || []); setListsLoading(false); })
        .catch(e => { showToast(e.message, 'error'); setListsLoading(false); });
    }
  }, [mode]);

  async function doSearch(p = 1, listId = null) {
    setSearching(true);
    setSelected(new Set());
    try {
      const filters = listId
        ? { list_id: listId, page: p }
        : { keywords, titles, locations, seniorities, company_sizes: companySizes, page: p };
      const data = await callFn({ action: 'search', filters });
      if (data.error) { showToast(data.error, 'error'); return; }
      setResults(data.people || []);
      setTotalEntries(data.total_entries || 0);
      setTotalPages(data.total_pages || 1);
      setPage(p);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSearching(false);
    }
  }

  async function doImport() {
    const toImport = results.filter(r => selected.has(r.apollo_id) && !r.already_imported);
    if (!toImport.length) { showToast('No new contacts selected', 'warn'); return; }
    setImporting(true);
    try {
      const data = await callFn({ action: 'import', contacts_to_import: toImport });
      if (data.error) { showToast(data.error, 'error'); return; }
      showToast(`✅ Imported ${data.imported} contacts${data.skipped ? ` (${data.skipped} already existed)` : ''}`);
      setResults(r => r.map(c => selected.has(c.apollo_id) ? { ...c, already_imported: true } : c));
      setSelected(new Set());
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setImporting(false);
    }
  }

  const tabStyle = (active) => ({
    padding: '8px 18px', fontSize: 13, fontWeight: active ? 600 : 400,
    border: 'none', borderRadius: 8, cursor: 'pointer',
    background: active ? '#2563eb' : 'transparent',
    color: active ? '#fff' : '#666',
  });

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>Apollo Import</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>Search Apollo's database or import from your saved lists</p>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#f5f5f3', borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 20 }}>
        <button style={tabStyle(mode === 'search')} onClick={() => { setMode('search'); setResults([]); setSelectedList(null); }}>🔍 Search Apollo</button>
        <button style={tabStyle(mode === 'lists')}  onClick={() => { setMode('lists');  setResults([]); setSelectedList(null); }}>📋 My Lists</button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ marginBottom: 12, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: toast.type === 'error' ? '#fef2f2' : toast.type === 'warn' ? '#fffbeb' : '#f0fdf4',
          color: toast.type === 'error' ? '#dc2626' : toast.type === 'warn' ? '#d97706' : '#059669',
          border: `1px solid ${toast.type === 'error' ? '#fca5a5' : toast.type === 'warn' ? '#fcd34d' : '#86efac'}` }}>
          {toast.msg}
        </div>
      )}

      {/* No API key banner */}
      {results.length === 0 && !searching && toast?.msg?.includes('No Apollo API key') && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>Apollo API key not set</div>
          <p style={{ fontSize: 13, color: '#78350f', margin: 0 }}>
            Go to <strong>Settings</strong> → Apollo.io API Key and paste your key. Each user connects their own Apollo account.
          </p>
        </div>
      )}

      {/* ── SEARCH MODE ── */}
      {mode === 'search' && (
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Keywords</label>
              <input value={keywords} onChange={e => setKeywords(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch(1)}
                placeholder="QA Engineer, SDET, Test Automation…"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Job Titles</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                {titles.map(t => <Tag key={t} label={t} onRemove={() => setTitles(titles.filter(x => x !== t))} />)}
              </div>
              <input value={titleInput} onChange={e => setTitleInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(titleInput, titles, setTitles, setTitleInput); }}}
                placeholder="Type and press Enter"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Locations</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                {locations.map(l => <Tag key={l} label={l} onRemove={() => setLocations(locations.filter(x => x !== l))} />)}
              </div>
              <input value={locationInput} onChange={e => setLocationInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(locationInput, locations, setLocations, setLocationInput); }}}
                placeholder="Type and press Enter"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Seniority</label>
              <ChipGroup options={SENIORITY_OPTIONS} selected={seniorities} onChange={setSeniorities} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Company Size</label>
            <ChipGroup options={COMPANY_SIZE_OPTIONS} selected={companySizes} onChange={setCompanySizes} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => doSearch(1)} disabled={searching}
              style={{ padding: '9px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: searching ? 0.7 : 1 }}>
              {searching ? 'Searching…' : '🔍 Search Apollo'}
            </button>
          </div>
        </div>
      )}

      {/* ── LISTS MODE ── */}
      {mode === 'lists' && (
        <div style={{ marginBottom: 16 }}>
          {listsLoading ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#aaa', fontSize: 13 }}>Loading your Apollo lists…</div>
          ) : lists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#aaa', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              No lists found in your Apollo account
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {lists.map(l => (
                <div key={l.id} onClick={() => { setSelectedList(l); doSearch(1, l.id); }}
                  style={{ background: selectedList?.id === l.id ? '#eff6ff' : '#fff',
                    border: `1.5px solid ${selectedList?.id === l.id ? '#2563eb' : '#e8e8e4'}`,
                    borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>📋 {l.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{l.count?.toLocaleString() || 0} contacts</div>
                </div>
              ))}
            </div>
          )}
          {selectedList && (
            <div style={{ marginTop: 12, fontSize: 13, color: '#555' }}>
              Showing contacts from: <strong>{selectedList.name}</strong>
              {searching && ' — loading…'}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
            {totalEntries.toLocaleString()} contacts · page {page} of {totalPages}
          </div>
          <ResultsTable results={results} selected={selected} setSelected={setSelected} onImport={doImport} importing={importing} />
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
              <button onClick={() => doSearch(page - 1, selectedList?.id)} disabled={page <= 1 || searching}
                style={{ padding: '6px 14px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: '#fff' }}>← Prev</button>
              <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>Page {page} of {totalPages}</span>
              <button onClick={() => doSearch(page + 1, selectedList?.id)} disabled={page >= totalPages || searching}
                style={{ padding: '6px 14px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: '#fff' }}>Next →</button>
            </div>
          )}
        </>
      )}

      {results.length === 0 && !searching && mode === 'search' && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#aaa' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <p style={{ fontSize: 14 }}>Set your filters above and click Search Apollo</p>
        </div>
      )}
    </div>
  );
}
