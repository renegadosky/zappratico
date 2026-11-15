import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { ReactNode, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { AdSlot } from "@/components/AdSlot";
import {
  LayoutDashboard,
  Bot,
  Sparkles,
  LayoutTemplate,
  Settings,
  LogOut,
  Loader2,
  Menu,
  X,
  Crown,
  ShoppingBag,
  Store,
  BarChart3,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition } from "@/components/PageTransition";


type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
      { to: "/analytics", label: "Análises", icon: BarChart3 },
      { to: "/orders", label: "Pedidos", icon: ShoppingBag },
    ],
  },
  {
    label: "Minha loja",
    items: [
      { to: "/stores", label: "Minhas lojas", icon: Store },
      { to: "/bots", label: "Meus bots", icon: Bot },
    ],
  },
  {
    label: "Criar",
    items: [
      { to: "/templates", label: "Templates", icon: LayoutTemplate },
      { to: "/ai-builder", label: "Assistente de Criação", icon: Sparkles },
    ],
  },
  {
    label: "Conta",
    items: [
      { to: "/plans", label: "Planos", icon: Crown },
      { to: "/settings", label: "Configurações", icon: Settings },
      { to: "/suporte", label: "Suporte", icon: LifeBuoy },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let alive = true;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setIsAdmin(Boolean(data));
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const navGroups: NavGroup[] = isAdmin
    ? NAV_GROUPS.map((g) =>
        g.label === "Conta"
          ? { ...g, items: [...g.items, { to: "/admin", label: "Plataforma", icon: ShieldCheck }] }
          : g,
      )
    : NAV_GROUPS;


  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    // Only redirect to onboarding once the profile has actually loaded
    // and we know onboarding is not completed.
    if (profile && !profile.onboarding_completed) {
      navigate({ to: "/onboarding" });
    }
  }, [user, profile, loading, navigate]);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const SidebarInner = (
    <>
      <div className="p-5 border-b border-border flex items-center justify-between">
        <Logo size="sm" />
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-muted-foreground hover:text-foreground"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="px-3 py-2 mb-2">
          <div className="text-sm font-medium truncate">{profile.business_name}</div>
          <div className="text-xs text-muted-foreground truncate">{user.email}</div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </div>
    </>
  );

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 h-screen border-r border-border bg-surface flex-col shrink-0">
        {SidebarInner}
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-surface border-b border-border flex items-center justify-between px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-foreground p-2 -ml-2"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo size="sm" />
        <div className="w-9" />
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-surface border-r border-border flex flex-col">
            {SidebarInner}
          </aside>
        </>
      )}

      <main className="flex-1 h-screen overflow-y-auto pt-14 md:pt-0">
        <PageTransition>{children}</PageTransition>
        <AdSlot />
      </main>
    </div>
  );
}
