import { requireCompanySession } from "@/lib/auth/company-session";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordDialog } from "@/components/employer/change-password-dialog";

export default async function EmployerSettingsPage() {
  const session = await requireCompanySession();
  const user = await prisma.companyUser.findUniqueOrThrow({
    where: { id: session.companyUserId },
    include: { company: true },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>
        <p className="text-muted-foreground text-sm">Your recruiter portal account.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{user.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Company</span>
            <span className="font-medium">{user.company.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Role</span>
            {user.isOwner ? <Badge variant="outline">Owner</Badge> : <span className="font-medium">Recruiter</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Security</CardTitle></CardHeader>
        <CardContent>
          <ChangePasswordDialog />
        </CardContent>
      </Card>
    </div>
  );
}
