import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Mock Audit Manager" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [storeCode, setStoreCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const email = `${storeCode.trim().toLowerCase()}@mockaudit.app`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/conduct" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[oklch(0.22_0.06_255)] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground">Adidas Kids</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Mock Audit Manager</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="storeCode">Store Code</Label>
            <Input id="storeCode" autoCapitalize="characters" autoComplete="username"
              value={storeCode} onChange={(e) => setStoreCode(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
