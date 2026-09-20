import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";

type Offer = { id: string; status: string; totalCompensation: string; offerDate: string | null; joiningDate: string | null };

export function ApplicationOfferTab({ offer }: { offer: Offer | null }) {
  if (!offer) {
    return (
      <Card><CardContent className="text-muted-foreground py-8 text-center text-sm">No offer has been made for this application yet.</CardContent></Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold tabular-nums">₹{(Number(offer.totalCompensation) / 100000).toFixed(1)}L</span>
          <StatusBadge status={offer.status} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><div className="text-muted-foreground text-xs">Offer date</div><div>{offer.offerDate ? new Date(offer.offerDate).toLocaleDateString("en-IN") : "—"}</div></div>
          <div><div className="text-muted-foreground text-xs">Joining date</div><div>{offer.joiningDate ? new Date(offer.joiningDate).toLocaleDateString("en-IN") : "—"}</div></div>
        </div>
        <Link href="/offers" className="text-primary text-xs font-medium hover:underline">View in Offers →</Link>
      </CardContent>
    </Card>
  );
}
