"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Field = { id: string; label: string; fieldType: string; required: boolean };

const TYPE_LABELS: Record<string, string> = { TEXT: "Text", NUMBER: "Number", DATE: "Date", SELECT: "Select" };

export function ApplicationFieldsPanel({ driveId, fields, canEdit }: { driveId: string; fields: Field[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState("TEXT");
  const [required, setRequired] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!label.trim()) return;
    setPending(true);
    const res = await fetch(`/api/drives/${driveId}/application-fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, fieldType, required }),
    });
    setPending(false);
    if (res.ok) {
      setLabel("");
      setFieldType("TEXT");
      setRequired(false);
      router.refresh();
    } else {
      toast.error("Couldn't add field.");
    }
  }

  async function handleDelete(fieldId: string) {
    const res = await fetch(`/api/drives/${driveId}/application-fields/${fieldId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">Extra fields collected from students when they apply — also shown alongside each applicant.</p>
      <div className="flex flex-col gap-2">
        {fields.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <div>
              <span className="font-medium">{f.label}</span>
              <span className="text-muted-foreground ml-2 text-xs">{TYPE_LABELS[f.fieldType] ?? f.fieldType}{f.required ? " · Required" : ""}</span>
            </div>
            {canEdit && (
              <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)} aria-label="Remove field">
                <Trash2 className="text-muted-foreground size-3.5" />
              </Button>
            )}
          </div>
        ))}
        {fields.length === 0 && <p className="text-muted-foreground text-sm">No extra application fields defined.</p>}
      </div>

      {canEdit && (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-t pt-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="field-label">Field label</Label>
            <Input id="field-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Contact Number" className="w-56" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select value={fieldType} onValueChange={(v) => v && setFieldType(v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([value, l]) => (
                  <SelectItem key={value} value={value}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Checkbox id="field-required" checked={required} onCheckedChange={(v) => setRequired(v === true)} />
            <Label htmlFor="field-required" className="text-sm font-normal">Required</Label>
          </div>
          <Button type="submit" size="sm" disabled={pending || !label.trim()}>{pending ? "Adding…" : "+ Add field"}</Button>
        </form>
      )}
    </div>
  );
}
