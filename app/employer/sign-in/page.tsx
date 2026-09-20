"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Mail, Lock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { IconInput } from "@/components/auth/icon-input";
import { poppins } from "@/lib/fonts";

export default function EmployerSignInPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/employer/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(data.message ?? "Something went wrong.");
      return;
    }
    window.location.href = "/employer/dashboard";
  }

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md py-10 shadow-xl">
        <CardContent className="flex flex-col items-center gap-1.5 px-8 text-center">
          <span className="bg-primary mb-4 flex size-16 shrink-0 items-center justify-center rounded-full">
            <Building2 className="size-8 text-white" />
          </span>
          <h1 className={`${poppins.className} text-2xl font-bold tracking-tight`}>Recruiter sign in</h1>
          <p className="text-muted-foreground">Review candidates and manage your drives</p>

          <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-4 text-left">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Work email</Label>
              <IconInput icon={Mail} id="email" name="email" type="email" placeholder="you@company.com" autoComplete="username" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-primary text-sm font-medium hover:underline">
                  Forgot password?
                </Link>
              </div>
              <IconInput icon={Lock} id="password" name="password" type="password" placeholder="Password" autoComplete="current-password" required />
            </div>
            {error && <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{error}</p>}
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
              {!pending && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="text-muted-foreground mt-6 text-sm">
            Placement cell staff?{" "}
            <Link href="/sign-in" className="text-primary font-medium hover:underline">
              Sign in here
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
