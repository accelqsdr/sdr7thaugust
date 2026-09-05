import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function LinkedInImport() {
  const { profile } = useAuth();
  const [pendingContacts, setPendingContacts] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [newCompanies, setNewCompanies] = useState([]);
  const [selectedNew, setSelectedNew] = useState(new Set());
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    function handleMessage(event) {
      if (event.data?.type === 'ACCELQ_ADD_CONTACTS' && Array.isArray(event.data.contacts)) {
        setPendingContacts(prev => {
          const existingKeys = new Set(prev.map(c => c.linkedinUrl || c.email).filter(Boolean));
          const newOnes = event.data.contacts.filter(c => {
            const key = c.linkedinUrl || c.email;
            return !key || !existingKeys.has(key);
          });
          return [...prev, ...newOnes];
        });
        setResults(null);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  function removeContact(idx) {
    setPendingContacts(prev => prev.filter((_, i) => i !== idx));
  }

  async function checkNewCompanies() {
    if (!pendingContacts.length) return;
    const uniqueCompanies = [...new Set(pendingContacts.map(c => c.company).filter(Boolean))];
    const { data: existing } = await supabase.from('accounts').select('id, name').in('name', uniqueCompanies);
    const existingNames = new Set((existing || []).map(a => a.name));
    const newCos = uniqueCompanies.filter(n => !existingNames.has(n)).map(name => {
      const sample = pendingContacts.find(c => c.company === name) || {};
      return { name, country: sample.country || '' };
    });
    if (newCos.length > 0) {
      setNewCompanies(newCos);
      setSelectedNew(new Set(newCos.map(c => c.name)));
      setShowReview(true);
    } else {
      await runImport(existing || [], []);
    }
  }

  async function confirmAndImport() {
    setShowReview(false);
    const uniqueNames = [...new Set(pendingContacts.map(c => c.company).filter(Boolean))];
    const { data: existingAccounts } = await supabase.from('accounts').select('id, name').in('name', uniqueNames);
    const toCreate = newCompanies.filter(c => selectedNew.has(c.name)).map(c => ({
      name: c.name,
      owner_id: profile?.id || null,
      country: c.country || null,
    }));
    let createdAccounts = [];
    if (toCreate.length > 0) {
      const { data: created } = await supabase.from('accounts').insert(toCreate).select('id, name');
      createdAccounts = created || [];
    }
    await runImport(existingAccounts || [], createdAccounts);
  }

  async function runImport(existingAccounts, createdAccounts) {
    setImporting(true);
    const stats = { imported: 0, skipped: 0, errors: [] };

    const companyAccountMap = {};
    [...existingAccounts, ...createdAccounts].forEach(a => { companyAccountMap[a.name] = a.id; });

    for (const c of pendingContacts) {
      try {
        let isDup = false;
        if (c.linkedinUrl) {
          const { data } = await supabase.from('contacts').select('id').eq('linkedin_url', c.linkedinUrl).limit(1);
          if (data && data.length > 0) isDup = true;
        }
        if (!isDup && c.email) {
          const { data } = await supabase.from('contacts').select('id').eq('email', c.email).limit(1);
          if (data && data.length > 0) isDup = true;
        }
        if (isDup) { stats.skipped++; continue; }

        const { error } = await supabase.from('contacts').insert({
          first_name:   c.firstName || '',
          last_name:    c.lastName || '',
          title:        c.designation || '',
          company:      c.company || '',
          account_id:   companyAccountMap[c.company] || null,
          email:        c.email || null,
          linkedin_url: c.linkedinUrl || null,
          status:       'Fresh',
          owner_id:     profile?.id || null,
          notes:        c.country ? 'Location: ' + c.country : null,
        });

        if (error) stats.errors.push(c.firstName + ' ' + c.lastName + ': ' + error.message);
        else stats.imported++;
      } catch (err) {
        stats.errors.push(c.firstName + ' ' + c.lastName + ': ' + err.message);
      }
    }

    setResults(stats);
    if (stats.imported > 0) setPendingContacts([]);
    setImporting(false);
  }

  const toggleCompany = (name) => {
    setSelectedNew(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>LinkedIn Import</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#666' }}>
          Open a Sales Navigator lead list, click the <strong>ACCELQ Importer</strong> extension in the toolbar,
          select contacts, then click "Add to ACCELQ". Contacts appear here for review.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
        <span style={{ color: '#15803d', fontWeight: 500 }}>Listening for contacts from extension...</span>
      </div>

      {results && (
        <div style={{ padding: '12px 16px', background: results.errors.length > 0 ? '#fff7ed' : '#f0fdf4', border: '1px solid ' + (results.errors.length > 0 ? '#fed7aa' : '#bbf7d0'), borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
          <strong>{results.imported} imported</strong>, {results.skipped} skipped (duplicates)
          {results.errors.length > 0 && <div style={{ color: '#dc2626', marginTop: 4 }}>{results.errors.join(', ')}</div>}
        </div>
      )}

      {pendingContacts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa', fontSize: 13 }}>
          No contacts yet — use the extension on LinkedIn to add contacts here.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>{pendingContacts.length} contact{pendingContacts.length !== 1 ? 's' : ''} ready to import</span>
            <button onClick={checkNewCompanies} disabled={importing}
              style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.7 : 1 }}>
              {importing ? 'Importing…' : 'Import Contacts'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingContacts.map((c, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fff', border: '1px solid #e8e8e4', borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{c.designation || ''}{c.company ? ' · ' + c.company : ''}</div>
                  {c.email && <div style={{ fontSize: 12, color: '#888' }}>{c.email}</div>}
                </div>
                <button onClick={() => removeContact(idx)}
                  style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* New companies review modal */}
      {showReview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 520, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>New companies found</h2>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 18px' }}>
              {newCompanies.length} companies not in your Accounts yet. Select which ones to create automatically.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setSelectedNew(new Set(newCompanies.map(c => c.name)))}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#f9f9f9', cursor: 'pointer' }}>Select all</button>
              <button onClick={() => setSelectedNew(new Set())}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#f9f9f9', cursor: 'pointer' }}>Deselect all</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {newCompanies.map(c => (
                <div key={c.name} onClick={() => toggleCompany(c.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid ' + (selectedNew.has(c.name) ? '#bfdbfe' : '#e5e7eb'), background: selectedNew.has(c.name) ? '#eff6ff' : '#fafafa', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedNew.has(c.name)} onChange={() => toggleCompany(c.name)} onClick={e => e.stopPropagation()} style={{ cursor: 'pointer' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                    {c.country && <div style={{ fontSize: 12, color: '#888' }}>Country: {c.country}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowReview(false); runImport([], []); }}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#666' }}>
                Skip — import contacts only
              </button>
              <button onClick={confirmAndImport}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Create {selectedNew.size} account{selectedNew.size !== 1 ? 's' : ''} & import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
