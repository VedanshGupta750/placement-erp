import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { FirstPasswordForm } from "@/components/auth/first-password-form";

export const metadata = {
  title: "Choose your password",
  robots: { index: false, follow: false },
};

// Deliberately OUTSIDE the (dashboard) group: that layout is what redirects
// here, so rendering this inside it would loop. Nothing of the app is
// reachable until the starter password is replaced.
export default async function FirstPasswordPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { name: true, mustChangePassword: true, userType: true },
  });

  if (!user.mustChangePassword) redirect("/dashboard");

  return <FirstPasswordForm name={user.name} isStudent={user.userType === "STUDENT"} />;
}
