"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

export function DeleteContactButton({ contactId, contactName }: { contactId: string; contactName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    const res = await fetch(`/api/contacts/${contactId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Couldn't delete this contact.");
      return;
    }
    setOpen(false);
    // This button lives on the contact's own detail page, so refreshing in
    // place would re-render a record that no longer exists. Go back to the
    // list and refresh that instead.
    toast.success(`${contactName} deleted.`);
    router.push("/contacts");
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-3.5" /> Delete
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        itemKind="contact"
        itemName={contactName}
        consequences="Their notes, logged communications, documents and history are removed with them. This can't be undone."
        onConfirm={handleDelete}
      />
    </>
  );
}
