import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ROLE_COLORS = { director:'#7c3aed', manager:'#2563eb', poc:'#0891b2', sdr:'#059669' };

export default function Teams() {
  const { user, profile } = useAuth();
  const [hierarchy, setHierarchy] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: subs } = await supabase.rpc('get_subordinate_ids', { manager_user_id: user.id });
      const subIds = (subs || []).map(s => s.user_id);
      const lookupIds = [user.id, ...subIds];

      const [{ data: hier }, { data: c }] = await Promise.all([
        supabase.from('org_hierarchy').select('*').in('user_id', lookupIds),
        supabase.from('contacts').select('owner_id, status, bounced').in('owner_id', lookupIds),
      ]);
      setHierarchy(hier || []);
      setContacts(c || []);
      setLoading(false);
    }
    load();
  }, [user.id]);

  function getStats(userId) {
    const c = contacts.filter(x => x.owner_id === userId);
    return {
      active: c.filter(x => !x.bounced).length,
      replies: c.filter(x => ['replied','meeting','won'].includes(x.status)).length,
      won: c.filter(x => x.status === 'won').length,
      bounced: c.filter(x => x.bounced).length,
    };
  }

  // Build tree: manager (me) → pocs → sdrs
  const me = hierarchy.find(h => h.user_id === user.id) || { full_name: profile?.full_name, role: profile?.role };
  const pocs = hierarchy.filter(h => h.reports_to === user.id);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Team structure</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>Your reporting chain and team members</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>Loading…</div>
      ) : (
        <div>
          {pocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>
              No team members found. Add users with <code>reports_to</code> set to your user ID in org_hierarchy.
            </div>
          ) : pocs.map(poc => {
            const pocStats = getStats(poc.user_id);
            const sdrs = hierarchy.filter(h => h.reports_to === poc.user_id);
            return (
              <div key={poc.id} style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
                {/* POC header */}
                <div style={{ padding: '14px 18px', background: '#f8f9fa', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '0.5px solid #e8e8e4' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#2563eb' }}>
                    {(poc.full_name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{poc.full_name}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{poc.region || 'No region'}</div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#e0edff', color: '#2563eb' }}>POC</span>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#555' }}>
                    <span><strong style={{ color: '#111' }}>{pocStats.active}</strong> contacts</span>
                    <span><strong style={{ color: '#059669' }}>{pocStats.replies}</strong> replies</span>
                    <span><strong style={{ color: '#dc2626' }}>{pocStats.bounced}</strong> bounced</span>
                  </div>
                </div>
                {/* SDRs */}
                {sdrs.map(sdr => {
                  const ss = getStats(sdr.user_id);
                  return (
                    <div key={sdr.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px 11px 40px', borderBottom: '0.5px solid #f5f5f3' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#059669' }}>
                        {(sdr.full_name || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{sdr.full_name}</div>
                        <div style={{ fontSize: 11, color: '#aaa' }}>{sdr.region || 'No region'}</div>
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: '#f0fdf4', color: '#059669' }}>SDR</span>
                      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#666' }}>
                        <span><strong style={{ color: '#111' }}>{ss.active}</strong> contacts</span>
                        <span><strong style={{ color: '#059669' }}>{ss.replies}</strong> replies</span>
                        <span><strong style={{ color: '#16a34a' }}>{ss.won}</strong> won</span>
                        <span><strong style={{ color: '#dc2626' }}>{ss.bounced}</strong> bounced</span>
                      </div>
                    </div>
                  );
                })}
                {sdrs.length === 0 && (
                  <div style={{ padding: '12px 40px', color: '#ccc', fontSize: 13 }}>No SDRs under this POC</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
