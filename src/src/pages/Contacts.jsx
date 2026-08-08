import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
};

const RESPONSE_COLORS = {
  cold: { bg: '#f1f5f9', color: '#475569' },
  negative: { bg: '#fee2e2', color: '#991b1b' },
  not_interested: { bg: '#fef3c7', color: '#92400e' },
  warm: { bg: '#fef9c3', color: '#854d0e' },
  prospect: { bg: '#dcfce7', color: '#15803d' },
};

const RESPONSE_LABELS = {
  cold: 'Cold',
  negative: 'Negative',
  not_interested: 'Not Interested',
  warm: 'Warm',
  prospect: 'Prospect',
};

const ALL_STATUSES = ['fresh','contacted','replied','meeting','won','lost','bounced','unsubscribed'];
const CONTACTABLE_STATUSES = ['contacted','replied','meeting','won','lost'];

export default function Contacts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showBounced, setShowBounced] = useState(false);
  const [marking, setMarking] = useState(null);
  const [selectedList, setSelectedList] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { fetchContacts(); fetchLists(); }, [filter, selectedList]);

  async function fetchContacts() {
    setLoading(true);
    let q = supabase.from('contacts').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    if (selectedList) q = q.eq('list_id', selectedList);
    const { data } = await q;
    setContacts(data || []);
    setLoading(false);
  }

  async function fetchLists() {
    const { data } = await supabase.from('contact_lists').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
    setLists(data || []);
  }

  async function markBounced(id, reason = 'Manual') {
    setMarking(id);
    await supabase.from('contacts').update({ status: 'bounced', bounced: true, bounce_reason: reason, bounced_at: new Date().toISOString() }).eq('id', id);
    await supabase.from('activity_log').insert({ actor_id: user.id, contact_id: id, activity_type: 'bounce_detected', details: { reason } });
    setMarking(null);
    fetchContacts();
  }

  async function updateStatus(id, status) {
    await supabase.from('contacts').update({ status }).eq('id', id);
    await supabase.from('activity_log').insert({ actor_id: user.id, contact_id: id, activity_type: 'status_changed', details: { status } });
    fetchContacts();
  }

  async function updateResponse(id, response) {
    const val = response === '' ? null : response;
    await supabase.from('contacts').update({ response: val }).eq('id', id);
    await supabase.from('activity_log').insert({ actor_id: user.id, contact_id: id, activity_type: 'response_set', details: { response: val } });
    fetchContacts();
  }

  async function deleteContact(id) {
    await supabase.from('contacts').delete().eq('id', id).eq('owner_id', user.id);
    setDeleteConfirm(null);
    fetchContacts();
  }

  async function clearAllContacts() {
    await supabase.from('contacts').delete().eq('owner_id', user.id);
    setShowClearConfirm(false);
    fetchContacts();
  }

  async function deleteList(listId) {
    await supabase.from('contact_lists').delete().eq('id', listId).eq('owner_id', user.id);
    if (selectedList === listId) setSelectedList(null);
    fetchLists();
    fetchContacts();
  }

  const filtered = contacts.filter(c => {
    if (!showBounced && c.bounced) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return c.full_name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s) || c.company?.toLowerCase().includes(s);
  });

  const activeCount = contacts.filter(c => !c.bounced).length;
  const bouncedCount = contacts.filter(c => c.bounced).length;

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Lists Sidebar */}
      <div style={{ width: 200, borderRight: '0.5px solid #e8e8e4', padding: '20px 0', flexShrink: 0, background: '#fafafa' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', padding: '0 16px', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Lists</p>
        <button
          onClick={() => setSelectedList(null)}
          style={{ width: '100%', textAlign: 'left', padding: '7px 16px', fontSize: 13, border: 'none', cursor: 'pointer',
            background: selectedList === null ? '#e8f0fe' : 'transparent',
            color: selectedList === null ? '#2563eb' : '#333', fontWeight: selectedList === null ? 600 : 400 }}>
          All Contacts
        </button>
        {lists.map(l => {
          const count = contacts.filter(c => c.list_id === l.id).length;
          return (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px 2px 16px' }}>
              <button
                onClick={() => setSelectedList(l.id)}
                style={{ flex: 1, textAlign: 'left', padding: '5px 0', fontSize: 12, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: selectedList === l.id ? '#2563eb' : '#555',
                  fontWeight: selectedList === l.id ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={l.name}>
                {l.name}
                <span style={{ marginLeft: 5, fontSize: 10, color: '#aaa' }}>{count}</span>
              </button>
              <button onClick={() => deleteList(l.id)}
                style={{ fontSize: 12, color: '#ccc', border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
                title="Remove list label">×</button>
            </div>
          );
        })}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>
              {selectedList ? lists.find(l => l.id === selectedList)?.name || 'List' : 'Contacts'}
            </h1>
            <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>{activeCount} active · {bouncedCount} bounced</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setShowClearConfirm(true)}
              style={{ padding: '8px 14px', background: '#fff', color: '#dc2626', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid #fecaca' }}>
              Clear all
            </button>
            <UploadCSV userId={user.id} onDone={() => { fetchContacts(); fetchLists(); }} />
          </div>
        </div>

        {/* Clear all confirmation */}
        {showClearConfirm && (
          <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#991b1b' }}>This will permanently delete <strong>all your contacts</strong>. This cannot be undone.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowClearConfirm(false)}
                style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e0e0e0', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={clearAllContacts}
                style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Yes, delete all</button>
            </div>
          </div>
        )}

        {/* Delete single contact confirmation */}
        {deleteConfirm && (
          <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#991b1b' }}>Delete <strong>{deleteConfirm.name}</strong>? This cannot be undone.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e0e0e0', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteContact(deleteConfirm.id)}
                style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, company…"
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, width: 240, outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 4, background: '#f0f0ee', padding: 4, borderRadius: 8 }}>
            {['all', ...ALL_STATUSES].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                style={{ padding: '5px 10px', borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer',
                  background: filter === s ? '#fff' : 'transparent', color: filter === s ? '#111' : '#666', fontWeight: filter === s ? 500 : 400 }}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666', cursor: 'pointer' }}>
            <input type="checkbox" checked={showBounced} onChange={e => setShowBounced(e.target.checked)} />
            Show bounced
          </label>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid #e8e8e4' }}>
                {['Name', 'Company', 'Email', 'Status', 'Response', 'Last contacted', 'Next follow-up', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#999', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>No contacts found</td></tr>
              ) : filtered.map(c => {
                const sc = STATUS_COLORS[c.status] || { bg: '#f1f5f9', color: '#475569' };
                const rc = c.response ? RESPONSE_COLORS[c.response] : null;
                const canRespond = CONTACTABLE_STATUSES.includes(c.status);
                return (
                  <tr key={c.id} style={{ borderBottom: '0.5px solid #f0f0ee', opacity: c.bounced ? 0.6 : 1 }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                      {c.full_name}
                      {c.bounced && <span style={{ marginLeft: 6, fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 10 }}>BOUNCED</span>}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#555' }}>{c.company}</td>
                    <td style={{ padding: '10px 14px', color: '#555' }}>{c.email}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, background: sc.bg, color: sc.color, fontWeight: 500 }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {canRespond ? (
                        rc ? (
                          <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, background: rc.bg, color: rc.color, fontWeight: 500 }}>
                            {RESPONSE_LABELS[c.response]}
                          </span>
                        ) : (
                          <select value={c.response || ''} onChange={e => updateResponse(c.id, e.target.value)}
                            style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid #e0e0e0', cursor: 'pointer', color: '#888' }}>
                            <option value="">Set response…</option>
                            <option value="cold">Cold</option>
                            <option value="negative">Negative</option>
                            <option value="not_interested">Not Interested</option>
                            <option value="warm">Warm</option>
                            <option value="prospect">Prospect</option>
                          </select>
                        )
                      ) : (
                        <span style={{ color: '#ccc', fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>
                      {c.last_contacted ? new Date(c.last_contacted).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: c.bounced ? '#999' : '#111', fontSize: 12 }}>
                      {c.bounced ? <span style={{ color: '#991b1b', fontSize: 11 }}>Excluded (bounced)</span>
                        : c.response ? <span style={{ color: '#999', fontSize: 11 }}>Excluded (response set)</span>
                        : c.next_followup ? new Date(c.next_followup).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => navigate(`/contacts/${c.id}`)}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', color: '#2563eb', cursor: 'pointer', fontWeight: 500 }}>
                          View
                        </button>
                        {c.response && (
                          <button onClick={() => updateResponse(c.id, '')}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', color: '#666', cursor: 'pointer' }}
                            title="Clear response">
                            Clear
                          </button>
                        )}
                        {!c.bounced && (
                          <>
                            <select value={c.status} onChange={e => updateStatus(c.id, e.target.value)}
                              style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
                              {ALL_STATUSES.filter(s => s !== 'bounced').map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button onClick={() => markBounced(c.id)} disabled={marking === c.id}
                              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                              {marking === c.id ? '…' : 'Bounce'}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setDeleteConfirm({ id: c.id, name: c.full_name })}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UploadCSV({ userId, onDone }) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [listName, setListName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPendingFile(file);
    setListName('');
    setShowNameInput(true);
    e.target.value = '';
  }

  async function processUpload() {
    if (!listName.trim()) return;
    setUploading(true);
    setShowNameInput(false);
    setMsg('');

    // Create the list first
    const { data: listData, error: listError } = await supabase
      .from('contact_lists')
      .insert({ owner_id: userId, name: listName.trim() })
      .select()
      .single();

    if (listError) {
      setMsg('Failed to create list');
      setUploading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const lines = ev.target.result.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',');
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
        return {
          owner_id: userId,
          list_id: listData.id,
          full_name: obj.name || obj.full_name || '',
          email: obj.email || '',
          company: obj.company || '',
          title: obj.title || obj.job_title || '',
          phone: obj.phone || '',
          industry: obj.industry || '',
          status: 'fresh',
        };
      }).filter(r => r.full_name || r.email);

      const { error } = await supabase.from('contacts').insert(rows);
      setUploading(false);
      if (error) { setMsg('Upload failed: ' + error.message); }
      else { setMsg(`${rows.length} contacts imported to "${listName}"`); onDone(); }
    };
    reader.readAsText(pendingFile);
    setPendingFile(null);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {msg && <span style={{ fontSize: 12, color: msg.includes('failed') || msg.includes('Failed') ? '#dc2626' : '#059669' }}>{msg}</span>}
      {showNameInput && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 8, padding: '6px 10px' }}>
          <input
            autoFocus
            value={listName}
            onChange={e => setListName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') processUpload(); if (e.key === 'Escape') setShowNameInput(false); }}
            placeholder="Name this list…"
            style={{ fontSize: 13, border: 'none', outline: 'none', background: 'transparent', width: 180 }}
          />
          <button onClick={processUpload} disabled={!listName.trim()}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: listName.trim() ? 'pointer' : 'not-allowed', opacity: listName.trim() ? 1 : 0.5 }}>
            Import
          </button>
          <button onClick={() => setShowNameInput(false)}
            style={{ fontSize: 12, color: '#aaa', border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
        </div>
      )}
      <label style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
        {uploading ? 'Uploading…' : '+ Import CSV'}
        <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
      </label>
    </div>
  );
}
