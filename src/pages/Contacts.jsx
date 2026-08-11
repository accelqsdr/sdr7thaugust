import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['Fresh', 'F1', 'F2', 'F3', 'F4', 'F5', 'won', 'lost', 'bounced', 'unsubscribed'];

const STATUS_STYLE = {
  Fresh:        { bg: '#e0f2fe', color: '#0369a1' },
  F1:           { bg: '#f0fdf4', color: '#166534' },
  F2:           { bg: '#dcfce7', color: '#15803d' },
  F3:           { bg: '#fef9c3', color: '#854d0e' },
  F4:           { bg: '#ffedd5', color: '#9a3412' },
  F5:           { bg: '#fce7f3', color: '#9d174d' },
  won:          { bg: '#d1fae5', color: '#065f46' },
  lost:         { bg: '#f1f5f9', color: '#475569' },
  bounced:      { bg: '#fee2e2', color: '#991b1b' },
  unsubscribed: { bg: '#fef3c7', color: '#92400e' },
};

const RESPONSE_STYLE = {
  cold:          { bg: '#f1f5f9', color: '#475569', label: 'Cold' },
  negative:      { bg: '#fee2e2', color: '#991b1b', label: 'Negative' },
  not_interested:{ bg: '#fef3c7', color: '#92400e', label: 'Not Interested' },
  warm:          { bg: '#fef9c3', color: '#854d0e', label: 'Warm' },
  prospect:      { bg: '#dcfce7', color: '#15803d', label: 'Prospect' },
};

function contactName(c) {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'â';
}

