import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getUserRole } from '../lib/auth';

const AuthContext = createContext(null);
const VIEW_AS_KEY = 'accelq_view_as';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // { role, full_name, region, id, reports_to }
  const [loading, setLoading] = useState(true);
  // viewingAs: { id, email, profile } for the user an admin is currently
  // "viewing as". Only ever set when the real, logged-in user is an admin.
  const [viewingAs, setViewingAs] = useState(() => {
    try {
      const raw = sessionStorage.getItem(VIEW_AS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        const session = data?.session ?? null;
        if (session?.user) {
          setUser(session.user);
          getUserRole(session.user.id).then(setProfile).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        try {
          const p = await getUserRole(session.user.id);
          setProfile(p);
        } catch {}
      } else {
        setUser(null);
        setProfile(null);
        setViewingAs(null);
        try { sessionStorage.removeItem(VIEW_AS_KEY); } catch {}
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Once we know the real profile, drop any stale "view as" state that
  // shouldn't exist (e.g. the real user is no longer an admin).
  useEffect(() => {
    if (!loading && profile && profile.role !== 'admin' && viewingAs) {
      setViewingAs(null);
      try { sessionStorage.removeItem(VIEW_AS_KEY); } catch {}
    }
  }, [loading, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Admin-only: start viewing the platform as another user. Fetches that
  // user's real profile (role, region, reports_to, subAdminTier) so every
  // page — Dashboard, Sidebar, Contacts, FollowUps, Activity, etc. — renders
  // exactly as it would for them, since they all key off useAuth()'s user/profile.
  async function viewAsUser(targetId, targetEmail) {
    if (!profile || profile.role !== 'admin') return { error: 'Only admins can do this' };
    const targetProfile = await getUserRole(targetId);
    if (!targetProfile) return { error: 'Could not load that user’s profile' };
    const next = { id: targetId, email: targetEmail, profile: targetProfile };
    setViewingAs(next);
    try { sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(next)); } catch {}
    return { ok: true };
  }

  function exitViewAs() {
    setViewingAs(null);
    try { sessionStorage.removeItem(VIEW_AS_KEY); } catch {}
  }

  // Everything the rest of the app reads (user, profile) reflects whoever is
  // being "viewed as", if anyone — so existing pages that filter data by
  // user.id / profile.role need no changes to support view-as. realUser /
  // realProfile always stay the actual logged-in admin's identity.
  const effectiveUser = viewingAs ? { ...user, id: viewingAs.id, email: viewingAs.email } : user;
  const effectiveProfile = viewingAs ? viewingAs.profile : profile;

  return (
    <AuthContext.Provider value={{
      user: effectiveUser,
      profile: effectiveProfile,
      loading,
      realUser: user,
      realProfile: profile,
      viewingAs,
      viewAsUser,
      exitViewAs,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
