import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ── Territory config ────────────────────────────────────────────────────────
const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
];

const COUNTRIES = [
  'United States','United Kingdom','Canada','Australia','Germany','France',
  'Netherlands','India','Singapore','UAE','Brazil','Mexico',
];

const INDUSTRIES = [
  'BFSI / Banking','Healthcare / Life Sciences','Retail / eCommerce',
  'Manufacturing','Insurance','Telecom','Logistics / Supply Chain',
  'Energy / Utilities','Government / Public Sector','Education','Media / Entertainment',
];

const TECH_TOOLS = [
  'SAP','Oracle EBS','Salesforce','ServiceNow','Workday','PeopleSoft',
  'Selenium','UFT / QTP','Jira','Azure DevOps','Jenkins','GitHub Actions',
  'Microsoft Dynamics','Guidewire','Epic Systems','Veeva',
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
      border: active ? '1.5px solid #2563eb' : '1.5px solid #d1d5db',
      background: active ? '#eff6ff' : '#fff',
      color: active ? '#1d4ed8' : '#374151',
      fontWeight: active ? 600 : 400,
      transition: 'all 0.15s',
    }}>{label}</button>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
      letterSpacing: '0.06em', marginBottom: 8, marginTop: 16 }}>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { suggested: ['#dbeafe','#1d4ed8'], added: ['#dcfce7','#15803d'], skipped: ['#f3f4f6','#6b7280'] };
  const [bg, color] = map[status] || map.suggested;
  return (
    <span style={{ background: bg, color, fontSize: 10, fontWeight: 700, padding: '2px 8px',
      borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {status}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProspectDiscovery() {
  const { user } = useAuth();

  // Territory
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState(['United States']);
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [selectedTools, setSelectedTools] = useState([]);

  // Results
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionWorking, setActionWorking] = useState({});

  // History
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');

  // Toast
  const [toast, setToast] = useState('');
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // Load history
  const fetchHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('prospect_suggestions')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    setHistory(data || []);
  }, [user]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Toggle helpers
  const toggle = (arr, setArr, val) =>
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  // Discover
  async function handleDiscover() {
    setLoading(true);
    setError('');
    setResults([]);

    try {
      const seenCompanies = history.map(h => h.company_name);

      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `https://gfkgzbhtwpxdrhqevjzl.supabase.co/functions/v1/discover-prospects`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            states: selectedStates,
            countries: selectedCountries,
            industries: selectedIndustries,
            techTools: selectedTools,
            alreadySeen: seenCompanies,
            count: 12,
          }),
        }
      );

      const json = await resp.json();
      if (json.error) throw new Error(json.error);
      const companies = json.companies || [];

      // Save to prospect_suggestions
      if (companies.length > 0) {
        const rows = companies.map(c => ({
          owner_id: user.id,
          company_name: c.company,
          industry: c.industry || null,
          size_estimate: c.size_estimate || null,
          reason: c.why_match || null,
          territory_snapshot: {
            states: selectedStates,
            countries: selectedCountries,
            industries: selectedIndustries,
            techTools: selectedTools,
          },
          status: 'suggested',
        }));
        const { data: inserted } = await supabase.from('prospect_suggestions').insert(rows).select();
        setResults(inserted || companies.map((c, i) => ({ ...c, id: i, company_name: c.company, reason: c.why_match, status: 'suggested' })));
        await fetchHistory();
      } else {
        setError('No new prospects found. Try adjusting your territory.');
      }
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  // Add to Accounts
  async function handleAdd(suggestion) {
    setActionWorking(w => ({ ...w, [suggestion.id]: 'adding' }));
    try {
      // Create account
      const { data: account, error: accErr } = await supabase.from('accounts').insert({
        name: suggestion.company_name,
        industry: suggestion.industry || null,
        owner_id: user.id,
        status: 'active',
      }).select().single();

      if (accErr) throw accErr;

      // Mark suggestion as added
      await supabase.from('prospect_suggestions').update({ status: 'added' }).eq('id', suggestion.id);

      // Auto-trigger AI research
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(`https://gfkgzbhtwpxdrhqevjzl.supabase.co/functions/v1/generate-research`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ account_id: account.id }),
        });
      } catch (_) { /* research is best-effort */ }

      setResults(prev => prev.map(r => r.id === suggestion.id ? { ...r, status: 'added' } : r));
      await fetchHistory();
      showToast(`✅ ${suggestion.company_name} added to Accounts`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setActionWorking(w => ({ ...w, [suggestion.id]: null }));
    }
  }

  // Skip
  async function handleSkip(suggestion) {
    setActionWorking(w => ({ ...w, [suggestion.id]: 'skipping' }));
    await supabase.from('prospect_suggestions').update({ status: 'skipped' }).eq('id', suggestion.id);
    setResults(prev => prev.map(r => r.id === suggestion.id ? { ...r, status: 'skipped' } : r));
    await fetchHistory();
    setActionWorking(w => ({ ...w, [suggestion.id]: null }));
  }

  // CSV export
  function downloadCSV() {
    const filtered = historyFilter === 'all' ? history : history.filter(h => h.status === historyFilter);
    const header = 'Company,Industry,Size,Reason,Status,Date';
    const rows = filtered.map(h =>
      [h.company_name, h.industry, h.size_estimate, `"${(h.reason || '').replace(/"/g, "'")}"`, h.status,
       new Date(h.created_at).toLocaleDateString()].join(',')
    );
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'prospect-history.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const suggestedCount = history.filter(h => h.status === 'suggested').length;
  const addedCount = history.filter(h => h.status === 'added').length;

  const filteredHistory = historyFilter === 'all' ? history : history.filter(h => h.status === historyFilter);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, right: 28, background: '#1e293b', color: '#fff',
          padding: '10px 18px', borderRadius: 8, zIndex: 9999, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>🔍 Prospect Discovery</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            AI finds fresh ACCELQ target companies based on your territory
          </p>
        </div>
        <button onClick={() => setHistoryOpen(true)} style={{
          padding: '7px 14px', borderRadius: 8, background: '#f3f4f6', border: '1px solid #e5e7eb',
          cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          📋 History
          {history.length > 0 && (
            <span style={{ background: '#2563eb', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
              {history.length}
            </span>
          )}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
        {/* ── Left: Territory Config ── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, height: 'fit-content' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Territory Config</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Filter by geo, industry, and tech</div>

          <SectionLabel>US States</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 130, overflowY: 'auto',
            padding: 4, border: '1px solid #f3f4f6', borderRadius: 6, marginBottom: 4 }}>
            {US_STATES.map(s => (
              <Chip key={s} label={s} active={selectedStates.includes(s)}
                onClick={() => toggle(selectedStates, setSelectedStates, s)} />
            ))}
          </div>
          {selectedStates.length > 0 && (
            <button onClick={() => setSelectedStates([])} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Clear states
            </button>
          )}

          <SectionLabel>Countries</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {COUNTRIES.map(c => (
              <Chip key={c} label={c} active={selectedCountries.includes(c)}
                onClick={() => toggle(selectedCountries, setSelectedCountries, c)} />
            ))}
          </div>

          <SectionLabel>Industries</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {INDUSTRIES.map(i => (
              <Chip key={i} label={i} active={selectedIndustries.includes(i)}
                onClick={() => toggle(selectedIndustries, setSelectedIndustries, i)} />
            ))}
          </div>

          <SectionLabel>Tech / Tools in Use</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {TECH_TOOLS.map(t => (
              <Chip key={t} label={t} active={selectedTools.includes(t)}
                onClick={() => toggle(selectedTools, setSelectedTools, t)} />
            ))}
          </div>

          <button onClick={handleDiscover} disabled={loading} style={{
            marginTop: 20, width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
            background: loading ? '#9ca3af' : '#2563eb', color: '#fff', fontWeight: 700,
            fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
          }}>
            {loading ? '🤖 Discovering…' : '🚀 Discover Prospects'}
          </button>

          {/* Stats */}
          {history.length > 0 && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: '#f8fafc', borderRadius: 8,
              border: '1px solid #e2e8f0', fontSize: 12 }}>
              <div style={{ color: '#374151', fontWeight: 600, marginBottom: 6 }}>Your history</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Suggested</span>
                <span style={{ fontWeight: 600, color: '#1d4ed8' }}>{history.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Added to Accounts</span>
                <span style={{ fontWeight: 600, color: '#15803d' }}>{addedCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Pending review</span>
                <span style={{ fontWeight: 600, color: '#d97706' }}>{suggestedCount}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Results ── */}
        <div>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
              borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>AI is finding your prospects…</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Analyzing territory and generating target companies</div>
            </div>
          )}

          {!loading && results.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>Ready to discover</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Configure your territory on the left and click <strong>Discover Prospects</strong>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                {results.length} prospects found — review and add the ones worth pursuing
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {results.map((r) => (
                  <div key={r.id} style={{
                    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14,
                    opacity: r.status === 'skipped' ? 0.55 : 1,
                    borderLeft: r.status === 'added' ? '3px solid #22c55e' : r.status === 'skipped' ? '3px solid #d1d5db' : '3px solid #2563eb',
                    transition: 'opacity 0.2s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', flex: 1, paddingRight: 8 }}>
                        {r.company_name}
                      </div>
                      <StatusBadge status={r.status} />
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      {r.industry && (
                        <span style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 10 }}>
                          {r.industry}
                        </span>
                      )}
                      {r.size_estimate && (
                        <span style={{ fontSize: 11, background: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: 10 }}>
                          👥 {r.size_estimate}
                        </span>
                      )}
                    </div>

                    {r.reason && (
                      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
                        {r.reason}
                      </p>
                    )}

                    {r.status === 'suggested' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleAdd(r)}
                          disabled={!!actionWorking[r.id]}
                          style={{
                            flex: 1, padding: '7px 0', borderRadius: 6, border: 'none',
                            background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 12,
                            cursor: actionWorking[r.id] ? 'not-allowed' : 'pointer',
                          }}>
                          {actionWorking[r.id] === 'adding' ? '…' : '➕ Add to Accounts'}
                        </button>
                        <button onClick={() => handleSkip(r)}
                          disabled={!!actionWorking[r.id]}
                          style={{
                            padding: '7px 14px', borderRadius: 6,
                            border: '1px solid #e5e7eb', background: '#fff',
                            color: '#6b7280', fontSize: 12, cursor: 'pointer',
                          }}>
                          Skip
                        </button>
                      </div>
                    )}

                    {r.status === 'added' && (
                      <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>
                        ✓ Added — AI research triggered
                      </div>
                    )}
                    {r.status === 'skipped' && (
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Skipped</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── History Modal ── */}
      {historyOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={e => e.target === e.currentTarget && setHistoryOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 780,
            maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Modal header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Prospect History</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {history.length} total · {addedCount} added · {suggestedCount} pending
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={downloadCSV} style={{ padding: '6px 12px', borderRadius: 6,
                  border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
                  ⬇ Export CSV
                </button>
                <button onClick={() => setHistoryOpen(false)} style={{ padding: '6px 12px', borderRadius: 6,
                  border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div style={{ padding: '10px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 8 }}>
              {['all', 'suggested', 'added', 'skipped'].map(f => (
                <button key={f} onClick={() => setHistoryFilter(f)} style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  border: historyFilter === f ? '1.5px solid #2563eb' : '1.5px solid #e5e7eb',
                  background: historyFilter === f ? '#eff6ff' : '#fff',
                  color: historyFilter === f ? '#1d4ed8' : '#6b7280',
                  fontWeight: historyFilter === f ? 600 : 400, textTransform: 'capitalize',
                }}>
                  {f}
                </button>
              ))}
            </div>

            {/* History list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {filteredHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>
                  No records in this filter
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Company</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Industry</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Size</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((h, i) => (
                      <tr key={h.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                        <td style={{ padding: '8px 8px', fontWeight: 600, color: '#111827' }}>{h.company_name}</td>
                        <td style={{ padding: '8px 8px', color: '#6b7280' }}>{h.industry || '—'}</td>
                        <td style={{ padding: '8px 8px', color: '#6b7280', whiteSpace: 'nowrap' }}>{h.size_estimate || '—'}</td>
                        <td style={{ padding: '8px 8px' }}><StatusBadge status={h.status} /></td>
                        <td style={{ padding: '8px 8px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                          {new Date(h.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
