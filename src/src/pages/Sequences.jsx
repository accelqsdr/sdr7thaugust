import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const DEFAULT_STEPS = [
  { day: 0, subject: 'Quick question about {{company}}', body: 'Hi {{first_name}},\n\nI noticed [specific insight].\n\n[Value prop in 1-2 sentences].\n\nWorth a quick 15-min call?\n\n[Your name]' },
  { day: 3, subject: 'Re: Quick question about {{company}}', body: 'Hi {{first_name}},\n\nJust wanted to make sure this didn\'t get buried.\n\n[New angle or insight].\n\n[Your name]' },
  { day: 7, subject: 'One last thing...', body: 'Hi {{first_name}},\n\nI\'ll stop reaching out — but wanted to leave you with [useful resource/insight].\n\nIf things change, you know where to find me.\n\n[Your name]' },
];

export default function Sequences() {
  const { user } = useAuth();
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('sequences').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
    setSequences(data || []);
    setLoading(false);
  }

  async function create() {
    if (!newName.trim()) return;
    setCreating(true);
    await supabase.from('sequences').insert({
      owner_id: user.id,
      name: newName.trim(),
      steps: DEFAULT_STEPS,
      is_active: true,
    });
    setNewName('');
    setShowNew(false);
    setCreating(false);
    load();
  }

  async function toggle(id, val) {
    await supabase.from('sequences').update({ is_active: val }).eq('id', id);
    load();
  }

  async function del(id) {
    if (!window.confirm('Delete this sequence?')) return;
    await supabase.from('sequences').delete().eq('id', id);
    load();
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Sequences</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>Email outreach sequences</p>
        </div>
        <button onClick={() => setShowNew(true)}
          style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          + New sequence
        </button>
      </div>

      {showNew && (
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 10 }}>Create sequence</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Sequence name (e.g. SaaS QA outreach)"
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, outline: 'none' }} />
            <button onClick={create} disabled={creating}
              style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowNew(false)}
              style={{ padding: '8px 12px', background: '#f1f5f9', color: '#555', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>A 3-step default sequence (Day 0, 3, 7) will be pre-loaded.</div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>Loading…</div>
      ) : sequences.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📧</div>
          <div style={{ fontWeight: 500 }}>No sequences yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Create one to start tracking your outreach steps.</div>
        </div>
      ) : sequences.map(seq => (
        <div key={seq.id} style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{seq.name}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{(seq.steps || []).length} steps</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer' }}>
              <input type="checkbox" checked={seq.is_active} onChange={e => toggle(seq.id, e.target.checked)} />
              {seq.is_active ? 'Active' : 'Paused'}
            </label>
            <button onClick={() => del(seq.id)}
              style={{ padding: '5px 12px', background: '#fff', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
              Delete
            </button>
          </div>
          {/* Steps preview */}
          <div style={{ borderTop: '0.5px solid #f0f0ee' }}>
            {(seq.steps || []).map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 18px', borderBottom: i < seq.steps.length - 1 ? '0.5px solid #f5f5f3' : 'none', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, color: '#aaa', width: 42, flexShrink: 0, paddingTop: 2 }}>Day {step.day}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#555' }}>{step.subject}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2, whiteSpace: 'pre-line' }}>{step.body?.slice(0, 80)}…</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
