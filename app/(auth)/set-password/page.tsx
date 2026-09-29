import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyPasswordToken } from "@/lib/auth/password-reset";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export const metadata = {
  title: "Set your password",
  // A password link must never end up in a search index.
  robots: { index: false, follow: false },
};

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  // Validated on the server before rendering, so an expired link shows the
  // explanation instead of a form that fails only after the user types.
  const row = token ? await verifyPasswordToken(token) : null;

  if (!row) {
    return (
      <div className="flex flex-col gap-4">
        <div className="border-destructive/30 bg-destructive/10 flex items-start gap-3 rounded-lg border p-4">
          <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">This link is no longer valid</p>
            <p className="text-muted-foreground mt-1">
              It has expired or has already been used. Request a new one and it will be emailed to you.
            </p>
          </div>
        </div>
        <Button render={<Link href="/forgot-password" />}>Request a new link</Button>
        <Link href="/sign-in" className="text-muted-foreground hover:text-foreground text-center text-sm">
          Back to sign in
        </Link>
      </div>
    );
  }

  return <SetPasswordForm token={token!} name={row.user.name} purpose={row.purpose} />;
}
