import Link from "next/link";
import { Settings } from "lucide-react";
import { getCompanySession } from "@/lib/auth/company-session";
import { prisma } from "@/lib/db";
import { SignOutButton } from "@/components/employer/sign-out-button";
import { LogoMark } from "@/components/dashboard/logo-mark";
import { PWA_CONFIG } from "@/lib/pwa/config";

export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  const session = await getCompanySession();
  const companyUser = session
    ? await prisma.companyUser.findUnique({ where: { id: session.companyUserId }, include: { company: true } })
    : null;

  return (
    <div className="bg-muted/30 flex min-h-screen flex-col">
      <header className="bg-background flex h-14 items-center justify-between border-b px-6">
        <Link href="/employer/dashboard" className="flex items-center gap-2">
          <span className="bg-primary/10 flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md p-0.5">
            <LogoMark className="size-full" />
          </span>
          <span className="font-semibold tracking-tight">{PWA_CONFIG.name} for Recruiters</span>
        </Link>
        {companyUser && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{companyUser.company.name}</span>
            <span className="font-medium">{companyUser.name}</span>
            <Link href="/employer/settings" className="text-muted-foreground hover:text-foreground" title="Account settings">
              <Settings className="size-4" />
            </Link>
            <SignOutButton />
          </div>
        )}
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
