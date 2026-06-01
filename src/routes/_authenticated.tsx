import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/api/mock-audit.functions";
import { Button } from "@/components/ui/button";
import { LogOut, ClipboardCheck, BarChart3, Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const fetchMe = useServerFn(getMyProfile);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  const isAdmin = me?.role === "admin";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-20 bg-[oklch(0.22_0.06_255)] text-[oklch(0.985_0.003_240)] shadow">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <div className="font-semibold tracking-tight">Mock Audit Manager</div>
            <nav className="hidden md:flex items-center gap-1 text-sm">
              <NavLink to="/conduct" current={path.startsWith("/conduct")} icon={<ClipboardCheck className="size-4"/>}>Conduct Audit</NavLink>
              <NavLink to="/dashboard" current={path.startsWith("/dashboard")} icon={<BarChart3 className="size-4"/>}>Dashboard</NavLink>
              {isAdmin && <NavLink to="/admin" current={path.startsWith("/admin")} icon={<Settings className="size-4"/>}>Admin</NavLink>}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:block opacity-80">
              {me?.profile?.full_name ?? me?.profile?.store_code} · <span className="uppercase tracking-wide">{me?.role?.replace("_", " ")}</span>
            </div>
            <Button size="sm" variant="ghost" className="text-inherit hover:bg-white/10" onClick={logout}><LogOut className="size-4"/></Button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-8"><div className="mx-auto max-w-7xl px-4 py-6"><Outlet /></div></main>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t bg-card grid grid-cols-3 text-xs">
        <MobileTab to="/conduct" current={path.startsWith("/conduct")} icon={<ClipboardCheck className="size-5"/>} label="Conduct"/>
        <MobileTab to="/dashboard" current={path.startsWith("/dashboard")} icon={<BarChart3 className="size-5"/>} label="Dashboard"/>
        {isAdmin
          ? <MobileTab to="/admin" current={path.startsWith("/admin")} icon={<Settings className="size-5"/>} label="Admin"/>
          : <button onClick={logout} className="flex flex-col items-center justify-center py-2 text-muted-foreground"><LogOut className="size-5"/>Sign out</button>}
      </nav>
    </div>
  );
}

function NavLink({ to, children, current, icon }: { to: string; children: React.ReactNode; current: boolean; icon: React.ReactNode }) {
  return (
    <Link to={to} className={`px-3 py-1.5 rounded-md inline-flex items-center gap-2 ${current ? "bg-white/15" : "hover:bg-white/10"}`}>
      {icon}{children}
    </Link>
  );
}
function MobileTab({ to, current, icon, label }: { to: string; current: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className={`flex flex-col items-center justify-center py-2 ${current ? "text-primary" : "text-muted-foreground"}`}>
      {icon}{label}
    </Link>
  );
}
