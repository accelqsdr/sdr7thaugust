import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

function MetricCard({ label, value, sub, subColor }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: '#111' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: subColor || '#888', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const STAGES = ['fresh','contacted','replied','meeting','won'];
const STAGE_COLORS = { fresh: '#3b82f6', contacted: '#10b981', replied: '#f59e0b', meeting: '#8b5cf6', won: '#22c55e' };

export default function SDRDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ total: 0, fresh: 0, emailsSent: 0, replies: 0, bounced: 0 });
  const [followups, setFollowups] = useState([]);
  const [activity, setActivity] = useState([]);
  const [pipeline, setPipeline] = useState({});

  useEffect(() => {
    async function load() {
      const [{ data: contacts }, { data: acts }] = await Promise.all([
        supabase.from('contacts').select('*').eq('owner_id', user.id),
        supabase.from('activity_log').select('*, contacts(full_name,company)').eq('actor_id', user.id).order('created_at', { ascending: false }).limit(5),
      ]);
      const c = contacts || [];
      const pipe = {};
      STAGES.forEach(s => { pipe[s] = c.filter(x => x.status === s).length; });
      setStats({
        total: c.filter(x => !x.bounced).length,
        fresh: c.filter(x => x.status === 'fresh').length,
        emailsSent: (acts || []).filter(a => a.activity_type === 'email_sent').length,
        replies: c.filter(x => x.status === 'replied' || x.status === 'meeting').length,
        bounced: c.filter(x => x.bounced).length,
      });
      setPipeline(pipe);
      setFollowups(c.filter(x => !x.bounced && x.next_followup).sort((a, b) => new Date(a.next_followup) - new Date(b.next_followup)).slice(0, 5));
      setActivity(acts || []);
    }
    load();
  }, [user.id]);

  const maxPipe = Math.max(...Object.values(pipeline), 1);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Good day, {profile?.full_name?.split(' ')[0]} 👋</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>Here's your outreach summary</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <MetricCard label="Active contacts" value={stats.total} sub={`${stats.bounced} bounced (excluded)`} subColor="#dc2626" />
        <MetricCard label="Fresh leads" value={stats.fresh} sub="Ready to contact" />
        <MetricCard label="Replies received" value={stats.replies} sub="This week" subColor="#059669" />
        <MetricCard label="Bounced" value={stats.bounced} sub="Excluded from queue" subColor="#dc2626" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Pipeline */}
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 14 }}>My pipeline</div>
          {STAGES.map(s => (
            <div key={s} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: '#555', textTransform: 'capitalize' }}>{s}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{pipeline[s] || 0}</span>
              </div>
              <div style={{ height: 5, background: '#f0f0ee', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${((pipeline[s] || 0) / maxPipe) * 100}%`, background: STAGE_COLORS[s], borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Follow-ups */}
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 14 }}>Due follow-ups <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>(bounced excluded)</span></div>
          {followups.length === 0 ? (
            <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 20 }}>All caught up!</div>
          ) : followups.map(c => {
            const isOverdue = new Date(c.next_followup) < new Date();
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '0.5px solid #f5f5f3' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#2563eb' }}>
                  {(c.full_name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{c.full_name}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{c.company}</div>
                </div>
                <span style={{ fontSize: 11, color: isOverdue ? '#dc2626' : '#888' }}>
                  {isOverdue ? '⚠ Overdue' : new Date(c.next_followup).toLocaleDateString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity */}
      <div style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 12 }}>Recent activity</div>
        {activity.length === 0 ? (
          <div style={{ color: '#aaa', fontSize: 13 }}>No activity yet.</div>
        ) : activity.map(a => (
          <div key={a.id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '0.5px solid #f5f5f3' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563eb', marginTop: 5, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, color: '#555' }}>
                {a.activity_type.replace(/_/g, ' ')}
                {a.contacts?.full_name ? ` — ${a.contacts.full_name}` : ''}
                {a.contacts?.company ? ` @ ${a.contacts.company}` : ''}
              </div>
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{new Date(a.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
