"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DEFAULT_ROLE_BY_TYPE: Record<string, string> = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  MANAGEMENT: "Management",
  PLACEMENT_TEAM: "Placement Coordinator",
};

export function InviteForm({ roles }: { roles: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [userType, setUserType] = useState("STUDENT");
  // Account type and role are separate things: the type decides which part of
  // the app someone lands in, the role decides what they may do there. Only
  // four of the eight roles were reachable before this, because the role was
  // always derived from the type.
  const [roleId, setRoleId] = useState<string>(
    () => roles.find((r) => r.name === DEFAULT_ROLE_BY_TYPE.STUDENT)?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const res = await fetch("/api/people/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fd.get("name"), email, userType, roleId: roleId || undefined }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(data.message ?? "Couldn't send invite.");
      return;
    }
    setResult({ email, tempPassword: data.tempPassword });
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite a new member</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-[11rem_14rem_9rem_11rem_auto]">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required className="w-full" />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required className="w-full" />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label>Type</Label>
            <Select
              value={userType}
              onValueChange={(v) => {
                if (!v) return;
                setUserType(v);
                // Move the role to this type's default; the user can still
                // override it with the Role select beside this one.
                const preferred = roles.find((r) => r.name === DEFAULT_ROLE_BY_TYPE[v]);
                if (preferred) setRoleId(preferred.id);
              }}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STUDENT">Student</SelectItem>
                <SelectItem value="FACULTY">Faculty</SelectItem>
                <SelectItem value="MANAGEMENT">Management</SelectItem>
                <SelectItem value="PLACEMENT_TEAM">Placement Team</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label>Role</Label>
            <Select value={roleId} onValueChange={(v) => v && setRoleId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a role">
                  {(v: string) => roles.find((r) => r.id === v)?.name ?? "Select a role"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full sm:w-fit" disabled={pending}>{pending ? "Inviting…" : "Send invite"}</Button>
        </form>

        {userType === "STUDENT" && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Inviting someone as a Student creates a login but <b>no student record</b> &mdash; no enrolment number,
            course or batch, so they can&apos;t be made eligible for any drive. Use <b>Students &rarr; Add student</b>
            {" "}or the CSV import instead.
          </p>
        )}

        {error && <p className="bg-destructive/10 text-destructive mt-3 rounded-md px-3 py-2 text-sm">{error}</p>}
        {result && (
          <div className="mt-3 rounded-md border p-3 text-sm">
            <p className="font-medium">Invite created for {result.email}</p>
            <p className="text-muted-foreground break-words">
              Temporary password: <code className="bg-muted rounded px-1.5 py-0.5">{result.tempPassword}</code> — share this with them manually (no email provider configured yet).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
