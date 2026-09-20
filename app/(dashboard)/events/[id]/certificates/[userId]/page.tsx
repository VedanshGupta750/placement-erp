import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Award } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { PrintCertificateButton } from "@/components/events/print-certificate-button";

export default async function EventCertificatePage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  const { id: eventId, userId } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const isOwnCertificate = session.userId === userId;
  const canManage = await hasPermission(session, "event.manage_registrations");
  if (!isOwnCertificate && !canManage) redirect("/dashboard");

  const certificate = await db.eventCertificate.findUnique({
    where: { eventId_userId: { eventId, userId } },
    include: {
      user: { select: { name: true } },
      event: { select: { title: true, startAt: true, endAt: true, college: { select: { name: true } } } },
    },
  });
  if (!certificate) notFound();

  const eventDate = certificate.event.startAt
    ? certificate.event.startAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="flex flex-col items-center gap-6">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0; }
          body { background: white !important; }
        }
      `}</style>

      <div className="flex w-full max-w-3xl items-center justify-between print:hidden">
        <Link
          href={`/events/${eventId}`}
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-3.5" /> Back to event
        </Link>
        <PrintCertificateButton />
      </div>

      <div className="border-primary/30 relative flex w-full max-w-3xl flex-col items-center gap-6 rounded-2xl border-8 bg-white p-12 text-center text-slate-900 shadow-sm print:w-full print:max-w-none print:rounded-none print:border-8 print:shadow-none">
        <Award className="text-primary size-12" />
        <div className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
          {certificate.event.college.name}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Certificate of Participation</h1>

        <p className="mt-4 text-base leading-relaxed text-slate-600">
          This certifies that
        </p>
        <p className="text-2xl font-bold text-slate-900">{certificate.user.name}</p>
        <p className="max-w-xl text-base leading-relaxed text-slate-600">
          successfully participated in <span className="font-semibold text-slate-900">{certificate.event.title}</span>
          {eventDate ? <> held on {eventDate}</> : null}.
        </p>

        <div className="mt-8 flex w-full items-center justify-between border-t pt-4 text-xs text-slate-400">
          <span>
            Issued {certificate.issuedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <span className="font-mono tracking-widest">Verification code: {certificate.code}</span>
        </div>
      </div>
    </div>
  );
}
