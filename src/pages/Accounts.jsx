import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  prospecting:  { bg: '#e0f2fe', color: '#0369a1' },
  engaged:      { bg: '#fef9c3', color: '#854d0e' },
  demo_booked:  { bg: '#ede9fe', color: '#6d28d9' },
  closed_won:   { bg: '#dcfce7', color: '#15803d' },
  closed_lost:  { bg: '#f1f5f9', color: '#475569' },
};

const STATUS_LABELS = {
  prospecting: 'Prospecting',
  engaged: 'Engaged',
  demo_booked: 'Demo Booked',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const INTENT_LABELS = {
  qa_hiring: '🧑‍💼 QA Hiring',
  competitor_tool: '⚔️ Competitor Tool',
  recent_funding: '💰 Recent Funding',
  recent_launch: '🚀 Recent Launch',
  outage: '🔴 Outage',
  cicd: '⚙️ CI/CD',
  tech_stack: '🛠️ Tech Stack',
  website_traffic: '📈 Website Traffic',
  g2_review: '⭐ G2 Review',
  other: '📌 Other',
};

export default function Accounts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', domain: '', industry: '', size: '', country: '', website: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => { fetchAccounts(); }, []);

  async function fetchAccounts() {
    setLoading(true);
    const { data: accs } = await supabase.from('accounts').select('*').order('created_at', { ascending: false });
    if (!accs) { setLoading(false); return; }

    // Get contact counts per account
    const { data: contacts } = await supabase.from('contacts').select('account_id').eq('owner_id', user.id);
    const contactCounts = {};
    (contacts || []).forEach(c => { if (c.account_id) contactCounts[c.account_id] = (contactCounts[c.account_id] || 0) + 1; });

    // Get intent counts
    const { data: intents } = await supabase.from('account_intents').select('account_id');
    const intentCounts = {};
    (intents || []).forEach(i => { intentCounts[i.account_id] = (intentCounts[i.account_id] || 0) + 1; });

    const enriched = accs.map(a => ({ ...a, contactCount: contactCounts[a.id] || 0, intentCount: intentCounts[a.id] || 0 }));
    setAccounts(enriched);
    setLoading(false);
  }

  async function addAccount() {
    if (!newAccount.name.trim()) return;
    setAdding(true);
    await supabase.from('accounts').insert({ ...newAccount, owner_id: user.id });
    setNewAccount({ name: '', domain: '', industry: '', size: '', country: '', website: '' });
    setShowAdd(false);
    setAdding(false);
    fetchAccounts();
  }

  async function updateStatus(id, status) {
    await supabase.from('accounts').update({ status }).eq('id', id);
    fetchAccounts();
  }

  const filtered = accounts.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return a.name?.toLowerCase().includes(s) || a.industry?.toLowerCase().includes(s) || a.domain?.toLowerCase().includes(s);
  });

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Accounts</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>{accounts.length} companies</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none' }}>
          + Add Account
        </button>
      </div>

      {/* Add Account Form */}
      {showAdd && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>New Account</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            {[
              { key: 'name', label: 'Company Name *', placeholder: 'Salesforce' },
              { key: 'domain', label: 'Domain', placeholder: 'salesforce.com' },
              { key: 'industry', label: 'Industry', placeholder: 'Technology' },
              { key: 'size', label: 'Company Size', placeholder: '1000-5000' },
              { key: 'country', label: 'Country', placeholder: 'USA' },
              { key: 'website', label: 'Website', placeholder: 'https://salesforce.com' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input value={newAccount[f.key]} onChange={e => setNewAccount({ ...newAccount, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addAccount} disabled={adding || !newAccount.name.trim()}
              style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', opacity: adding || !newAccount.name.trim() ? 0.6 : 1 }}>
              {adding ? 'Adding…' : 'Add Account'}
            </button>
            <button onClick={() => setShowAdd(false)}
              style={{ padding: '8px 16px', background: '#f5f5f5', color: '#555', borderRadius: 7, fontSize: 13, cursor: 'pointer', border: 'none' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search company, industry…"
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, width: 240, outline: 'none' }} />
        <div style={{ display: 'flex', gap: 4, background: '#f0f0ee', padding: 4, borderRadius: 8 }}>
          {['all', ...Object.keys(STATUS_LABELS)].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '5px 10px', borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer',
                background: filter === s ? '#fff' : 'transparent', color: filter === s ? '#111' : '#666', fontWeight: filter === s ? 500 : 400 }}>
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e4', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid #e8e8e4' }}>
              {['Company', 'Industry', 'Size', 'Country', 'Contacts', 'Intents', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#999', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>No accounts yet — add your first account above</td></tr>
            ) : filtered.map(a => {
              const sc = STATUS_COLORS[a.status] || STATUS_COLORS.prospecting;
              return (
                <tr key={a.id} style={{ borderBottom: '0.5px solid #f0f0ee' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                    <div>{a.name}</div>
                    {a.domain && <div style={{ fontSize: 11, color: '#aaa' }}>{a.domain}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#555' }}>{a.industry || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#555' }}>{a.size || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#555' }}>{a.country || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: 10, padding: '2px 8px', fontSize: 12, fontWeight: 500 }}>
                      {a.contactCount}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {a.intentCount > 0 ? (
                      <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: '2px 8px', fontSize: 12, fontWeight: 500 }}>
                        {a.intentCount} signal{a.intentCount > 1 ? 's' : ''}
                      </span>
                    ) : <span style={{ color: '#ccc', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <select value={a.status} onChange={e => updateStatus(a.id, e.target.value)}
                      style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid #e0e0e0', cursor: 'pointer',
                        background: sc.bg, color: sc.color, fontWeight: 500 }}>
                      {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => navigate(`/accounts/${a.id}`)}
                      style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', color: '#2563eb', cursor: 'pointer', fontWeight: 500 }}>
                      View
                    </button>
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
