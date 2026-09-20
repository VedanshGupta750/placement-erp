import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportApplicationsForm } from "@/components/applications/import-applications-form";

export default function ApplicationsImportPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/applications" />}>
        <ArrowLeft className="size-3.5" /> Back to applications
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import applications</h1>
        <p className="text-muted-foreground text-sm">Upload a CSV to add students to drives in bulk.</p>
      </div>
      <ImportApplicationsForm />
    </div>
  );
}
