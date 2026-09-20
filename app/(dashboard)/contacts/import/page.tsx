import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportContactsForm } from "@/components/contacts/import-contacts-form";

export default function ContactsImportPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/contacts" />}>
        <ArrowLeft className="size-3.5" /> Back to contacts
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import contacts</h1>
        <p className="text-muted-foreground text-sm">Upload a CSV to add recruiter contacts in bulk. If a company name is given, it must already exist under Companies.</p>
      </div>
      <ImportContactsForm />
    </div>
  );
}
