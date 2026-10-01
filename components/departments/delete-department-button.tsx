"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

export function DeleteDepartmentButton({
  departmentId,
  name,
  studentCount,
  memberCount,
  courseCount,
}: {
  departmentId: string;
  name: string;
  studentCount: number;
  memberCount: number;
  courseCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    const res = await fetch(`/api/departments/${departmentId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      // The drives case is a refusal with a reason, not a generic failure —
      // show the server's explanation rather than flattening it.
      toast.error(data.message ?? "Couldn't delete this department.");
      setOpen(false);
      return;
    }
    toast.success(
      data.studentsUnassigned > 0
        ? `${name} deleted. ${data.studentsUnassigned} student${data.studentsUnassigned === 1 ? "" : "s"} are now unassigned.`
        : `${name} deleted.`,
    );
    setOpen(false);
    router.refresh();
  }

  // Spelled out rather than a generic warning: students survive but lose
  // their department, whereas memberships and course links are destroyed.
  const consequences = [
    studentCount > 0
      ? `${studentCount} student${studentCount === 1 ? "" : "s"} will be left without a department (their records are kept).`
      : null,
    memberCount > 0 ? `${memberCount} staff membership${memberCount === 1 ? "" : "s"} will be removed.` : null,
    courseCount > 0 ? `${courseCount} course link${courseCount === 1 ? "" : "s"} will be removed.` : null,
    "This can't be undone.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label={`Delete ${name}`}
        // The whole card is a link, so stop the click reaching it.
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Trash2 className="text-muted-foreground size-3.5" />
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        itemKind="department"
        itemName={name}
        consequences={consequences}
        onConfirm={handleDelete}
      />
    </>
  );
}
