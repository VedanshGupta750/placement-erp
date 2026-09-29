import { MailQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { poppins } from "@/lib/fonts";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

// Self-service reset. This page used to explain that resets were manual —
// the TPO generated a temp password from a student's profile and passed it
// on by hand — because there was no email provider at all. That doesn't
// scale past a handful of users, and it made bulk import barely usable:
// imported accounts had a password nobody had ever seen.
export default function ForgotPasswordPage() {
  return (
    <Card className="border-border/60 py-10 shadow-xl">
      <CardContent className="flex flex-col gap-1.5 px-10">
        <div className="flex flex-col items-center text-center">
          <span className="bg-primary mb-4 flex size-16 shrink-0 items-center justify-center rounded-full">
            <MailQuestion className="size-8 text-white" />
          </span>
          <h1 className={`${poppins.className} text-3xl font-bold tracking-tight`}>Forgot your password?</h1>
          <p className="text-muted-foreground mt-2 mb-6">
            Enter your email and we&apos;ll send you a link to set a new one.
          </p>
        </div>

        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
