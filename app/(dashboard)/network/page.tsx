import Link from "next/link";
import { Users, GraduationCap, Presentation, UserPlus, FileText, Upload } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { NetworkFilterPanel } from "@/components/network/network-filter-panel";
import { NetworkSearchForm } from "@/components/network/network-search-form";
import { NetworkTabs } from "@/components/network/network-tabs";
import { ViewToggle } from "@/components/network/view-toggle";
import { NetworkMembersView } from "@/components/network/network-members-view";
import { GroupsTab } from "@/components/network/groups-tab";
import { TeamsTab } from "@/components/network/teams-tab";
import { AlumniTab } from "@/components/network/alumni-tab";
import { RecruitersTab } from "@/components/network/recruiters-tab";
import { PopularGroupsPanel } from "@/components/network/popular-groups-panel";
import { SuggestedConnectionsPanel } from "@/components/network/suggested-connections-panel";
import { getNetworkStats } from "@/lib/network/stats";
import { getPlacementStatusByStudentId } from "@/lib/network/placement-status";
import { getBatchCourseGroups, getDriveGroups, getDepartmentGroups } from "@/lib/network/groups";
import { getTeams } from "@/lib/network/teams";
import { getAlumni } from "@/lib/network/alumni";
import { getSuggestedConnections } from "@/lib/network/suggestions";
import type { PersonCardData } from "@/components/network/person-card";

type SearchParams = {
  q?: string;
  userType?: string;
  courseId?: string;
  batchId?: string;
  departmentId?: string;
  placementStatus?: string;
  skillId?: string;
  tab?: string;
  view?: string;
};

