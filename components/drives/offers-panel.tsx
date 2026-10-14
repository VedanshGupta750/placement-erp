"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EditOfferDialog, type EditableOffer } from "@/components/offers/edit-offer-dialog";
import { toast } from "sonner";

type SelectedApplicant = { id: string; student: { user: { name: string } } };
// Extends the editable shape rather than redeclaring the money fields, so
// the panel and the dialog can't drift apart on what an offer carries.
type Offer = EditableOffer & { student: { user: { name: string } } };

export function OffersPanel({
  driveId,
  offers,
  selectedWithoutOffer,
  canEditOffer = false,
}: {
  driveId: string;
  offers: Offer[];
  selectedWithoutOffer: SelectedApplicant[];
  canEditOffer?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function createOffer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      applicationId: fd.get("applicationId"),
      offerType: fd.get("offerType"),
      totalCompensation: fd.get("totalCompensation"),
    };
    const res = await fetch(`/api/drives/${driveId}/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Offer created as draft");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } else {
      toast.error("Couldn't create offer.");
    }
  }

  async function issue(offerId: string) {
    setPending(true);
    const res = await fetch(`/api/drives/${driveId}/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "issue" }),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Offer issued to student");
      router.refresh();
    } else {
      toast.error("Couldn't issue offer.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {selectedWithoutOffer.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create an offer</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createOffer} className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Selected student</Label>
                <Select name="applicationId">
                  <SelectTrigger className="w-56"><SelectValue placeholder="Choose student" /></SelectTrigger>
                  <SelectContent>
                    {selectedWithoutOffer.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.student.user.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Offer type</Label>
                <Select name="offerType" defaultValue="JOB">
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="JOB">Job</SelectItem>
                    <SelectItem value="INTERNSHIP">Internship</SelectItem>
                    <SelectItem value="PPO">PPO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="totalCompensation">Total compensation (₹)</Label>
                <Input id="totalCompensation" name="totalCompensation" type="number" min={0} required className="w-40" />
              </div>
              <Button type="submit" disabled={pending}>Create offer</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Offers ({offers.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {offers.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <div className="font-medium">{o.student.user.name}</div>
                <div className="text-muted-foreground text-xs">
                  ₹{(Number(o.totalCompensation) / 100000).toFixed(1)}L · {o.offerType.replace("_", " ").toLowerCase()}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <StatusBadge status={o.status} />
                {/* Draft only — the server refuses an edit once the student
                    has been shown the figures, so the button matches. */}
                {canEditOffer && o.status === "DRAFT" && (
                  <EditOfferDialog offer={o} studentName={o.student.user.name} />
                )}
                {o.status === "DRAFT" && (
                  <Button size="sm" disabled={pending} onClick={() => issue(o.id)}>Issue to student</Button>
                )}
              </div>
            </div>
          ))}
          {offers.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No offers yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
