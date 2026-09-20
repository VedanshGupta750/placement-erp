"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export function RolePermissionEditor({
  roleId,
  roleName,
  groups,
  granted,
  editable,
}: {
  roleId: string;
  roleName: string;
  groups: { resource: string; permissions: { key: string; description: string }[] }[];
  granted: string[];
  editable: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(new Set(granted));
  const [pending, setPending] = useState(false);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    setPending(true);
    const res = await fetch(`/api/roles/${roleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionKeys: [...selected] }),
    });
    setPending(false);
    if (res.ok) {
      toast.success(`${roleName} permissions updated`);
      router.refresh();
    } else {
      toast.error("Couldn't update permissions.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!editable && <p className="text-muted-foreground text-xs">This role always has full access and can&apos;t be edited.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.resource} className="rounded-md border p-3">
            <div className="mb-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground">{g.resource}</div>
            <div className="flex flex-col gap-1.5">
              {g.permissions.map((p) => (
                <label key={p.key} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={selected.has(p.key)}
                    disabled={!editable}
                    onCheckedChange={() => toggle(p.key)}
                  />
                  <span>{p.description}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {editable && (
        <Button size="sm" className="w-fit" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save permissions"}
        </Button>
      )}
    </div>
  );
}
