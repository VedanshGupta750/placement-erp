import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportForm } from "@/components/students/import-form";

export default function StudentImportPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/students" />}>
        <ArrowLeft className="size-3.5" /> Back to students
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import students</h1>
        <p className="text-muted-foreground text-sm">Upload a CSV to add students in bulk. Courses and batch years must already exist.</p>
      </div>
      <ImportForm />
    </div>
  );
}
