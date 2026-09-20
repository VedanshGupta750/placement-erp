"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

// The certificate page is a server component, so the one bit of real
// interactivity (window.print()) lives in this tiny client island. Hidden
// entirely when printed via the @media print rule in the page itself.
export function PrintCertificateButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" /> Print certificate
    </Button>
  );
}
