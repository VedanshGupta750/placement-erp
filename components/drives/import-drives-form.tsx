"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Upload, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DRIVE_IMPORT_TEMPLATE_HEADERS } from "@/lib/validators/import";

type ParsedRow = Record<string, string>;
type Result = { successRows: number; errorRows: number; errors: { rowNumber: number; field?: string; message: string }[] };

function downloadTemplate() {
  const csv =
    DRIVE_IMPORT_TEMPLATE_HEADERS.join(",") +
    "\n" +
    "ML Engineer - Analyst Drive,Siemens,Computer Science,JOB,FULL_TIME,900000,1600000,14,2026-08-25\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "drive-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportDrivesForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

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
    const res = await fetch("/api/drives/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, fileName }),
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
      <CardHeader><CardTitle className="text-base">Import drives from CSV</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Each row creates a DRAFT drive with one position. Company is created or reused by name. courseNames matches your real course list as a substring — comma-separate multiple.
        </p>
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
            <Button size="sm" disabled={pending} onClick={handleImport}>{pending ? "Importing…" : "Import drives"}</Button>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="size-4" /> {result.successRows} drives imported as drafts
            </div>
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
