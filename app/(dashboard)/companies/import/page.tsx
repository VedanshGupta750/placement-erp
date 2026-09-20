import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportCompaniesForm } from "@/components/companies/import-companies-form";

export default function CompaniesImportPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/companies" />}>
        <ArrowLeft className="size-3.5" /> Back to companies
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import companies</h1>
        <p className="text-muted-foreground text-sm">Upload a CSV to add partner companies in bulk. A row whose name matches an existing company just adds your college&apos;s partnership to it.</p>
      </div>
      <ImportCompaniesForm />
    </div>
  );
}
