import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportDrivesForm } from "@/components/drives/import-drives-form";

export default function DrivesImportPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/drives" />}>
        <ArrowLeft className="size-3.5" /> Back to drives
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import drives</h1>
        <p className="text-muted-foreground text-sm">Upload a CSV to add placement drives in bulk, as drafts you can review and publish.</p>
      </div>
      <ImportDrivesForm />
    </div>
  );
}
