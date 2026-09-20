"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Type-to-confirm gate for destructive actions. A browser confirm() is one
// reflexive click away from wiping a record; typing the word forces the
// person to read what they are about to delete. Reusable so every
// hard-delete in the app can share the same wording and behaviour.
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  itemName,
  itemKind = "record",
  consequences,
  confirmWord = "DELETE",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemKind?: string;
  consequences?: string;
  confirmWord?: string;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);

  const matches = typed.trim().toUpperCase() === confirmWord.toUpperCase();

  function handleOpenChange(next: boolean) {
    // Clearing on close means reopening never starts pre-armed.
    if (!next) setTyped("");
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!matches || pending) return;
    setPending(true);
    try {
      await onConfirm();
      setTyped("");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="bg-destructive/10 text-destructive flex size-8 shrink-0 items-center justify-center rounded-lg">
              <AlertTriangle className="size-4" />
            </span>
            Delete {itemKind}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-sm">
            You are about to permanently delete <span className="font-semibold">{itemName}</span>.
          </p>
          <p className="text-muted-foreground text-sm">
            {consequences ?? "This can't be undone."}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-delete-input">
              Type <span className="text-foreground font-semibold">{confirmWord}</span> to confirm
            </Label>
            <Input
              id="confirm-delete-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmWord}
              autoComplete="off"
              autoCapitalize="characters"
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches) {
                  e.preventDefault();
                  void handleConfirm();
                }
              }}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="sm" disabled={!matches || pending} onClick={handleConfirm}>
              {pending ? "Deleting…" : `Delete ${itemKind}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
