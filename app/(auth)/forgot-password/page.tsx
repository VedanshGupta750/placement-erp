import Link from "next/link";
import { ArrowLeft, MailQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { poppins } from "@/lib/fonts";

// No email provider is configured for this app, so there's no self-service
// reset link to send. Password resets are admin-mediated instead: TPO staff
// can generate a new temp password from a student's profile
// (StudentHeaderActions "Reset password"), and recruiters can get one from
// their college's TPO via the company's Recruiters tab. This page exists so
// the sign-in "Forgot password?" link goes somewhere honest instead of 404ing.
export default function ForgotPasswordPage() {
  return (
    <Card className="border-border/60 py-10 shadow-xl">
      <CardContent className="flex flex-col items-center gap-1.5 px-10 text-center">
        <span className="bg-primary mb-4 flex size-16 shrink-0 items-center justify-center rounded-full">
          <MailQuestion className="size-8 text-white" />
        </span>
        <h1 className={`${poppins.className} text-3xl font-bold tracking-tight`}>Forgot your password?</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          This platform doesn&apos;t send reset emails — resets are handled by your placement cell.
        </p>

        <div className="text-muted-foreground mt-6 flex flex-col gap-3 text-left text-sm">
          <p>
            <strong className="text-foreground">Students:</strong> contact your Training &amp; Placement Officer
            (TPO). They can generate a new temporary password from your profile and share it with you directly.
          </p>
          <p>
            <strong className="text-foreground">Recruiters:</strong> contact the TPO at the college you&apos;re
            partnered with. They can reset your recruiter portal password from your company&apos;s profile.
          </p>
        </div>

        <Link href="/sign-in" className="text-primary mt-8 inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
