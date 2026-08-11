import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { profile } = useAuth();
  const isDirector = profile?.role === 'director';
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('anthropic');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Clear all data
  const [showClear, setShowClear] = useState(false);
  const [clearInput, setClearInput] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState('');

  // Apollo API key (per-user)
  const [apolloKey, setApolloKey] = useState('');
  const [apolloSaved, setApolloSaved] = useState('');
  const [apolloSaving, setApolloSaving] = useState(false);

  async function clearAllData() {
    if (clearInput !== 'DELETE') return;
    setClearing(true);
    const { data: { user } } = await supabase.auth.getUser();
    // Delete contacts first (cascade removes emails, activity_log, contact_notes)
    await supabase.from('contacts').delete().eq('owner_id', user.id);
    // Delete accounts
    await supabase.from('accounts').delete().eq('owner_id', user.id);
    setClearing(false);
    setShowClear(false);
    setClearInput('');
    setClearMsg('All contacts and accounts deleted.');
    setTimeout(() => setClearMsg(''), 5000);
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('org_config').select('ai_api_key, ai_provider, apollo_api_key').single();
      if (data?.apollo_api_key) setApolloKey('••••••••••••••••');
      if (data) {
        setApiKey(data.ai_api_key ? '••••••••••••••••' : '');
        setProvider(data.ai_provider || 'anthropic');
      }
      setLoading(false);
    }
    load();
  }, []);

  async function save() {
    if (!apiKey || apiKey.startsWith('••')) {
      setSaved('No change — key not updated');
      return;
    }
    setSaving(true);
    const { data: existing } = await supabase.from('org_config').select('id').single();
    let err;
    if (existing) {
      const { error } = await supabase.from('org_config').update({ ai_api_key: apiKey, ai_provider: provider }).eq('id', existing.id);
      err = error;
    } else {
      const { error } = await supabase.from('org_config').insert({ ai_api_key: apiKey, ai_provider: provider });
      err = error;
    }
    setSaving(false);
    if (err) { setSaved('Error: ' + err.message); }
    else { setSaved('API key saved successfully!'); setApiKey('••••••••••••••••'); }
    setTimeout(() => setSaved(''), 4000);
  }

  async function saveApolloKey() {
    if (!apolloKey || apolloKey.startsWith('••')) {
      setApolloSaved('No change — key not updated');
      setTimeout(() => setApolloSaved(''), 3000);
      return;
    }
    setApolloSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apollo-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'save_api_key', key: apolloKey }),
    });
    const data = await r.json();
    setApolloSaving(false);
    if (data.ok) {
      setApolloSaved('Apollo key saved!');
      setApolloKey('••••••••••••••••');
    } else {
      setApolloSaved('Error: ' + (data.error || 'Unknown'));
    }
    setTimeout(() => setApolloSaved(''), 4000);
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>Org-level configuration</p>
      </div>

      {/* AI API Key */}
      <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 20, maxWidth: 560 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 6 }}>AI API Key</div>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
          This key is shared across all users. Only the Director can update it.
          It is stored securely in Supabase and never exposed to the browser.
        </p>
        {loading ? (
          <div style={{ color: '#aaa' }}>Loading…</div>
        ) : !isDirector ? (
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#0369a1' }}>
            ✓ AI API key is configured by your Director. Your outreach AI features are active.
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>AI provider</label>
              <select value={provider} onChange={e => setProvider(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, width: '100%', outline: 'none' }}>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>API key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none' }}
              />
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 5 }}>Paste a new key to update. Existing key is masked.</div>
            </div>
            <button onClick={save} disabled={saving}
              style={{ padding: '9px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : 'Save API key'}
            </button>
            {saved && (
              <div style={{ marginTop: 12, fontSize: 13, color: saved.startsWith('Error') ? '#dc2626' : '#059669' }}>{saved}</div>
            )}
          </>
        )}
      </div>

      {/* Apollo API Key — org-level, set by admin */}
      <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 20, maxWidth: 560, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Apollo.io Integration</div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
            background: apolloKey && apolloKey.startsWith('••') ? '#d1fae5' : '#fef9c3',
            color: apolloKey && apolloKey.startsWith('••') ? '#065f46' : '#92400e' }}>
            {apolloKey && apolloKey.startsWith('••') ? '✓ Connected' : 'Not configured'}
          </span>
        </div>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
          One Apollo API key connects your whole team. All users can search and import from Apollo once this is set.
          Only an admin with Apollo API access needs to do this once.
        </p>
        {isDirector ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>Apollo API key</label>
              <input
                type="password"
                value={apolloKey}
                onChange={e => setApolloKey(e.target.value)}
                placeholder="Paste Apollo API key — find it in Apollo → Settings → Integrations → API"
                style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <button onClick={saveApolloKey} disabled={apolloSaving}
              style={{ padding: '9px 20px', background: '#0a66c2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: apolloSaving ? 0.7 : 1 }}>
              {apolloSaving ? 'Saving…' : 'Save Apollo key'}
            </button>
            {apolloSaved && (
              <div style={{ marginTop: 10, fontSize: 13, color: apolloSaved.startsWith('Error') ? '#dc2626' : '#059669' }}>{apolloSaved}</div>
            )}
          </>
        ) : (
          <div style={{ background: apolloKey && apolloKey.startsWith('••') ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${apolloKey && apolloKey.startsWith('••') ? '#86efac' : '#fcd34d'}`,
            borderRadius: 8, padding: '10px 14px', fontSize: 13,
            color: apolloKey && apolloKey.startsWith('••') ? '#166534' : '#92400e' }}>
            {apolloKey && apolloKey.startsWith('••')
              ? '✓ Apollo is connected — you can use Apollo Import to search and pull contacts.'
              : 'Apollo is not connected yet. Ask your admin to add the Apollo API key in Settings.'}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 12, padding: 20, maxWidth: 560, marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', marginBottom: 6 }}>Danger Zone</div>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 14, lineHeight: 1.6 }}>
          Permanently delete all your contacts and accounts. This cannot be undone.
        </p>
        {clearMsg && (
          <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#854d0e', marginBottom: 12 }}>
            {clearMsg}
          </div>
        )}
        {!showClear ? (
          <button onClick={() => setShowClear(true)}
            style={{ padding: '8px 18px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            🗑 Clear All Data
          </button>
        ) : (
          <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: 16 }}>
            <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 600, marginBottom: 10 }}>
              Type DELETE to confirm. This will erase all your contacts, accounts, emails and activity.
            </p>
            <input
              value={clearInput}
              onChange={e => setClearInput(e.target.value)}
              placeholder='Type DELETE'
              style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid #fca5a5', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none', marginBottom: 12, letterSpacing: 1 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={clearAllData} disabled={clearInput !== 'DELETE' || clearing}
                style={{ padding: '8px 18px', background: clearInput === 'DELETE' ? '#dc2626' : '#e5e7eb', color: clearInput === 'DELETE' ? '#fff' : '#9ca3af', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: clearInput === 'DELETE' ? 'pointer' : 'not-allowed' }}>
                {clearing ? 'Deleting…' : 'Yes, delete everything'}
              </button>
              <button onClick={() => { setShowClear(false); setClearInput(''); }}
                style={{ padding: '8px 16px', background: '#f5f5f5', color: '#555', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Org info */}
      <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 20, maxWidth: 560, marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 12 }}>Your account</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {[
            { label: 'Full name', value: profile?.full_name },
            { label: 'Role', value: profile?.role?.toUpperCase() },
            { label: 'Region', value: profile?.region || 'Not set' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
              <span style={{ color: '#888', width: 90 }}>{row.label}</span>
              <span style={{ color: '#111', fontWeight: 500 }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
