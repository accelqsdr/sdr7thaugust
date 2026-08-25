import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function LinkedInImport() {
  const { profile } = useAuth();
  const [pendingContacts, setPendingContacts] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

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

  async function importContacts() {
    if (!pendingContacts.length) return;
    setImporting(true);
    const stats = { imported: 0, skipped: 0, errors: [] };

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
          first_name: c.firstName || '',
          last_name: c.lastName || '',
          title: c.designation || '',
          company: c.company || '',
          email: c.email || null,
          linkedin_url: c.linkedinUrl || null,
          status: 'fresh',
          owner_id: profile?.id || null,
          notes: c.country ? 'Location: ' + c.country : null,
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
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
        <span style={{ color: '#15803d', fontWeight: 500 }}>Listening for contacts from extension...</span>
      </div>

      {results && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20, background: results.errors.length ? '#fef3c7' : '#f0fdf4', border: '1px solid ' + (results.errors.length ? '#fde68a' : '#bbf7d0'), fontSize: 13 }}>
          <strong style={{ color: '#15803d' }}>{results.imported} imported</strong>
          {results.skipped > 0 && <span style={{ color: '#666' }}>, {results.skipped} skipped (already exist)</span>}
          {results.errors.length > 0 && <div style={{ marginTop: 6, color: '#b45309' }}>{results.errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
        </div>
      )}

      {pendingContacts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed #e5e7eb', borderRadius: 12, color: '#999' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>&#128279;</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>No contacts received yet</div>
          <div style={{ fontSize: 13, maxWidth: 360, margin: '0 auto', lineHeight: 1.7 }}>
            1. Go to LinkedIn Sales Navigator lead list<br />
            2. Click the <strong>ACCELQ Importer</strong> extension icon in the toolbar<br />
            3. Select contacts and click <strong>Add to ACCELQ</strong>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{pendingContacts.length} contact{pendingContacts.length !== 1 ? 's' : ''} ready to import</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPendingContacts([])} style={{ padding: '7px 14px', background: '#fff', color: '#666', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Clear all</button>
              <button onClick={importContacts} disabled={importing} style={{ padding: '7px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: importing ? 'wait' : 'pointer', opacity: importing ? 0.7 : 1 }}>
                {importing ? 'Importing...' : 'Import ' + pendingContacts.length + ' Contact' + (pendingContacts.length !== 1 ? 's' : '')}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingContacts.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {(c.firstName?.[0] || '?')}{(c.lastName?.[0] || '')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{c.firstName} {c.lastName}</div>
                  {c.designation && <div style={{ fontSize: 12, color: '#555' }}>{c.designation}</div>}
                  {c.company && <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 500 }}>{c.company}</div>}
                  <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
                    {c.country && <span style={{ fontSize: 11, color: '#999' }}>{c.country}</span>}
                    {c.email && <span style={{ fontSize: 11, color: '#059669' }}>{c.email}</span>}
                    {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2563eb' }}>LinkedIn</a>}
                  </div>
                </div>
                <button onClick={() => removeContact(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 18, padding: 4 }}>x</button>
              </div>
            ))}
          </div>
        </>
      )}
      <style>{'@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }'}</style>
    </div>
  );
}
