import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const STAGES = ['Fresh','F1','F2','F3','F4','F5','won','lost','bounced','unsubscribed'];

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

  async function markBounced(id) {
    setMarking(id);
    await supabase.from('contacts').update({
      status: 'bounced', bounced: true,
      bounce_reason: 'Manual', bounced_at: new Date().toISOString()
    }).eq('id', id);
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: id,
      activity_type: 'bounce_detected', details: { reason: 'Manual' }
    });
    setMarking(null);
    fetchContacts();
  }

  async function updateStatus(id, status) {
    const update = { status };
    // auto-advance sequence_step when moving to F-stages
    const stepMap = { Fresh: 0, F1: 1, F2: 2, F3: 3, F4: 4, F5: 5 };
    if (stepMap[status] !== undefined) update.sequence_step = stepMap[status];
    await supabase.from('contacts').update(update).eq('id', id);
    await supabase.from('activity_log').insert({
      actor_id: user.id, contact_id: id,
      activity_type: 'status_changed', details: { status }
    });
    fetchContacts();
  }

  const filtered = contacts.filter(c => {
    if (!showBounced && c.bounced) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return c.full_name?.toLowerCase().includes(s) ||
           c.email?.toLowerCase().includes(s) ||
           c.company?.toLowerCase().includes(s);
  });

  const filterCounts = {};
  STAGES.forEach(s => { filterCounts[s] = contacts.filter(c => c.status === s).length; });
  const activeCount = contacts.filter(c => !c.bounced).length;

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Contacts</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>
            {activeCount} active · {contacts.filter(c => c.bounced).length} bounced
          </p>
        </div>
        <UploadCSV userId={user.id} onDone={fetchContacts} />
      </div>

      {/* Stage filter bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, company…"
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, width: 220, outline: 'none', marginRight: 4 }}
        />
        <button onClick={() => setFilter('all')}
          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, cursor: 'pointer',
            background: filter === 'all' ? '#111' : '#f0f0ee', color: filter === 'all' ? '#fff' : '#666', fontWeight: 500 }}>
          All ({contacts.length})
        </button>
        {STAGES.filter(s => filterCounts[s] > 0 || filter === s).map(s => {
          const sc = STAGE_COLORS[s];
          return (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${filter === s ? sc.color : '#e0e0e0'}`,
                fontSize: 12, cursor: 'pointer', fontWeight: filter === s ? 600 : 400,
                background: filter === s ? sc.bg : '#fff', color: filter === s ? sc.color : '#666' }}>
              {s} {filterCounts[s] > 0 ? `(${filterCounts[s]})` : ''}
            </button>
          );
        })}
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#888', cursor: 'pointer', marginLeft: 4 }}>
          <input type="checkbox" checked={showBounced} onChange={e => setShowBounced(e.target.checked)} />
          Show bounced
        </label>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid #e8e8e4' }}>
              {['Name','Company','Email','Stage','Response','Last emailed','Next follow-up','Actions'].map(h => (
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
              const sc = STAGE_COLORS[c.status] || { bg: '#f1f5f9', color: '#475569' };
              const rc = c.response ? RESPONSE_COLORS[c.response] : null;
              return (
                <tr key={c.id} style={{ borderBottom: '0.5px solid #f0f0ee', opacity: c.bounced ? 0.6 : 1,
                  cursor: 'pointer' }} onClick={() => navigate(`/contacts/${c.id}`)}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                    {c.full_name}
                    {c.bounced && <span style={{ marginLeft: 6, fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 10 }}>BOUNCED</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#555' }}>{c.company}</td>
                  <td style={{ padding: '10px 14px', color: '#555', fontSize: 12 }}>{c.email}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      background: sc.bg, color: sc.color }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {rc ? (
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11,
                        background: rc.bg, color: rc.color }}>{rc.label}</span>
                    ) : <span style={{ color: '#ccc', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>
                    {c.last_contacted ? new Date(c.last_contacted).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>
                    {c.bounced
                      ? <span style={{ color: '#991b1b', fontSize: 11 }}>Excluded</span>
                      : c.next_followup
                        ? <span style={{ color: new Date(c.next_followup) < new Date() ? '#dc2626' : '#555' }}>
                            {new Date(c.next_followup).toLocaleDateString()}
                          </span>
                        : <span style={{ color: '#ccc' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!c.bounced && (
                        <>
                          <select value={c.status}
                            onChange={e => updateStatus(c.id, e.target.value)}
                            style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid #e0e0e0', cursor: 'pointer' }}>
                            {STAGES.filter(s => s !== 'bounced').map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <button onClick={() => markBounced(c.id)} disabled={marking === c.id}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6,
                              border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                            {marking === c.id ? '…' : '⛔'}
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
        headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim().replace(/^"|"$/g, ''); });
        return {
          owner_id: userId,
          full_name: obj.name || obj.full_name || '',
          email: obj.email || '',
          company: obj.company || '',
          title: obj.title || obj.job_title || obj.designation || '',
          phone: obj.phone || '',
          industry: obj.industry || '',
          country: obj.country || '',
          linkedin_url: obj.linkedin || obj.linkedin_url || '',
          status: 'Fresh',
          sequence_step: 0,
        };
      }).filter(r => r.full_name || r.email);

      const { error } = await supabase.from('contacts').insert(rows);
      setUploading(false);
      if (error) { setMsg('Upload failed: ' + error.message); }
      else { setMsg(`✓ ${rows.length} contacts imported`); onDone(); }
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
