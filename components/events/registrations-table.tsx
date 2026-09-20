"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type RegistrationRow = {
  id: string;
  studentName: string;
  branch: string;
  year: number | null;
  status: "PENDING" | "CONFIRMED" | "WAITLISTED" | "REJECTED" | "CANCELLED";
  registeredAt: string;
};

const STATUS_VARIANT: Record<RegistrationRow["status"], "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  CONFIRMED: "default",
  WAITLISTED: "secondary",
  REJECTED: "destructive",
  CANCELLED: "outline",
};

export function RegistrationsTable({ eventId, rows, canManage }: { eventId: string; rows: RegistrationRow[]; canManage: boolean }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function updateStatus(registrationId: string, status: "CONFIRMED" | "REJECTED" | "WAITLISTED") {
    setPendingId(registrationId);
    const res = await fetch(`/api/events/${eventId}/registrations/${registrationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setPendingId(null);
    if (res.ok) {
      toast.success("Registration updated.");
      router.refresh();
    } else {
      toast.error("Failed to update registration.");
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" render={<a href={`/api/events/${eventId}/registrations/export`} />}>
            <Download className="size-3.5" /> Export CSV
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.studentName}</TableCell>
                <TableCell className="text-sm">{r.branch}</TableCell>
                <TableCell className="text-sm">{r.year ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {new Date(r.registeredAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={pendingId === r.id || r.status === "CONFIRMED"}
                        onClick={() => updateStatus(r.id, "CONFIRMED")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={pendingId === r.id || r.status === "WAITLISTED"}
                        onClick={() => updateStatus(r.id, "WAITLISTED")}
                      >
                        Waitlist
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive h-7 px-2 text-xs"
                        disabled={pendingId === r.id || r.status === "REJECTED"}
                        onClick={() => updateStatus(r.id, "REJECTED")}
                      >
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="text-muted-foreground py-10 text-center text-sm">
                  No registrations yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
