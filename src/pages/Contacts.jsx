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

const ALL_STATUSES = ['fresh','contacted','replied','meeting','won','lost','bounced','unsubscribed'];

export default function Contacts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showBounced, setShowBounced] = useState(false);
  const [marking, setMarking] = useState(null);

  useEffect(() => { fetchContacts(); }, [filter]);

  async function fetchContacts() {
    setLoading(true);
    let q = supabase.from('contacts').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setContacts(data || []);
    setLoading(false);
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

  const filtered = contacts.filter(c => {
    if (!showBounced && c.bounced) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return c.full_name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s) || c.company?.toLowerCase().includes(s);
  });

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Contacts</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>{contacts.filter(c => !c.bounced).length} active · {contacts.filter(c => c.bounced).length} bounced</p>
        </div>
        <UploadCSV userId={user.id} onDone={fetchContacts} />
      </div>

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
              {['Name', 'Company', 'Email', 'Status', 'Last contacted', 'Next follow-up', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#999', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>No contacts found</td></tr>
            ) : filtered.map(c => {
              const sc = STATUS_COLORS[c.status] || { bg: '#f1f5f9', color: '#475569' };
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
                  <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>
                    {c.last_contacted ? new Date(c.last_contacted).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: c.bounced ? '#999' : '#111', fontSize: 12 }}>
                    {c.bounced ? <span style={{ color: '#991b1b', fontSize: 11 }}>Excluded (bounced)</span>
                      : c.next_followup ? new Date(c.next_followup).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        onClick={() => navigate(`/contacts/${c.id}`)}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', color: '#2563eb', cursor: 'pointer', fontWeight: 500 }}>
                        View
                      </button>
                      {!c.bounced && (
                        <>
                          <select value={c.status} onChange={e => updateStatus(c.id, e.target.value)}
                            style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
                            {ALL_STATUSES.filter(s => s !== 'bounced').map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button onClick={() => markBounced(c.id)} disabled={marking === c.id}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                            {marking === c.id ? '…' : 'Mark bounced'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UploadCSV({ userId, onDone }) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setMsg('');
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
      else { setMsg(`${rows.length} contacts imported`); onDone(); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {msg && <span style={{ fontSize: 12, color: msg.includes('failed') ? '#dc2626' : '#059669' }}>{msg}</span>}
      <label style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
        {uploading ? 'Uploading…' : '+ Import CSV'}
        <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
      </label>
    </div>
  );
}
