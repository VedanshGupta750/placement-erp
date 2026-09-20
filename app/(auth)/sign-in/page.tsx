"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Mail, Lock, ShieldUser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { IconInput } from "@/components/auth/icon-input";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { poppins } from "@/lib/fonts";

export default function SignInPage() {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      email: formData.get("email"),
      password: formData.get("password"),
      rememberMe,
    };

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.message ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setFormError("Could not reach the server. Please try again.");
      setPending(false);
    }
  }

  return (
    <Card className="border-border/60 rounded-2xl py-8 shadow-xl sm:py-10">
      <CardContent className="flex flex-col items-center gap-1.5 px-5 text-center sm:px-10">
        <span className="bg-primary mb-4 flex size-16 shrink-0 items-center justify-center rounded-full">
          <ShieldUser className="size-8 text-white" />
        </span>
        <h1 className={`${poppins.className} text-3xl font-bold tracking-tight`}>Welcome back</h1>
        <p className="text-muted-foreground text-lg">Sign in to your placement account</p>

        <InstallAppButton className="mt-5" />

        <form method="post" action="/api/auth/login" onSubmit={handleSubmit} className="mt-8 flex w-full flex-col gap-5 text-left">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-base font-medium">
              Email address
            </Label>
            <IconInput
              icon={Mail}
              id="email"
              name="email"
              type="email"
              placeholder="you@college.edu"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="h-14 rounded-xl"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-base font-medium">
                Password
              </Label>
              <Link href="/forgot-password" className="text-primary text-sm font-medium hover:underline">
                Forgot password?
              </Link>
            </div>
            <IconInput
              icon={Lock}
              id="password"
              name="password"
              type="password"
              placeholder="Enter password"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-14 rounded-xl"
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={rememberMe} onCheckedChange={(v) => setRememberMe(Boolean(v))} />
            <input type="hidden" name="rememberMe" value={rememberMe ? "true" : "false"} />
            Remember me for 30 days
          </label>

          {formError && (
            <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{formError}</p>
          )}

          <Button type="submit" size="lg" className="h-12 rounded-xl text-base" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
            {!pending && <ArrowRight className="size-4" />}
          </Button>
        </form>

      </CardContent>
    </Card>
  );
}
