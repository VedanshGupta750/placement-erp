"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FirstPasswordForm({ name, isStudent }: { name: string; isStudent: boolean }) {
  const router = useRouter();
  const [semesters, setSemesters] = useState<{ semester: string; sgpa: string }[]>([{ semester: "1", sgpa: "" }]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (password !== String(fd.get("confirm") ?? "")) {
      setError("The two passwords don't match.");
      return;
    }

    setPending(true);
    setError(null);
    const num = (key: string) => {
      const raw = String(fd.get(key) ?? "").trim();
      return raw === "" ? undefined : Number(raw);
    };
    const res = await fetch("/api/profile/first-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password,
        ...(isStudent
          ? {
              tenthScore: num("tenthScore"),
              twelfthScore: num("twelfthScore"),
              aggregate: num("aggregate"),
              semesterResults: semesters
                .filter((r) => r.semester.trim() !== "" && r.sgpa.trim() !== "")
                .map((r) => ({ semester: Number(r.semester), sgpa: Number(r.sgpa) })),
            }
          : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      const fieldMessage = data.fieldErrors
        ? Object.values(data.fieldErrors as Record<string, string[]>).flat()[0]
        : undefined;
      setError(data.message ?? fieldMessage ?? "Couldn't set your password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="bg-card my-auto flex w-full max-w-md flex-col gap-5 rounded-xl border p-6 shadow-sm"
      >
        <div className="flex flex-col gap-1.5">
          <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
            <ShieldCheck className="size-5" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Choose your password</h1>
          <p className="text-muted-foreground text-sm">
            Welcome, {name}. You&apos;re signed in with the password your placement cell set. Pick your own to
            continue.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" required autoComplete="new-password" minLength={8} />
          <p className="text-muted-foreground text-xs">At least 8 characters, including a letter and a number.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" name="confirm" type="password" required autoComplete="new-password" minLength={8} />
        </div>

        {isStudent && (
          <div className="flex flex-col gap-3 border-t pt-4">
            <div>
              <h2 className="text-sm font-medium">Your academic details</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Fill in only what applies to you, and only figures you can support with a marksheet. Your placement
                cell verifies these, and drive eligibility is decided from them. You can enter this <strong>once</strong>
                {" "}— after this, corrections go through a request your placement cell approves.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="tenthScore" className="text-xs">10th %</Label>
                <Input id="tenthScore" name="tenthScore" type="number" step="0.01" min={0} max={100} placeholder="—" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="twelfthScore" className="text-xs">12th %</Label>
                <Input id="twelfthScore" name="twelfthScore" type="number" step="0.01" min={0} max={100} placeholder="—" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="aggregate" className="text-xs">Overall CGPA</Label>
                <Input id="aggregate" name="aggregate" type="number" step="0.01" min={0} max={10} placeholder="—" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs">Semester-wise SGPA</Label>
              {semesters.map((row, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={row.semester}
                    onChange={(e) =>
                      setSemesters((p) => p.map((r, j) => (j === i ? { ...r, semester: e.target.value } : r)))
                    }
                    className="w-16 shrink-0 sm:w-20"
                    aria-label={`Semester number for row ${i + 1}`}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={10}
                    value={row.sgpa}
                    onChange={(e) => setSemesters((p) => p.map((r, j) => (j === i ? { ...r, sgpa: e.target.value } : r)))}
                    placeholder="SGPA"
                    className="min-w-0 flex-1"
                    aria-label={`SGPA for row ${i + 1}`}
                  />
                  {semesters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSemesters((p) => p.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-foreground text-xs"
                      aria-label={`Remove row ${i + 1}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {semesters.length < 12 && (
                <button
                  type="button"
                  onClick={() =>
                    setSemesters((p) => [...p, { semester: String(p.length + 1), sgpa: "" }])
                  }
                  className="text-primary w-fit text-xs hover:underline"
                >
                  + Add a semester
                </button>
              )}
              <p className="text-muted-foreground text-xs">Leave blank if a semester result isn&apos;t out yet.</p>
            </div>
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Set password and continue"}
        </Button>
      </form>
    </div>
  );
}
