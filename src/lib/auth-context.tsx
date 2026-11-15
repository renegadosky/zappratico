import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  full_name: string | null;
  business_name: string | null;
  segment: string | null;
  current_channel: string | null;
  main_goal: string | null;
  onboarding_completed: boolean;
  plan: "free" | "pro" | "business";
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (currentUser: User) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (data) {
      setProfile(data as Profile);
      return;
    }

    if (!error) {
      const { data: created } = await supabase
        .from("profiles")
        .insert({
          id: currentUser.id,
          full_name: (currentUser.user_metadata?.full_name as string | undefined) ?? "",
        })
        .select("*")
        .maybeSingle();

      if (created) {
        setProfile(created as Profile);
        return;
      }
    }

    setProfile({
      id: currentUser.id,
      full_name: (currentUser.user_metadata?.full_name as string | undefined) ?? null,
      business_name: null,
      segment: null,
      current_channel: null,
      main_goal: null,
      onboarding_completed: false,
      plan: "free",
    });
  }, []);

  useEffect(() => {
    let currentUserId: string | null = null;
    let refreshFailures = 0;

    const ACTIVE_KEY = "zp.active-uid";
    const authKeys = () => {
      try {
        return Object.keys(window.localStorage).filter(
          (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
        );
      } catch {
        return [];
      }
    };

    /** Keeps exactly one stored session: the newest one. */
    const pruneStaleTokens = (keepUid: string | null) => {
      if (typeof window === "undefined") return;
      try {
        for (const k of authKeys()) {
          const raw = window.localStorage.getItem(k);
          const uid = raw ? (JSON.parse(raw)?.user?.id as string | undefined) : undefined;
          if (!keepUid || (uid && uid !== keepUid)) window.localStorage.removeItem(k);
        }
        if (keepUid) window.localStorage.setItem(ACTIVE_KEY, keepUid);
        else window.localStorage.removeItem(ACTIVE_KEY);
      } catch {}
    };

    const forceSignOut = async () => {
      try { await supabase.auth.signOut(); } catch {}
      pruneStaleTokens(null);
      setSession(null);
      setUser(null);
      setProfile(null);
      currentUserId = null;
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === "TOKEN_REFRESHED") refreshFailures = 0;
      setSession(sess);
      const newUser = sess?.user ?? null;
      setUser(newUser);
      pruneStaleTokens(newUser?.id ?? null);

      const newUserId = newUser?.id ?? null;
      if (newUserId !== currentUserId) {
        currentUserId = newUserId;
        if (newUser) {
          setTimeout(() => loadProfile(newUser), 0);
        } else {
          setProfile(null);
        }
      }
    });

    // Break stuck refresh_token loops (network offline or invalidated session).
    // Without this the client retries forever and any second tab thinks it's logged out.
    const originalFetch = typeof window !== "undefined" ? window.fetch.bind(window) : null;
    if (originalFetch) {
      window.fetch = async (...args: Parameters<typeof fetch>) => {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
        const isRefresh = url.includes("/auth/v1/token?grant_type=refresh_token");
        try {
          const res = await originalFetch(...args);
          if (isRefresh) {
            if (res.ok) refreshFailures = 0;
            else if ([400, 401, 403].includes(res.status)) await forceSignOut();
          }
          return res;
        } catch (err) {
          if (isRefresh) {
            refreshFailures += 1;
            if (refreshFailures >= 3) await forceSignOut();
          }
          throw err;
        }
      };
    }

    // Another tab signed in/out with a different account: adopt the newest session only.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ACTIVE_KEY) return;
      const active = e.newValue;
      if (!active) { void forceSignOut(); return; }
      if (currentUserId && active !== currentUserId) window.location.reload();
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      const u = sess?.user ?? null;
      const active = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_KEY) : null;

      // Stale token from a previously used account: drop it instead of restoring it.
      if (u && active && active !== u.id) {
        await forceSignOut();
        setLoading(false);
        return;
      }

      pruneStaleTokens(u?.id ?? null);
      setSession(sess);
      setUser(u);
      if (u && currentUserId !== u.id) {
        currentUserId = u.id;
        loadProfile(u);
      }
      setLoading(false);
    }).catch(async () => {
      await forceSignOut();
      setLoading(false);
    });

    return () => {
      sub.subscription.unsubscribe();
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      if (originalFetch && typeof window !== "undefined") window.fetch = originalFetch;
    };
  }, [loadProfile]);


  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user);
  }, [user, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    try {
      if (typeof window !== "undefined") {
        Object.keys(window.localStorage)
          .filter((k) => (k.startsWith("sb-") && k.endsWith("-auth-token")) || k === "zp.active-uid")
          .forEach((k) => window.localStorage.removeItem(k));
      }
    } catch {}
    setProfile(null);
  }, []);


  const value = useMemo(
    () => ({ user, session, profile, loading, signOut, refreshProfile }),
    [user, session, profile, loading, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
