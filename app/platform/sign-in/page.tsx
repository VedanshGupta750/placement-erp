import { redirect } from "next/navigation";
import { getPlatformSession } from "@/lib/auth/platform-session";
import { PlatformSignInForm } from "@/components/platform/platform-sign-in-form";

export const metadata = {
  title: "Platform console",
  // Kept out of search indexes — this is the operator door, not a product page.
  robots: { index: false, follow: false },
};

export default async function PlatformSignInPage() {
  const admin = await getPlatformSession();
  if (admin) redirect("/platform");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-10">
      <PlatformSignInForm />
    </div>
  );
}
