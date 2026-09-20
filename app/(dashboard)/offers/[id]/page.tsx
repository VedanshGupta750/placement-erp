import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OfferManageActions } from "@/components/offers/offer-manage-actions";
import { OfferTimeline } from "@/components/offers/offer-timeline";
import { OfferLetterPanel } from "@/components/offers/offer-letter-panel";
import { OfferActions } from "@/components/offers/offer-actions";

export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const canView = await hasPermission(session, "offer.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to this offer.</CardContent>
      </Card>
    );
  }

  // offer.view is a permission every Student also holds (for their own
  // offers) — same shared-permission-without-ownership-check pattern
  // already fixed in Students/Drives-staff/Applications this session, so
  // this check is included from the start here instead of found later.
  const caller = await db.user.findUnique({ where: { id: session.userId }, select: { userType: true } });
  let isSelfServiceStudent = false;
  if (caller?.userType === "STUDENT") {
    isSelfServiceStudent = true;
    const ownStudent = await db.student.findUnique({ where: { userId: session.userId }, select: { id: true } });
    const owns = ownStudent ? await db.offer.findFirst({ where: { id, studentId: ownStudent.id }, select: { id: true } }) : null;
    if (!owns) {
      return (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to this offer.</CardContent>
        </Card>
      );
    }
  }

  const offer = await db.offer.findUnique({
    where: { id },
    include: {
      student: { include: { user: true, course: true, department: true } },
      drive: { include: { company: true } },
      position: true,
      application: { select: { id: true } },
      offerLetterFile: { select: { originalName: true, dataUrl: true } },
      joiningRecord: true,
    },
  });
  if (!offer) notFound();

  const canManage = !isSelfServiceStudent && (await hasPermission(session, "offer.edit"));
  const canUploadLetter = !isSelfServiceStudent && (await hasPermission(session, "offer.edit"));

  const timelineEntries = [
    { label: "Offer created", at: offer.createdAt.toISOString() },
    ...(offer.issuedAt ? [{ label: "Issued to student", at: offer.issuedAt.toISOString() }] : []),
    ...(offer.acceptedAt ? [{ label: "Accepted by student", at: offer.acceptedAt.toISOString() }] : []),
    ...(offer.declinedAt ? [{ label: "Declined by student", at: offer.declinedAt.toISOString() }] : []),
    ...(offer.withdrawnAt ? [{ label: "Withdrawn by college", at: offer.withdrawnAt.toISOString() }] : []),
    ...(offer.joiningRecord?.verifiedAt
      ? [{ label: offer.joiningRecord.joiningStatus === "JOINED" ? "Marked joined" : "Marked did not join", at: offer.joiningRecord.verifiedAt.toISOString() }]
      : []),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="flex flex-col gap-6">
      <Link href="/offers" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft className="size-3.5" /> Back to offers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{offer.student.user.name}</h1>
            <StatusBadge status={offer.status} />
          </div>
          <p className="text-muted-foreground text-sm">
            {offer.position?.title ?? offer.drive.title} · {offer.drive.company.name}
          </p>
          <p className="text-muted-foreground font-mono text-xs">OFR-{offer.id.slice(-8).toUpperCase()}</p>
        </div>
        {canManage ? (
          <OfferManageActions offerId={offer.id} driveId={offer.driveId} status={offer.status} canManage={canManage} />
        ) : (
          isSelfServiceStudent && offer.status === "ISSUED" && <OfferActions id={offer.id} />
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Compensation</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Total compensation</div>
                  <div className="text-xl font-bold tabular-nums">₹{(Number(offer.totalCompensation) / 100000).toFixed(1)}L</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Offer type</div>
                  <div className="font-medium">{offer.offerType === "PPO" ? "PPO" : offer.offerType === "INTERNSHIP" ? "Internship" : "Job"}</div>
                </div>
                {offer.fixedCompensation !== null && (
                  <div><div className="text-muted-foreground text-xs">Fixed</div><div className="font-medium tabular-nums">₹{(Number(offer.fixedCompensation) / 100000).toFixed(1)}L</div></div>
                )}
                {offer.variableCompensation !== null && (
                  <div><div className="text-muted-foreground text-xs">Variable</div><div className="font-medium tabular-nums">₹{(Number(offer.variableCompensation) / 100000).toFixed(1)}L</div></div>
                )}
                {offer.stipend !== null && (
                  <div><div className="text-muted-foreground text-xs">Stipend</div><div className="font-medium tabular-nums">₹{Number(offer.stipend).toLocaleString("en-IN")}/mo</div></div>
                )}
                {offer.joiningBonus !== null && (
                  <div><div className="text-muted-foreground text-xs">Joining bonus</div><div className="font-medium tabular-nums">₹{Number(offer.joiningBonus).toLocaleString("en-IN")}</div></div>
                )}
                {offer.durationMonths !== null && (
                  <div><div className="text-muted-foreground text-xs">Duration</div><div className="font-medium">{offer.durationMonths} months</div></div>
                )}
                <div><div className="text-muted-foreground text-xs">Offer date</div><div className="font-medium">{offer.offerDate ? new Date(offer.offerDate).toLocaleDateString("en-IN") : "-"}</div></div>
                <div><div className="text-muted-foreground text-xs">Joining date</div><div className="font-medium">{offer.joiningDate ? new Date(offer.joiningDate).toLocaleDateString("en-IN") : "-"}</div></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Student &amp; drive</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <div><span className="text-muted-foreground">Enrollment: </span>{offer.student.enrollmentNumber}</div>
                <div><span className="text-muted-foreground">Course: </span>{offer.student.course.specialization ?? offer.student.course.name}</div>
                <div><span className="text-muted-foreground">Department: </span>{offer.student.department?.name ?? "-"}</div>
                <Link href={`/drives/${offer.driveId}`} className="text-primary hover:underline">View drive →</Link>
                <Link href={`/students/${offer.studentId}`} className="text-primary hover:underline">View student profile →</Link>
                {offer.application && <Link href={`/applications/${offer.application.id}`} className="text-primary hover:underline">View application →</Link>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <OfferTimeline entries={timelineEntries} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <OfferLetterPanel
            offerId={offer.id}
            file={offer.offerLetterFile}
            canUpload={canUploadLetter}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
