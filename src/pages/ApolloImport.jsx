import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const SENIORITY_OPTIONS = [
  { value: 'c_suite',   label: 'C-Suite' },
  { value: 'vp',        label: 'VP' },
  { value: 'director',  label: 'Director' },
  { value: 'manager',   label: 'Manager' },
  { value: 'senior',    label: 'Senior' },
  { value: 'entry',     label: 'Entry' },
];

const COMPANY_SIZE_OPTIONS = [
  { value: '1,10',        label: '1–10' },
  { value: '11,50',       label: '11–50' },
  { value: '51,200',      label: '51–200' },
  { value: '201,500',     label: '201–500' },
  { value: '501,1000',    label: '501–1K' },
  { value: '1001,5000',   label: '1K–5K' },
  { value: '5001,10000',  label: '5K–10K' },
  { value: '10001,99999', label: '10K+' },
];

function Tag({ label, onRemove }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff',
      color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '2px 8px',
      fontSize: 12, fontWeight: 500 }}>
      {label}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer',
        color: '#93c5fd', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
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
              fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ApolloImport() {
  const navigate = useNavigate();

  const [keywords, setKeywords] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [titles, setTitles] = useState([]);
  const [locationInput, setLocationInput] = useState('');
  const [locations, setLocations] = useState([]);
  const [seniorities, setSeniorities] = useState([]);
  const [companySizes, setCompanySizes] = useState([]);

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
    setTimeout(() => setToast(null), 3500);
  }

  function addTag(val, list, setList, setInput) {
    const trimmed = val.trim();
    if (trimmed && !list.includes(trimmed)) setList([...list, trimmed]);
    setInput('');
  }

  async function doSearch(p = 1) {
    setSearching(true);
    setSelected(new Set());
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apollo-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          action: 'search',
          filters: { keywords, titles, locations, seniorities, company_sizes: companySizes, page: p },
        }),
      });
      const data = await resp.json();
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
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apollo-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'import', contacts_to_import: toImport }),
      });
      const data = await resp.json();
      if (data.error) { showToast(data.error, 'error'); return; }
      showToast(`✅ Imported ${data.imported} contacts${data.skipped ? ` (${data.skipped} skipped — already exist)` : ''}`);
      // Mark as imported in results
      setResults(r => r.map(c => selected.has(c.apollo_id) ? { ...c, already_imported: true } : c));
      setSelected(new Set());
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setImporting(false);
    }
  }

  const allSelectable = results.filter(r => !r.already_imported);
  const allSelected = allSelectable.length > 0 && allSelectable.every(r => selected.has(r.apollo_id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allSelectable.map(r => r.apollo_id)));
  }

  function toggleOne(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>Apollo Import</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>Search Apollo's database and import contacts directly into your platform</p>
      </div>

      {/* Search filters */}
      <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Keywords */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Keywords</label>
            <input value={keywords} onChange={e => setKeywords(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch(1)}
              placeholder="e.g. QA Engineer, SDET, Test Automation"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Titles */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Job Titles</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              {titles.map(t => <Tag key={t} label={t} onRemove={() => setTitles(titles.filter(x => x !== t))} />)}
            </div>
            <input value={titleInput} onChange={e => setTitleInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(titleInput, titles, setTitles, setTitleInput); }}}
              placeholder="Type and press Enter (e.g. VP Engineering)"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Locations */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Locations</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              {locations.map(l => <Tag key={l} label={l} onRemove={() => setLocations(locations.filter(x => x !== l))} />)}
            </div>
            <input value={locationInput} onChange={e => setLocationInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(locationInput, locations, setLocations, setLocationInput); }}}
              placeholder="Type and press Enter (e.g. United States, India)"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Seniority */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Seniority</label>
            <ChipGroup options={SENIORITY_OPTIONS} selected={seniorities} onChange={setSeniorities} />
          </div>
        </div>

        {/* Company size */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Company Size</label>
          <ChipGroup options={COMPANY_SIZE_OPTIONS} selected={companySizes} onChange={setCompanySizes} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => doSearch(1)} disabled={searching}
            style={{ padding: '9px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: searching ? 0.7 : 1 }}>
            {searching ? 'Searching…' : '🔍 Search Apollo'}
          </button>
        </div>
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

      {/* Results */}
      {results.length > 0 && (
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, overflow: 'hidden' }}>
          {/* Results header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
            borderBottom: '0.5px solid #f0f0ee' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#555', cursor: 'pointer' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ width: 14, height: 14 }} />
                Select all
              </label>
              <span style={{ fontSize: 13, color: '#888' }}>
                {totalEntries.toLocaleString()} results · showing page {page} of {totalPages}
              </span>
              {selected.size > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>{selected.size} selected</span>
              )}
            </div>
            <button onClick={doImport} disabled={importing || selected.size === 0}
              style={{ padding: '7px 18px', background: selected.size > 0 ? '#059669' : '#ccc',
                color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: selected.size > 0 ? 'pointer' : 'not-allowed', transition: 'background 0.15s' }}>
              {importing ? 'Importing…' : `⬇ Import ${selected.size > 0 ? selected.size : ''} Selected`}
            </button>
          </div>

          {/* Contact rows */}
          {results.map(r => {
            const initials = ((r.first_name?.[0] || '') + (r.last_name?.[0] || '')).toUpperCase() || '?';
            const isSelected = selected.has(r.apollo_id);
            return (
              <div key={r.apollo_id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                  borderBottom: '0.5px solid #f5f5f3',
                  background: isSelected ? '#f0f7ff' : r.already_imported ? '#fafaf8' : '#fff',
                  opacity: r.already_imported ? 0.6 : 1 }}>
                <input type="checkbox" checked={isSelected} disabled={r.already_imported}
                  onChange={() => toggleOne(r.apollo_id)}
                  style={{ width: 14, height: 14, cursor: r.already_imported ? 'default' : 'pointer', flexShrink: 0 }} />

                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#dbeafe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#2563eb', flexShrink: 0 }}>
                  {initials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                    {r.first_name} {r.last_name}
                    {r.already_imported && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '1px 6px', borderRadius: 4 }}>Imported</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 1 }}>{r.title}</div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#333' }}>{r.company}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{r.location}</div>
                </div>

                <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                  {r.email
                    ? <span style={{ fontSize: 12, color: '#2563eb' }}>{r.email}</span>
                    : <span style={{ fontSize: 11, color: '#ccc' }}>Email not available</span>}
                </div>

                {r.linkedin_url && (
                  <a href={r.linkedin_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: '#0a66c2', textDecoration: 'none', flexShrink: 0 }}>in</a>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 12 }}>
              <button onClick={() => doSearch(page - 1)} disabled={page <= 1 || searching}
                style={{ padding: '6px 14px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer', background: '#fff', color: '#555' }}>← Prev</button>
              <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>Page {page} of {totalPages}</span>
              <button onClick={() => doSearch(page + 1)} disabled={page >= totalPages || searching}
                style={{ padding: '6px 14px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12,
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer', background: '#fff', color: '#555' }}>Next →</button>
            </div>
          )}
        </div>
      )}

      {results.length === 0 && !searching && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#aaa' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <p style={{ fontSize: 14 }}>Set your filters above and click Search Apollo to find prospects</p>
        </div>
      )}
    </div>
  );
}
