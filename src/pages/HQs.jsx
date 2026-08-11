import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function HQs() {
  const { profile } = useAuth();
  const [hqs, setHqs] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name:'', website:'', location:'', revenue:'', employees:'', funding:'', about:'' });

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: hqData }, { data: acctData }] = await Promise.all([
      supabase.from('hqs').select('*').order('name'),
      supabase.from('accounts').select('id, name, industry, hq_id, research').order('name'),
    ]);
    setHqs(hqData || []);
    setAccounts(acctData || []);
    setLoading(false);
  }

  function selectHQ(hq) {
    setSelected(hq);
    setForm({ ...hq });
    setEditing(false);
  }

  async function saveHQ() {
    setSaving(true);
    const { data } = await supabase.from('hqs').update({
      name: form.name, website: form.website, location: form.location,
      revenue: form.revenue, employees: form.employees, funding: form.funding, about: form.about,
    }).eq('id', selected.id).select().single();
    if (data) {
      setSelected(data);
      setHqs(prev => prev.map(h => h.id === data.id ? data : h));
    }
    setEditing(false);
    setSaving(false);
  }

  async function createHQ() {
    if (!newForm.name.trim()) return;
    setSaving(true);
    const { data } = await supabase.from('hqs').insert(newForm).select().single();
    if (data) {
      setHqs(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
      setSelected(data);
      setForm({ ...data });
    }
    setShowNew(false);
    setNewForm({ name:'', website:'', location:'', revenue:'', employees:'', funding:'', about:'' });
    setSaving(false);
  }

  async function assignAccountToHQ(accountId, hqId) {
    await supabase.from('accounts').update({ hq_id: hqId }).eq('id', accountId);
    setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, hq_id: hqId } : a));
  }

  const hqAccounts = selected ? accounts.filter(a => a.hq_id === selected.id) : [];
  const unassigned = accounts.filter(a => !a.hq_id);

  const inp = (style={}) => ({
    width:'100%', padding:'7px 10px', borderRadius:6, border:'1px solid #e0e0e0',
    fontSize:13, outline:'none', boxSizing:'border-box', ...style
  });
  const label = { fontSize:11, fontWeight:600, color:'#666', marginBottom:3, display:'block', textTransform:'uppercase', letterSpacing:'0.04em' };
  const fieldRow = { marginBottom:14 };

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f8f9fb' }}>

      {/* LEFT — HQ list */}
      <div style={{ width:260, background:'#fff', borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid #e5e7eb' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:'#111' }}>🏛 HQ Management</div>
              <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{hqs.length} headquarters</div>
            </div>
            <button onClick={() => setShowNew(true)}
              style={{ padding:'5px 12px', borderRadius:6, border:'none', background:'#2563eb', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              + New
            </button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {loading ? (
            <div style={{ padding:24, color:'#999', fontSize:13 }}>Loading...</div>
          ) : hqs.map(hq => {
            const count = accounts.filter(a => a.hq_id === hq.id).length;
            const isActive = selected?.id === hq.id;
            return (
              <div key={hq.id} onClick={() => selectHQ(hq)}
                style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6', cursor:'pointer',
                  background: isActive ? '#eff6ff' : 'transparent',
                  borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent' }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>{hq.name}</div>
                {hq.location && <div style={{ fontSize:11, color:'#888', marginTop:2 }}>📍 {hq.location}</div>}
                <div style={{ fontSize:11, color:'#6b7280', marginTop:3 }}>
                  {count} account{count !== 1 ? 's' : ''}
                  {hq.employees && <span> · {hq.employees} employees</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT — Detail panel */}
      {selected ? (
        <div style={{ flex:1, overflowY:'auto', padding:28 }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
            <div>
              <h2 style={{ fontSize:22, fontWeight:700, color:'#111', margin:0 }}>{selected.name}</h2>
              {selected.website && (
                <a href={selected.website.startsWith('http') ? selected.website : 'https://'+selected.website}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:12, color:'#2563eb', textDecoration:'none', marginTop:4, display:'block' }}>
                  🌐 {selected.website}
                </a>
              )}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {editing ? (
                <>
                  <button onClick={() => { setEditing(false); setForm({ ...selected }); }}
                    style={{ padding:'6px 16px', borderRadius:6, border:'1px solid #e0e0e0', background:'#fff', fontSize:13, cursor:'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={saveHQ} disabled={saving}
                    style={{ padding:'6px 16px', borderRadius:6, border:'none', background:'#2563eb', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)}
                  style={{ padding:'6px 16px', borderRadius:6, border:'1px solid #e0e0e0', background:'#fff', fontSize:13, cursor:'pointer' }}>
                  ✏️ Edit
                </button>
              )}
            </div>
          </div>

          {/* Overview fields */}
          <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', padding:20, marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:16, textTransform:'uppercase', letterSpacing:'0.05em' }}>Overview</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
              {[
                { key:'location', label:'HQ Location' },
                { key:'revenue', label:'Revenue' },
                { key:'employees', label:'Employees' },
                { key:'funding', label:'Funding' },
                { key:'website', label:'Website' },
              ].map(({ key, label: lbl }) => (
                <div key={key} style={fieldRow}>
                  <span style={label}>{lbl}</span>
                  {editing ? (
                    <input value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      style={inp()} placeholder={lbl} />
                  ) : (
                    <div style={{ fontSize:13, color: form[key] ? '#111' : '#bbb' }}>{form[key] || '—'}</div>
                  )}
                </div>
              ))}
            </div>
            <div style={fieldRow}>
              <span style={label}>About</span>
              {editing ? (
                <textarea value={form.about || ''} onChange={e => setForm(f => ({ ...f, about: e.target.value }))}
                  rows={3} style={{ ...inp(), resize:'vertical' }} placeholder="Brief description of the HQ / group" />
              ) : (
                <div style={{ fontSize:13, color: form.about ? '#111' : '#bbb', lineHeight:1.5 }}>{form.about || '—'}</div>
              )}
            </div>
          </div>

          {/* Accounts under this HQ */}
          <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', padding:20, marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:14, textTransform:'uppercase', letterSpacing:'0.05em' }}>
              Accounts ({hqAccounts.length})
            </div>
            {hqAccounts.length === 0 ? (
              <div style={{ fontSize:13, color:'#bbb' }}>No accounts assigned to this HQ yet.</div>
            ) : (
              <div>
                {hqAccounts.map(acc => (
                  <div key={acc.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>{acc.name}</div>
                      {acc.industry && <div style={{ fontSize:11, color:'#888' }}>{acc.industry}</div>}
                    </div>
                    <button onClick={() => assignAccountToHQ(acc.id, null)}
                      style={{ fontSize:11, color:'#ef4444', background:'none', border:'none', cursor:'pointer' }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assign unassigned accounts */}
          {unassigned.length > 0 && (
            <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', padding:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:14, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                Assign Accounts ({unassigned.length} unassigned)
              </div>
              <div style={{ maxHeight:240, overflowY:'auto' }}>
                {unassigned.map(acc => (
                  <div key={acc.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #f3f4f6' }}>
                    <div>
                      <div style={{ fontSize:13, color:'#111' }}>{acc.name}</div>
                      {acc.industry && <div style={{ fontSize:11, color:'#888' }}>{acc.industry}</div>}
                    </div>
                    <button onClick={() => assignAccountToHQ(acc.id, selected.id)}
                      style={{ fontSize:11, padding:'3px 10px', borderRadius:5, border:'1px solid #2563eb', color:'#2563eb', background:'none', cursor:'pointer', fontWeight:600 }}>
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#bbb', fontSize:14 }}>
          Select an HQ to view details
        </div>
      )}

      {/* New HQ modal */}
      {showNew && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:12, padding:28, width:480, maxWidth:'90vw' }}>
            <h3 style={{ margin:'0 0 20px', fontSize:17, fontWeight:700 }}>New HQ</h3>
            {[
              { key:'name', label:'HQ Name *', required:true },
              { key:'website', label:'Website' },
              { key:'location', label:'HQ Location' },
              { key:'revenue', label:'Revenue' },
              { key:'employees', label:'Employees' },
              { key:'funding', label:'Funding' },
            ].map(({ key, label: lbl }) => (
              <div key={key} style={{ marginBottom:12 }}>
                <label style={label}>{lbl}</label>
                <input value={newForm[key] || ''} onChange={e => setNewForm(f => ({ ...f, [key]: e.target.value }))}
                  style={inp()} placeholder={lbl} />
              </div>
            ))}
            <div style={{ marginBottom:16 }}>
              <label style={label}>About</label>
              <textarea value={newForm.about || ''} onChange={e => setNewForm(f => ({ ...f, about: e.target.value }))}
                rows={2} style={{ ...inp(), resize:'vertical' }} />
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setShowNew(false)}
                style={{ padding:'7px 18px', borderRadius:6, border:'1px solid #e0e0e0', background:'#fff', fontSize:13, cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={createHQ} disabled={saving || !newForm.name.trim()}
                style={{ padding:'7px 18px', borderRadius:6, border:'none', background:'#2563eb', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                {saving ? 'Creating…' : 'Create HQ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
