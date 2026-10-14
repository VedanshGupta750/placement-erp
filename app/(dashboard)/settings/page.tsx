import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CollegeDetailsForm } from "@/components/people/college-details-form";
import { BatchSettingsTable } from "@/components/people/batch-settings-table";
import { EligibilityPolicyForm } from "@/components/settings/eligibility-policy-form";
import { PlacementCapForm } from "@/components/settings/placement-cap-form";

export default async function SettingsPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // No gate at all before — see app/(dashboard)/roles/page.tsx for the full
  // writeup of this finding across 6 sibling pages.
  const canView = await hasPermission(session, "settings.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to college settings.</CardContent>
      </Card>
    );
  }

  const [college, batches, memberships, courses] = await Promise.all([
    prisma.college.findUniqueOrThrow({ where: { id: session.collegeId } }),
    db.batch.findMany({ orderBy: { year: "desc" } }),
    db.department.findMany({ include: { memberships: { include: { user: true } } } }),
    db.course.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">College settings</h1>
        <p className="text-muted-foreground text-sm">College profile, eligibility policy, batch policies and the placement team.</p>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">College Details</TabsTrigger>
          <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
          <TabsTrigger value="caps">Placement caps</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Basic details</CardTitle></CardHeader>
            <CardContent>
              <CollegeDetailsForm college={college} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eligibility" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Placement eligibility</CardTitle></CardHeader>
            <CardContent>
              <EligibilityPolicyForm
                initial={{
                  eligibilityPolicyEnabled: college.eligibilityPolicyEnabled,
                  eligibilityMinCgpa: college.eligibilityMinCgpa,
                  eligibilityMaxLiveBacklogs: college.eligibilityMaxLiveBacklogs,
                  eligibilityMinTenthScore: college.eligibilityMinTenthScore,
                  eligibilityMinTwelfthScore: college.eligibilityMinTwelfthScore,
                  eligibilityRequireAcademics: college.eligibilityRequireAcademics,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="caps" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Placement caps</CardTitle></CardHeader>
            <CardContent>
              <PlacementCapForm
                initial={{
                  placementCapEnabled: college.placementCapEnabled,
                  placementCapMode: college.placementCapMode,
                  placementCapFloor: college.placementCapFloor?.toString() ?? null,
                  placementCapMultiplier: college.placementCapMultiplier,
                  placementCapIncrement: college.placementCapIncrement?.toString() ?? null,
                  placementCapCrossEnabled: college.placementCapCrossEnabled,
                  placementCapCrossFloor: college.placementCapCrossFloor?.toString() ?? null,
                  placementCapCrossMultiplier: college.placementCapCrossMultiplier,
                  placementCapCrossIncrement: college.placementCapCrossIncrement?.toString() ?? null,
                }}
                courses={courses.map((c: { id: string; name: string; specialization: string | null; isTechnical: boolean }) => ({
                  id: c.id,
                  label: c.specialization ?? c.name,
                  isTechnical: c.isTechnical,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batches" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Batch policies</CardTitle></CardHeader>
            <CardContent>
              <BatchSettingsTable batches={batches} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          {memberships.map((dept) => (
            <Card key={dept.id} className="mb-4">
              <CardHeader><CardTitle className="text-base">{dept.name} team</CardTitle></CardHeader>
              <CardContent className="flex flex-col divide-y">
                {dept.memberships.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <div className="font-medium">{m.user.name}</div>
                      <div className="text-muted-foreground text-xs">{m.designation}</div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{m.title}</Badge>
                      {m.isAdmin && <Badge className="border-none bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400">Admin</Badge>}
                    </div>
                  </div>
                ))}
                {dept.memberships.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">No team members yet.</p>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