export default async function NetworkPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const caller = await db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { userType: true } });
  const isStaff = caller.userType !== "STUDENT";
  const canViewFullProfile = await hasPermission(session, "student.view");

  const activeTab = ["groups", "teams", "alumni", "recruiters"].includes(params.tab ?? "") ? params.tab! : "people";
  const view = params.view === "list" ? "list" : "grid";

  function hrefWith(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    const merged = { ...params, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/network?${qs}` : "/network";
  }

  const where: Record<string, unknown> = { status: "ACTIVE" };
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { email: { contains: params.q, mode: "insensitive" } },
      { studentProfile: { enrollmentNumber: { contains: params.q, mode: "insensitive" } } },
      { studentProfile: { course: { name: { contains: params.q, mode: "insensitive" } } } },
      { studentProfile: { department: { name: { contains: params.q, mode: "insensitive" } } } },
      { studentProfile: { skills: { some: { skill: { name: { contains: params.q, mode: "insensitive" } } } } } },
    ];
  }
  if (params.userType) where.userType = params.userType;
  if (params.courseId || params.batchId || params.departmentId || params.skillId) {
    where.studentProfile = {
      ...(params.courseId ? { courseId: params.courseId } : {}),
      ...(params.batchId ? { batchId: params.batchId } : {}),
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      ...(params.skillId ? { skills: { some: { skillId: params.skillId } } } : {}),
    };
  }

  const [stats, courses, batches, departments, skills, popularGroupsA, popularGroupsB] = await Promise.all([
    getNetworkStats(db),
    db.course.findMany({ orderBy: { name: "asc" } }),
    db.batch.findMany({ orderBy: { year: "desc" } }),
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.skill.findMany({ orderBy: { name: "asc" }, take: 100 }),
    getBatchCourseGroups(db, 3),
    getDriveGroups(db, 3),
  ]);
  const popularGroups = [...popularGroupsA, ...popularGroupsB].sort((a, b) => b.count - a.count).slice(0, 4);

  const suggestions = caller.userType === "STUDENT" ? await getSuggestedConnections(db, session.userId, 3) : [];

  let peopleContent = null;
  let membersCount = 0;
  if (activeTab === "people") {
    const members = await db.user.findMany({
      where,
      include: { studentProfile: { include: { course: true, batch: true, department: true, skills: { include: { skill: true } } } } },
      orderBy: { name: "asc" },
      take: 200,
    });

    const studentIds = members.filter((m) => m.studentProfile).map((m) => m.studentProfile!.id);
    const placementByStudent = await getPlacementStatusByStudentId(db, studentIds);

    let rows: PersonCardData[] = members.map((m) => ({
      id: m.id,
      name: m.name,
      userType: m.userType,
      courseLabel: m.studentProfile ? (m.studentProfile.course.specialization ?? m.studentProfile.course.name) : null,
      batchYear: m.studentProfile?.batch.year ?? null,
      departmentName: m.studentProfile?.department?.name ?? null,
      skills: m.studentProfile ? m.studentProfile.skills.map((s: { skill: { name: string } }) => s.skill.name) : [],
      placement: m.studentProfile ? placementByStudent.get(m.studentProfile.id) ?? null : null,
      studentId: m.studentProfile?.id ?? null,
      enrollmentNumber: m.studentProfile?.enrollmentNumber ?? null,
    }));

    if (params.placementStatus) {
      rows = rows.filter((r) => r.placement?.kind === params.placementStatus);
    }
    membersCount = rows.length;

    peopleContent = <NetworkMembersView members={rows} view={view} currentUserId={session.userId} canBulkSelect={isStaff} canViewFullProfile={canViewFullProfile} />;
  }

  let groupsContent = null;
  if (activeTab === "groups") {
    const [batchGroups, driveGroups, departmentGroups] = await Promise.all([
      getBatchCourseGroups(db, 12),
      getDriveGroups(db, 12),
      getDepartmentGroups(db, 12),
    ]);
    groupsContent = <GroupsTab batchGroups={batchGroups} driveGroups={driveGroups} departmentGroups={departmentGroups} />;
  }

  let teamsContent = null;
  if (activeTab === "teams") {
    const teams = await getTeams(db);
    teamsContent = <TeamsTab teams={teams} />;
  }

  let alumniContent = null;
  if (activeTab === "alumni") {
    const alumni = await getAlumni(db, {}, new Date().getFullYear());
    alumniContent = <AlumniTab alumni={alumni} />;
  }

  let recruitersContent = null;
  if (activeTab === "recruiters") {
    const contacts = await db.contact.findMany({
      where: { isActive: true },
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    recruitersContent = (
      <RecruitersTab
        recruiters={contacts.map((c: { id: string; name: string | null; designation: string | null; company: { name: string } | null; relationshipStage: string }) => ({
          id: c.id,
          name: c.name ?? "Unknown",
          designation: c.designation,
          companyName: c.company?.name ?? null,
          relationshipStage: c.relationshipStage,
        }))}
      />
    );
  }

  const exportQs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  const exportHref = exportQs ? `/api/network/export?${exportQs}` : "/api/network/export";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Network</h1>
          <p className="text-muted-foreground text-sm">Connect with students, faculty, placement teams and campus members.</p>
        </div>
        {isStaff && (
          <div className="-mx-4 max-w-[calc(100vw-2rem)] overflow-x-auto px-4 pb-1 sm:mx-0 sm:max-w-full sm:px-0">
            <div className="flex w-max gap-2">
              <Button variant="outline" render={<Link href="/students/import" />}>
                <Upload className="size-4" /> Import Members
              </Button>
              <Button variant="outline" render={<a href={exportHref} />}>
                <FileText className="size-4" /> Export
              </Button>
              <Button render={<Link href="/people" />}>
                <UserPlus className="size-4" /> Add Member
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 sm:grid-cols-4">
        <StatCard icon={Users} label="Total Members" value={stats.total} sublabel={`+${stats.newThisMonth} this month`} color="violet" />
        <StatCard icon={GraduationCap} label="Students" value={stats.students} sublabel={stats.total > 0 ? `${Math.round((stats.students / stats.total) * 100)}% of network` : undefined} color="blue" />
        <StatCard icon={Presentation} label="Faculty" value={stats.faculty} color="amber" />
        <StatCard icon={Users} label="Placement Team" value={stats.placementTeam} color="emerald" />
      </div>

      {/* The side rail only takes a third of the width from xl up. At lg the
          main column would be left with ~450-600px, which is one member card
          per row once the fluid root font has grown — the rail reads better
          stacked under the list there. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <div className="flex flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-center">
            <NetworkSearchForm defaultValue={params.q} />
            <NetworkFilterPanel
              courses={courses.map((c) => ({ id: c.id, name: c.name, specialization: c.specialization }))}
              batches={batches.map((b) => ({ id: b.id, year: b.year }))}
              departments={departments.map((d) => ({ id: d.id, name: d.name }))}
              skills={skills.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1"><NetworkTabs active={activeTab} hrefWith={hrefWith} counts={{}} /></div>
            {activeTab === "people" && <div className="self-end sm:self-auto"><ViewToggle view={view} hrefWith={hrefWith} /></div>}
          </div>

          {activeTab === "people" && (
            <>
              <p className="text-muted-foreground text-xs">{membersCount} member{membersCount === 1 ? "" : "s"}</p>
              {peopleContent}
            </>
          )}
          {activeTab === "groups" && groupsContent}
          {activeTab === "teams" && teamsContent}
          {activeTab === "alumni" && alumniContent}
          {activeTab === "recruiters" && recruitersContent}
        </div>

        <div className="flex flex-col gap-4">
          {suggestions.length > 0 && <SuggestedConnectionsPanel suggestions={suggestions} />}
          <PopularGroupsPanel groups={popularGroups} />
        </div>
      </div>
    </div>
  );
}