export default function Contacts() {
  const { user, profile } = useAuth();
  const canViewAll = ['director', 'manager'].includes(profile?.role);
  const [viewAll, setViewAll] = useState(false);
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [marking, setMarking] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [reassignModal, setReassignModal] = useState(null); // 'account' | 'sdr'
  const [reassignTarget, setReassignTarget] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [sdrs, setSdrs] = useState([]);
  const [batchStarting, setBatchStarting] = useState(false);
  const [batchMsg, setBatchMsg] = useState('');

  useEffect(() => { fetchContacts(); }, [filter, viewAll]);

  async function fetchContacts() {
    setLoading(true);
    let q = supabase.from('contacts').select('*').order('created_at', { ascending: false });
    if (!viewAll || !canViewAll) q = q.eq('owner_id', user.id);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q.limit(5000);
    setContacts(data || []);
    setLoading(false);
    setSelected(new Set());
    // Fetch accounts and SDRs for reassignment
    supabase.from('accounts').select('id,name').then(({data}) => setAccounts(data||[]));
    supabase.from('org_hierarchy').select('id,full_name,role').in('role',['sdr','poc','manager','director']).then(({data}) => setSdrs(data||[]));
  }

  async function updateStatus(id, status) {
    await supabase.from('contacts').update({ status }).eq('id', id);
    await supabase.from('activity_log').insert({ actor_id: user.id, contact_id: id, activity_type: 'status_changed', details: { status } });
    fetchContacts();
  }

  async function updateResponseType(id, response_type) {
    const val = response_type === '' ? null : response_type;
    await supabase.from('contacts').update({ response_type: val }).eq('id', id);
    await supabase.from('activity_log').insert({ actor_id: user.id, contact_id: id, activity_type: 'response_set', details: { response_type: val } });
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

    async function reassignContacts(type, targetId) {
    if(!targetId || selected.size===0) return;
    const ids = [...selected];
    if(type==='account') {
      await supabase.from('contacts').update({ account_id: targetId }).in('id', ids);
    } else if(type==='sdr') {
      await supabase.from('contacts').update({ owner_id: targetId }).in('id', ids);
    }
    setSelected(new Set());
    setReassignModal(null);
    setReassignTarget('');
    fetchContacts();
  }

  async function batchStart() {
    const ids = [...selected];
    if (!ids.length) return;
    setBatchStarting(true);
    setBatchMsg('');

    const now = new Date();
    const followup = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    let done = 0;
    for (const id of ids) {
      await supabase.from('contacts').update({ status: 'F1', next_followup: followup }).eq('id', id);
      await supabase.from('activity_log').insert({ actor_id: user.id, contact_id: id, activity_type: 'status_changed', details: { status: 'F1', note: 'Batch start' } });
      done++;
      setBatchMsg(`Startingâ¦ ${done}/${ids.length}`);
    }

    setBatchStarting(false);
    setBatchMsg(`â ${done} contacts started`);
    setTimeout(() => setBatchMsg(''), 3000);
    fetchContacts();
  }

  const filtered = contacts.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    const name = contactName(c).toLowerCase();
    return name.includes(s) || c.email?.toLowerCase().includes(s) || c.company?.toLowerCase().includes(s);
  });

  const freshCount   = contacts.filter(c => c.status === 'Fresh').length;
  const activeCount  = contacts.filter(c => !['bounced','unsubscribed','lost'].includes(c.status)).length;
  const bouncedCount = contacts.filter(c => c.status === 'bounced').length;

  const freshSelected = [...selected].filter(id => {
    const c = contacts.find(x => x.id === id);
    return c?.status === 'Fresh';
  });

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.id)));
    }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0 }}>
              {viewAll && canViewAll ? 'All Contacts' : 'My Contacts'}
            </h1>
            {canViewAll && (
              <button onClick={() => setViewAll(v => !v)}
                style={{ padding: '4px 12px', borderRadius: 20, border: '1.5px solid #e0e0e0',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', background: viewAll ? '#111' : '#fff',
                  color: viewAll ? '#fff' : '#555', transition: 'all 0.15s' }}>
                {viewAll ? 'ð¥ Team view' : 'View all'}
              </button>
            )}
          </div>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
            {activeCount} active Â· {freshCount} fresh Â· {bouncedCount} bounced
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {batchMsg && (
            <span style={{ fontSize: 12, color: batchMsg.startsWith('â') ? '#059669' : '#555' }}>{batchMsg}</span>
          )}
          {selected.size > 0 && (
            <button
              onClick={batchStart}
              disabled={batchStarting || freshSelected.length === 0}
              style={{ padding: '8px 16px', background: freshSelected.length > 0 ? '#2563eb' : '#e5e7eb', color: freshSelected.length > 0 ? '#fff' : '#aaa', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: freshSelected.length > 0 ? 'pointer' : 'not-allowed', border: 'none' }}>
              {batchStarting ? 'Startingâ¦' : `â¶ Start ${freshSelected.length} Fresh`}
            </button>
          )}
                    <button
            onClick={() => setReassignModal('account')}
            disabled={selected.size === 0}
            style={{ padding: '6px 12px', background: '#eff6ff', color: '#2563eb', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid #bfdbfe' }}>
            ⇄ Reassign Account
          </button>
          <button
            onClick={() => setReassignModal('sdr')}
            disabled={selected.size === 0}
            style={{ padding: '6px 12px', background: '#f0fdf4', color: '#15803d', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid #bbf7d0' }}>
            ⇄ Reassign SDR
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            style={{ padding: '8px 14px', background: '#fff', color: '#dc2626', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid #fecaca' }}>
            Clear all
          </button>
          <UploadCSV userId={user.id} onDone={fetchContacts} />
        </div>
      </div>

            {/* Reassign Modal */}
      {reassignModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ background:'#fff',borderRadius:14,padding:28,width:360,boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize:16,fontWeight:700,marginBottom:16,color:'#111' }}>
              {reassignModal==='account' ? 'Reassign Account' : 'Reassign SDR'}
              <span style={{ fontSize:12,fontWeight:400,color:'#6b7280',marginLeft:8 }}>({selected.size} contact{selected.size!==1?'s':''})</span>
            </div>
            <select value={reassignTarget} onChange={e=>setReassignTarget(e.target.value)}
              style={{ width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #d1d5db',fontSize:13,marginBottom:16 }}>
              <option value="">— Select {reassignModal==='account'?'Account':'SDR'} —</option>
              {reassignModal==='account'
                ? accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)
                : sdrs.map(s=><option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)
              }
            </select>
            <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
              <button onClick={()=>{setReassignModal(null);setReassignTarget('');}} style={{ padding:'6px 14px',borderRadius:8,border:'1px solid #d1d5db',background:'#fff',fontSize:13,cursor:'pointer' }}>Cancel</button>
              <button onClick={()=>reassignContacts(reassignModal,reassignTarget)} disabled={!reassignTarget}
                style={{ padding:'6px 14px',borderRadius:8,border:'none',background:'#2563eb',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',opacity:reassignTarget?1:0.5 }}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmations */}
      {showClearConfirm && (
        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#991b1b' }}>Permanently delete <strong>all contacts</strong>? This cannot be undone.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowClearConfirm(false)} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e0e0e0', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={clearAllContacts} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Delete all</button>
          </div>
        </div>
      )}
      {deleteConfirm && (
        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#991b1b' }}>Delete <strong>{deleteConfirm.name}</strong>?</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setDeleteConfirm(null)} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e0e0e0', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => deleteContact(deleteConfirm.id)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Delete</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, companyâ¦"
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, width: 240, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 2, background: '#f0f0ee', padding: 4, borderRadius: 8, flexWrap: 'wrap' }}>
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '5px 11px', borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer',
                background: filter === s ? '#fff' : 'transparent',
                color: filter === s ? '#111' : '#666',
                fontWeight: filter === s ? 600 : 400,
                boxShadow: filter === s ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e4', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '10px 14px', width: 36 }}>
                <input type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer' }} />
              </th>
              {['Name', 'Company', 'Email', 'Title', 'Status', 'Response', 'LinkedIn', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Loadingâ¦</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>
                {contacts.length === 0 ? 'No contacts yet â import a CSV to get started' : 'No contacts match your filter'}
              </td></tr>
            ) : filtered.map(c => {
              const ss = STATUS_STYLE[c.status] || { bg: '#f1f5f9', color: '#475569' };
              const rs = c.response_type ? RESPONSE_STYLE[c.response_type] : null;
              const isSel = selected.has(c.id);
              const isBounced = c.status === 'bounced';
              return (
                <tr key={c.id}
                  style={{ borderBottom: '1px solid #f4f4f4', background: isSel ? '#eff6ff' : 'transparent', opacity: isBounced ? 0.6 : 1, transition: 'background 0.1s' }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#fafafa'; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}>
                  <td style={{ padding: '10px 14px' }}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleSelect(c.id)} style={{ cursor: 'pointer' }} />
                  
                    {c.response_state && <span style={{display:'block',marginTop:3,fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:6,background:c.response_state==='Lead'?'#d1fae5':c.response_state==='Warm'?'#fef9c3':c.response_state==='Prospecting'?'#fef3c7':c.response_state==='Bounce'?'#fee2e2':'#f3f4f6',color:c.response_state==='Lead'?'#065f46':c.response_state==='Warm'?'#854d0e':c.response_state==='Prospecting'?'#92400e':c.response_state==='Bounce'?'#991b1b':'#374151'}}>{c.response_state}</span>}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => navigate(`/contacts/${c.id}`)}
                      style={{ fontWeight: 600, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, textAlign: 'left' }}>
                      {contactName(c)}
                    </button>
                    {isBounced && <span style={{ marginLeft: 6, fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 10 }}>BOUNCED</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#444' }}>{c.company || 'â'}</td>
                  <td style={{ padding: '10px 14px', color: '#666' }}>{c.email || 'â'}</td>
                  <td style={{ padding: '10px 14px', color: '#666' }}>{c.title || 'â'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, background: ss.bg, color: ss.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {rs ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, background: rs.bg, color: rs.color, fontWeight: 500 }}>{rs.label}</span>
                        <button onClick={() => updateResponseType(c.id, '')}
                          style={{ fontSize: 10, color: '#bbb', border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px' }} title="Clear">â</button>
                      </div>
                    ) : (
                      <select value="" onChange={e => updateResponseType(c.id, e.target.value)}
                        style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid #e0e0e0', cursor: 'pointer', color: '#aaa', background: '#fff' }}>
                        <option value="">Set responseâ¦</option>
                        <option value="cold">Cold</option>
                        <option value="negative">Negative</option>
                        <option value="not_interested">Not Interested</option>
                        <option value="warm">Warm</option>
                        <option value="prospect">Prospect</option>
                      </select>
                    )}
                  </td>
         

                  <td style={{ padding: '10px 14px', fontSize: 12 }}>
                    {c.linkedin_url ? <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" style={{color:'#2563eb',textDecoration:'none'}}>🔗 LinkedIn</a> : <span style={{color:'#ccc'}}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <select value={c.status} onChange={e => updateStatus(c.id, e.target.value)}
                        style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid #e0e0e0', cursor: 'pointer', background: '#fff' }}>
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button
                        onClick={() => setDeleteConfirm({ id: c.id, name: contactName(c) })}
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                        â
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <p style={{ fontSize: 12, color: '#bbb', marginTop: 10, textAlign: 'right' }}>{filtered.length} contacts</p>
      )}
    </div>
  );
}

function UploadCSV({ userId, onDone }) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  async function processUploadWithFile(file) {
    setUploading(true);
    setMsg('');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target.result.trim();
        const lines = text.split('\n');
        if (lines.length < 2) { setMsg('CSV has no data rows'); setUploading(false); return; }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));

        const rows = lines.slice(1).filter(l => l.trim()).map(line => {
          const vals = [];
          let cur = '', inQ = false;
          for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') { inQ = !inQ; }
            else if (line[i] === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
            else { cur += line[i]; }
          }
          vals.push(cur.trim());

          const obj = {};
          headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/^"|"$/g, '').trim(); });

          let firstName = obj.first_name || obj.firstname || '';
          let lastName  = obj.last_name  || obj.lastname  || '';
          if (!firstName && !lastName) {
            const full = obj.name || obj.full_name || obj.contact_name || '';
            const parts = full.split(' ');
            firstName = parts[0] || '';
            lastName  = parts.slice(1).join(' ') || '';
          }

          return {
            owner_id:    userId,
            first_name:  firstName,
            last_name:   lastName,
            email:       obj.email || obj.email_address || '',
            company:     obj.company || obj.company_name || obj.organization || '',
            title:       obj.title || obj.job_title || obj.position || '',
            phone:       obj.phone || obj.phone_number || obj.mobile || '',
            linkedin_url:obj.linkedin || obj.linkedin_url || obj.linkedin_profile || '',
            status:      'Fresh',
            notes:       obj.notes || obj.note || '',
          };
        }).filter(r => r.first_name || r.last_name || r.email);

        if (rows.length === 0) { setMsg('No valid rows found'); setUploading(false); return; }

        const BATCH = 50;
        let total = 0;
        for (let i = 0; i < rows.length; i += BATCH) {
          const { error } = await supabase.from('contacts').insert(rows.slice(i, i + BATCH));
          if (error) { setMsg('Upload failed: ' + error.message); setUploading(false); return; }
          total += Math.min(BATCH, rows.length - i);
          setMsg(`Uploadingâ¦ ${total}/${rows.length}`);
        }

        setUploading(false);
        setMsg(`â ${rows.length} contacts imported`);
        onDone();
        setTimeout(() => setMsg(''), 4000);
      } catch (err) {
        setMsg('Error: ' + err.message);
        setUploading(false);
      }
    };
    reader.readAsText(file);
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    processUploadWithFile(file);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {msg && (
        <span style={{ fontSize: 12, color: msg.startsWith('â') ? '#059669' : msg.startsWith('Upload') ? '#dc2626' : '#555' }}>
          {msg}
        </span>
      )}
      <label style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
        {uploading ? 'Uploadingâ¦' : '+ Import CSV'}
        <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
      </label>
    </div>
  );
}
