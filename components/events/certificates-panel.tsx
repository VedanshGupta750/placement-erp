"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Award, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Certificate = { id: string; userId: string; userName: string; code: string; issuedAt: string };

// Rendered by files-tab.tsx (server) only when the event has
// certificateEnabled and the viewer holds event.manage_registrations —
// certificate verification codes are sensitive enough that we don't render
// this panel at all for anyone else (students see their own certificate via
// their profile page instead).
export function CertificatesPanel({
  eventId,
  presentCount,
  certificates,
}: {
  eventId: string;
  presentCount: number;
  certificates: Certificate[];
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);

  const pendingCount = Math.max(presentCount - certificates.length, 0);

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch(`/api/events/${eventId}/certificates`, { method: "POST" });
    setGenerating(false);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      router.refresh();
      toast.success(data.count ? `Generated ${data.count} certificate${data.count === 1 ? "" : "s"}.` : "No new certificates to generate.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't generate certificates.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="size-4" /> Certificates
        </CardTitle>
        <Button type="button" size="sm" disabled={generating || pendingCount === 0} onClick={handleGenerate}>
          {generating ? "Generating…" : pendingCount > 0 ? `Generate Certificates (${pendingCount} pending)` : "Generate Certificates"}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          {certificates.length} certificate{certificates.length === 1 ? "" : "s"} issued · {presentCount} attendee{presentCount === 1 ? "" : "s"} checked in
        </p>
        <div className="flex flex-col divide-y">
          {certificates.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <div className="font-medium">{c.userName}</div>
                <div className="text-muted-foreground text-xs">
                  Code: {c.code} · Issued {new Date(c.issuedAt).toLocaleDateString("en-IN")}
                </div>
              </div>
              <Button variant="ghost" size="sm" render={<Link href={`/events/${eventId}/certificates/${c.userId}`} />}>
                View <ArrowRight className="size-3.5" />
              </Button>
            </div>
          ))}
          {certificates.length === 0 && <p className="text-muted-foreground py-4 text-sm">No certificates issued yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
