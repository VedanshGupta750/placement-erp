"use client";

import { useState, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Upload, Download, CheckCircle2, AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IMPORT_TEMPLATE_HEADERS } from "@/lib/validators/import";

type ParsedRow = Record<string, string>;
type Result = {
  successRows: number;
  errorRows: number;
  errors: { rowNumber: number; field?: string; message: string }[];
  created?: { name: string; email: string; enrollmentNumber: string }[];
  invitesSent?: number;
  emailConfigured?: boolean;
  defaultPasswordHint?: string;
};

function downloadTemplate() {
  const csv = IMPORT_TEMPLATE_HEADERS.join(",") + "\n" + "2023100001,Jane Doe,jane.doe@college.edu,B.Tech. - Computer Science & Engineering,2026,8.5,0\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "student-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportForm({
  batches,
  defaultBatchId,
}: {
  batches: { id: string; year: number }[];
  defaultBatchId: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  // Applies to every row that leaves batchYear blank, so a sheet of one
  // cohort doesn't need the column repeated on all 800 lines.
  const [batchId, setBatchId] = useState(defaultBatchId);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRows(res.data),
    });
  }

  async function handleImport() {
    setPending(true);
    const res = await fetch("/api/students/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, fileName, batchId }),
    });
    const data = await res.json();
    setPending(false);
    if (res.ok) {
      setResult(data);
      setRows([]);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Import students from CSV</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Batch (graduating year)</Label>
          <Select value={batchId} onValueChange={(v) => v && setBatchId(v)}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Select a batch">
                {(v: string) => batches.find((b) => b.id === v)?.year?.toString() ?? "Select a batch"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Used for any row that leaves <code>batchYear</code> blank. A value in the CSV always wins.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="size-4" /> Download template
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            <Upload className="size-4" />
            Choose CSV file
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </label>
          {fileName && <span className="text-muted-foreground text-sm">{fileName} · {rows.length} rows</span>}
        </div>

        {rows.length > 0 && (
          <div className="flex items-center justify-between rounded-md border p-3 text-sm">
            <span>{rows.length} rows ready to import.</span>
            <Button size="sm" disabled={pending} onClick={handleImport}>{pending ? "Importing…" : "Import students"}</Button>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-3 rounded-md border p-3 text-sm">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="size-4" /> {result.successRows} students imported
            </div>

            {/* The import used to stop at the line above. A TPO then had no
                way to tell a student how to sign in, and no way to check a
                failed sign-in — which reads as "the import is broken" when
                it isn't. The starter password is the student's own
                enrollment number, so listing it here reveals nothing the
                roster doesn't already show. */}
            {result.created && result.created.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">How these students sign in</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const header = "email,starterPassword";
                      const body = result.created!.map((c) => `${c.email},${c.enrollmentNumber}`);
                      const text = [header, ...body].join("\n");
                      try {
                        await navigator.clipboard.writeText(text);
                        toast.success("Copied — paste into a sheet to circulate.");
                      } catch {
                        toast.error("Couldn't copy. Select the rows and copy manually.");
                      }
                    }}
                  >
                    <Copy className="size-3.5" /> Copy list
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  {result.emailConfigured
                    ? `${result.invitesSent ?? 0} of ${result.created.length} set-password emails were sent. Anyone who didn't get one can sign in with the password below, or use Forgot password.`
                    : "No email provider is configured, so nothing was sent — pass these on yourself. Each student must change the password on first sign-in."}
                </p>
                <div className="max-h-56 overflow-y-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr className="text-left">
                        <th className="px-2 py-1.5 font-medium">Email</th>
                        <th className="px-2 py-1.5 font-medium">Starter password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.created.map((c) => (
                        <tr key={c.email} className="border-t">
                          <td className="px-2 py-1.5">{c.email}</td>
                          <td className="px-2 py-1.5 font-mono">{c.enrollmentNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {result.errorRows > 0 && (
              <div>
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="size-4" /> {result.errorRows} rows had errors
                </div>
                <ul className="text-muted-foreground mt-1 max-h-48 list-disc overflow-y-auto pl-5">
                  {result.errors.map((e, i) => (
                    <li key={i}>Row {e.rowNumber}{e.field ? ` (${e.field})` : ""}: {e.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
