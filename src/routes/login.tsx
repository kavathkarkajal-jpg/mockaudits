import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, ClipboardCheck, Eye, EyeOff, Lock, Shield, Store } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Mock Audits" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [storeCode, setStoreCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const email = `${storeCode.trim().toLowerCase()}@mockaudit.app`;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast.error(error.message); return; }
      const { data, error: userErr } = await supabase.auth.getUser();
      if (userErr || !data.user) {
        toast.error(userErr?.message ?? "Could not verify session. Please try again.");
        return;
      }
      navigate({ to: "/conduct", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[oklch(0.16_0.04_260)] px-5 py-10 flex items-center justify-center">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* dot grid top-left */}
        <svg className="absolute top-20 left-6 opacity-60" width="90" height="70">
          {Array.from({ length: 5 }).map((_, r) =>
            Array.from({ length: 7 }).map((_, c) => (
              <circle key={`${r}-${c}`} cx={c * 12 + 4} cy={r * 12 + 4} r="1.6" fill="oklch(0.55 0.18 280)" opacity={0.55 - r * 0.07} />
            ))
          )}
        </svg>
        {/* large ring top-right */}
        <div className="absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full border border-[oklch(0.45_0.15_275)]/30" />
        <div className="absolute -top-20 -right-20 h-[280px] w-[280px] rounded-full border border-[oklch(0.45_0.15_275)]/20" />
        {/* small ring bottom-left */}
        <div className="absolute -bottom-24 -left-24 h-[260px] w-[260px] rounded-full border border-[oklch(0.45_0.15_275)]/25" />
        {/* dots bottom-right */}
        <svg className="absolute bottom-16 right-6 opacity-60" width="14" height="80">
          {Array.from({ length: 6 }).map((_, i) => (
            <circle key={i} cx="4" cy={i * 12 + 4} r="1.6" fill="oklch(0.55 0.18 280)" />
          ))}
        </svg>
      </div>

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-5 grid h-20 w-20 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-[oklch(0.28_0.08_275)]/80 to-[oklch(0.20_0.06_270)]/80 shadow-[0_0_60px_-10px_oklch(0.55_0.22_280)] backdrop-blur">
            <ClipboardCheck className="h-10 w-10 text-[oklch(0.72_0.18_285)]" strokeWidth={2.2} />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Mock Audits</h1>
          <p className="mt-2 text-sm text-white/60">Smarter Audits. Better Performance.</p>
          <div className="mt-4 h-[3px] w-10 rounded-full bg-gradient-to-r from-[oklch(0.55_0.22_280)] to-[oklch(0.65_0.20_290)]" />
        </div>

        {/* Card */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-[oklch(0.20_0.05_265)]/60 p-6 shadow-2xl backdrop-blur-xl">
          <h2 className="text-xl font-bold text-white">Welcome back!</h2>
          <p className="mt-1 text-sm text-white/55">Sign in to continue to your account</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="storeCode" className="text-white">Store Code</Label>
              <div className="relative">
                <Store className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[oklch(0.65_0.18_285)]" />
                <Input
                  id="storeCode"
                  placeholder="Enter your store code"
                  autoCapitalize="characters"
                  autoComplete="username"
                  value={storeCode}
                  onChange={(e) => setStoreCode(e.target.value)}
                  required
                  className="h-12 rounded-xl border-white/10 bg-transparent pl-11 text-white placeholder:text-white/35 focus-visible:ring-[oklch(0.65_0.22_285)]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[oklch(0.65_0.18_285)]" />
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl border-white/10 bg-transparent pl-11 pr-11 text-white placeholder:text-white/35 focus-visible:ring-[oklch(0.65_0.22_285)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                >
                  {showPw ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="group relative h-12 w-full overflow-hidden rounded-xl bg-gradient-to-r from-[oklch(0.55_0.22_280)] to-[oklch(0.62_0.22_290)] text-base font-semibold text-white shadow-[0_10px_40px_-10px_oklch(0.55_0.22_280)] hover:opacity-95"
            >
              <span className="inline-flex items-center gap-2">
                {busy ? "Signing in…" : "Sign In"}
                {!busy && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />}
              </span>
            </Button>

            <div className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-white/10" />
              <div className="inline-flex items-center gap-1.5 text-xs text-white/55">
                <Shield className="h-3.5 w-3.5" />
                Secure &amp; Private
              </div>
              <div className="h-px flex-1 bg-white/10" />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
