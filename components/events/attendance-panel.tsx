"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Minimal CSV parser for a two-column "Email,Present" file — no quoted
// commas/embedded newlines support, which is fine for this use case (a
// TPO exporting a simple attendance sheet, not arbitrary CSV input).
function parseAttendanceCsv(text: string): { email: string; present: boolean }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const [, ...dataLines] = lines; // skip header row
  return dataLines.map((line) => {
    const [email = "", presentRaw = ""] = line.split(",");
    const present = /^(yes|true|1|present)$/i.test(presentRaw.trim());
    return { email: email.trim(), present };
  });
}

export type AttendanceRow = {
  userId: string;
  studentName: string;
  branch: string;
  present: boolean;
  checkInAt: string | null;
};

export function AttendancePanel({ eventId, rows, canMark }: { eventId: string; rows: AttendanceRow[]; canMark: boolean }) {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const text = await file.text();
    const parsed = parseAttendanceCsv(text);
    if (parsed.length === 0) {
      toast.error("No rows found — expected a header row followed by Email,Present.");
      return;
    }

    setImporting(true);
    const res = await fetch(`/api/events/${eventId}/attendance/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: parsed }),
    });
    const data = await res.json().catch(() => ({}));
    setImporting(false);

    if (!res.ok) {
      toast.error(data.message ?? "Import failed.");
      return;
    }
    if (data.errors?.length > 0) {
      toast.warning(`Imported ${data.successRows}, ${data.errors.length} row(s) skipped (not registered).`);
    } else {
      toast.success(`Imported attendance for ${data.successRows} student(s).`);
    }
    router.refresh();
  }

  async function generateQr() {
    setQrLoading(true);
    const res = await fetch(`/api/events/${eventId}/attendance/qr`);
    setQrLoading(false);
    if (res.ok) {
      const data = await res.json();
      setQrDataUrl(data.dataUrl);
    } else {
      toast.error("Failed to generate QR code.");
    }
  }

  async function markAttendance(userId: string, present: boolean) {
    setPendingUserId(userId);
    const res = await fetch(`/api/events/${eventId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, present }),
    });
    setPendingUserId(null);
    if (res.ok) {
      toast.success(present ? "Marked present." : "Marked absent.");
      router.refresh();
    } else {
      toast.error("Failed to update attendance.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canMark && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 pt-6">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Attendance check-in QR code" className="size-48" />
            ) : (
              <Button variant="outline" size="sm" onClick={generateQr} disabled={qrLoading}>
                <QrCode className="size-3.5" /> {qrLoading ? "Generating…" : "Generate QR"}
              </Button>
            )}
            <p className="text-muted-foreground text-xs">Scan to Mark Attendance</p>

            <div className="mt-2 flex flex-col items-center gap-1.5 border-t pt-3">
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
              <Button variant="outline" size="sm" disabled={importing} onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-3.5" /> {importing ? "Importing…" : "Import CSV"}
              </Button>
              <p className="text-muted-foreground text-xs">Columns: Email, Present (Yes/No) — only already-registered students are matched.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                {canMark && <TableHead className="text-right">Mark</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="font-medium">{r.studentName}</TableCell>
                  <TableCell className="text-sm">{r.branch}</TableCell>
                  <TableCell>
                    <Badge variant={r.present ? "default" : "outline"}>{r.present ? "Present" : "Absent"}</Badge>
                  </TableCell>
                  {canMark && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={pendingUserId === r.userId || r.present}
                          onClick={() => markAttendance(r.userId, true)}
                        >
                          Present
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={pendingUserId === r.userId || !r.present}
                          onClick={() => markAttendance(r.userId, false)}
                        >
                          Absent
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canMark ? 4 : 3} className="text-muted-foreground py-10 text-center text-sm">
                    No confirmed registrants yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
