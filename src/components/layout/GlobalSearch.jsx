import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

// Admin-only global search — companies + contacts across the admin's own
// records plus every person in their full downline (direct and indirect
// reports), via the get_subordinate_ids RPC.
export default function GlobalSearch() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'admin';

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scopeIds, setScopeIds] = useState(null);
  const [results, setResults] = useState({ accounts: [], contacts: [] });
  const boxRef = useRef(null);

  useEffect(() => {
    if (!isAdmin || !user?.id) return;
    let cancelled = false;
    supabase.rpc('get_subordinate_ids', { manager_user_id: user.id }).then(({ data, error }) => {
      if (cancelled) return;
      const ids = error ? [] : (data || []).map(r => r.user_id);
      setScopeIds([user.id, ...ids]);
    });
    return () => { cancelled = true; };
  }, [isAdmin, user?.id]);

  useEffect(() => {
    if (!isAdmin || !scopeIds || query.trim().length < 2) {
      setResults({ accounts: [], contacts: [] });
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const q = `%${query.trim()}%`;
      const [{ data: accs }, { data: cons }] = await Promise.all([
        supabase.from('accounts').select('id, name, industry, country').in('owner_id', scopeIds).ilike('name', q).limit(6),
        supabase.from('contacts').select('id, first_name, last_name, company, email, status').in('owner_id', scopeIds)
          .or(`first_name.ilike.${q},last_name.ilike.${q},company.ilike.${q},email.ilike.${q}`).limit(6),
      ]);
      setResults({ accounts: accs || [], contacts: cons || [] });
      setLoading(false);
      setOpen(true);
    }, 300);
    return () => clearTimeout(t);
  }, [query, scopeIds, isAdmin]);

  useEffect(() => {
    function onClickOutside(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!isAdmin) return null;

  function goTo(path) { setOpen(false); setQuery(''); navigate(path); }

  const hasResults = results.accounts.length > 0 || results.contacts.length > 0;

  return (
    <div ref={boxRef} style={{ position: 'relative', width: 340, alignSelf: 'flex-end', margin: '12px 20px 0', flexShrink: 0 }}>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        placeholder="🔍 Search your team's companies & contacts…"
        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, outline: 'none', color: '#333', background: '#fff', boxSizing: 'border-box' }}
      />
      {open && query.trim().length >= 2 && (
        <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxHeight: 400, overflowY: 'auto', zIndex: 50 }}>
          {loading ? (
            <div style={{ padding: 16, fontSize: 13, color: '#aaa', textAlign: 'center' }}>Searching…</div>
          ) : !hasResults ? (
            <div style={{ padding: 16, fontSize: 13, color: '#aaa', textAlign: 'center' }}>No matches</div>
          ) : (
            <>
              {results.accounts.length > 0 && (
                <div>
                  <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>Companies</div>
                  {results.accounts.map(a => (
                    <div key={a.id} onClick={() => goTo(`/accounts/${a.id}`)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}>
                      <div style={{ fontWeight: 500, color: '#111' }}>🏢 {a.name}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{[a.industry, a.country].filter(Boolean).join(' · ')}</div>
                    </div>
                  ))}
                </div>
              )}
              {results.contacts.length > 0 && (
                <div>
                  <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>Contacts</div>
                  {results.contacts.map(c => (
                    <div key={c.id} onClick={() => goTo(`/contacts/${c.id}`)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}>
                      <div style={{ fontWeight: 500, color: '#111' }}>👤 {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{[c.company, c.status].filter(Boolean).join(' · ')}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
