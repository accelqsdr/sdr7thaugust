import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateShort(d) {
  if (!d) return '—';
  const now = new Date();
  const date = new Date(d);
  const diffDays = Math.floor((now - date) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const STAGE_META = {
  Fresh: { bg: '#dbeafe', color: '#1d4ed8' },
  F1:    { bg: '#d1fae5', color: '#065f46' },
  F2:    { bg: '#fef9c3', color: '#854d0e' },
  F3:    { bg: '#ffedd5', color: '#9a3412' },
  F4:    { bg: '#fee2e2', color: '#991b1b' },
  F5:    { bg: '#f1f5f9', color: '#475569' },
};

export default function Lists() {
  const { user, profile } = useAuth();
  const canViewAll = ['director', 'manager'].includes(profile?.role);
  const [viewAll, setViewAll] = useState(false);

  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [listContacts, setListContacts] = useState({});

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { fetchLists(); }, [viewAll]);

  async function fetchLists() {
    setLoading(true);
    let q = supabase.from('lists').select('*').order('created_at', { ascending: false });
    if (!viewAll || !canViewAll) q = q.eq('owner_id', user.id);
    const { data } = await q;
    setLists(data || []);
    setLoading(false);
  }

  async function fetchListContacts(listId) {
    const { data: cls } = await supabase
      .from('contact_lists')
      .select('*, contacts(*)')
      .eq('list_id', listId)
      .order('added_date', { ascending: false });
    setListContacts(prev => ({
      ...prev,
      [listId]: (cls || []).map(cl => ({ cl, contact: cl.contacts })),
    }));
  }

  function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    fetchListContacts(id);
  }

  async function createList() {
    if (!newName.trim()) return;
    setCreating(true);
    await supabase.from('lists').insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      owner_id: user.id,
    });
    setNewName(''); setNewDesc(''); setShowCreate(false); setCreating(false);
    fetchLists();
  }

  async function renameList(id) {
    if (!renameVal.trim()) return;
    await supabase.from('lists').update({ name: renameVal.trim() }).eq('id', id);
    setRenaming(null); setRenameVal('');
    fetchLists();
  }

  async function deleteList(id) {
    await supabase.from('lists').delete().eq('id', id);
    setDeleteConfirm(null);
    if (expanded === id) setExpanded(null);
    fetchLists();
  }

  async function removeFromList(contactId, listId) {
    await supabase.from('contact_lists').delete()
      .eq('contact_id', contactId).eq('list_id', listId);
    fetchListContacts(listId);
  }

  async function toggleCampaign(cl, listId) {
    await supabase.from('contact_lists')
      .update({ is_active_campaign: !cl.is_active_campaign })
      .eq('id', cl.id);
    fetchListContacts(listId);
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0 }}>📋 Lists</h1>
            {canViewAll && (
              <button onClick={() => setViewAll(v => !v)}
                style={{ padding: '4px 12px', borderRadius: 20, border: '1.5px solid #e0e0e0',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  background: viewAll ? '#111' : '#fff', color: viewAll ? '#fff' : '#555' }}>
                {viewAll ? '👥 Team view' : 'View all'}
              </button>
            )}
          </div>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
            {lists.length} list{lists.length !== 1 ? 's' : ''} · Organize contacts into targeted campaign groups
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '9px 18px', background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Create List
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 18 }}>Create New List</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>List Name *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Banking Q3, Workday Decision Makers"
                onKeyDown={e => e.key === 'Enter' && createList()}
                autoFocus
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Description (optional)</label>
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="What is this list for?"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={createList} disabled={creating || !newName.trim()}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: newName.trim() ? '#2563eb' : '#9ca3af',
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: newName.trim() ? 'pointer' : 'not-allowed' }}>
                {creating ? 'Creating...' : 'Create List'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626', marginBottom: 10 }}>Delete List?</div>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 20 }}>
              "<strong>{deleteConfirm.name}</strong>" will be deleted. Contacts won't be deleted — just removed from this list.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => deleteList(deleteConfirm.id)}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lists */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>Loading lists...</div>
      ) : lists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 6 }}>No lists yet</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
            Create a list to organize your contacts into targeted campaigns
          </div>
          <button onClick={() => setShowCreate(true)}
            style={{ padding: '10px 22px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Create your first list
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lists.map(list => {
            const isExpanded = expanded === list.id;
            const contacts = listContacts[list.id] || [];
            const activeCampaigns = contacts.filter(r => r.cl.is_active_campaign).length;

            return (
              <div key={list.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

                {/* List header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer' }}
                  onClick={() => toggleExpand(list.id)}>
                  <div style={{ fontSize: 18 }}>📋</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {renaming === list.id ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <input value={renameVal} onChange={e => setRenameVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') renameList(list.id); if (e.key === 'Escape') setRenaming(null); }}
                          autoFocus
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1.5px solid #2563eb', fontSize: 14, fontWeight: 600, outline: 'none', width: 240 }} />
                        <button onClick={() => renameList(list.id)}
                          style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Save</button>
                        <button onClick={() => setRenaming(null)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{list.name}</div>
                    )}
                    {list.description && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{list.description}</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
                    {activeCampaigns > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                        background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}>
                         🟢 active
                      </span>
                    )}
                    <div style={{ fontSize: 11, color: '9ca3af' }}>Created {formatDate(list.created_at)}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setRenaming(list.id); setRenameVal(list.name); }}
                      style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, color: '#374151', cursor: 'pointer' }}>
                      Rename
                    </button>
                    <button onClick={() => setDeleteConfirm({ id: list.id, name: list.name })}
                      style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #fecaca', background: '#fff', fontSize: 11, color: '#dc2626', cursor: 'pointer' }}>
                      Delete
                    </button>
                  </div>

                  <div style={{ fontSize: 13, color: '#9ca3af', flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</div>
                </div>

                {/* Expanded contacts */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f3f4f6' }}>
                    {contacts.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                        No contacts in this list yet. Import a CSV and assign it to this list.
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                            {['Name', 'Company', 'Stage', 'Added to List', 'Last Touchpoint', 'Campaign', 'Actions'].map(h => (
                              <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {contacts.map(({ cl, contact: c }) => {
                            if (!c) return null;
                            const sm = STAGE_META[c.status] || { bg: '#f1f5f9', color: '#475569' };
                            const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '—';
                            return (
                              <tr key={cl.id} style={{ borderBottom: '1px solid #f9fafb' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                                onMouseLeave={e => e.currentTarget.style.background = ''}>
                                <td style={{ padding: '9px 14px' }}>
                                  <div style={{ fontWeight: 600, color: '#111' }}>{name}</div>
                                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.title || '—'}</div>
                                </td>
                                <td style={{ padding: '9px 14px', color: '#374151' }}>{c.company || '—'}</td>
                                <td style={{ padding: '9px 14px' }}>
                                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.color }}>
                                    {c.status || '—'}
                                  </span>
                                </td>
                                <td style={{ padding: '9px 14px', color: '#6b7280' }}>{formatDate(cl.added_date)}</td>
                                <td style={{ padding: '9px 14px' }}>
                                  <span style={{ color: c.last_touchpoint_date ? '#374151' : '#d1d5db', fontWeight: c.last_touchpoint_date ? 500 : 400 }}>
                                    {c.last_touchpoint_date ? formatDateShort(c.last_touchpoint_date) : 'Never'}
                                  </span>
                                </td>
                                <td style={{ padding: '9px 14px' }}>
                                  <button onClick={() => toggleCampaign(cl, list.id)}
                                    style={{ padding: '3px 10px', borderRadius: 20, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                      background: cl.is_active_campaign ? '#d1fae5' : '#f3f4f6',
                                      color: cl.is_active_campaign ? '#065f46' : '#9ca3af' }}>
                                    {cl.is_active_campaign ? '🟢 Active' : 'Inactive'}
                                  </button>
                                </td>
                                <td style={{ padding: '9px 14px' }}>
                                  <button onClick={() => removeFromList(c.id, list.id)}
                                    style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', fontSize: 11, color: '#dc2626', cursor: 'pointer' }}>
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
