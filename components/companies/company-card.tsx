import Link from "next/link";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PartnershipStatusBadge } from "@/components/companies/partnership-status-badge";

export type CompanyCardData = {
  id: string;
  name: string;
  logoUrl: string | null;
  industryType: string | null;
  status: string;
  drives: number;
  applications: number;
  offers: number;
  avgCtc: number | null;
  placementRate: number | null;
  lastActivityAt: Date | null;
};

export function CompanyCard({ company }: { company: CompanyCardData }) {
  return (
    <Link href={`/companies/${company.id}`}>
      <Card className="h-full transition-colors hover:bg-accent/40">
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt="" className="size-9 shrink-0 rounded-md border object-contain" />
              ) : (
                <div className="bg-accent flex size-9 shrink-0 items-center justify-center rounded-md">
                  <Building2 className="text-muted-foreground size-4" />
                </div>
              )}
              <div>
                <div className="font-semibold">{company.name}</div>
                <div className="text-muted-foreground text-xs">{company.industryType ?? "—"}</div>
              </div>
            </div>
            <PartnershipStatusBadge status={company.status} />
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Drives</div>
              <div className="font-semibold tabular-nums">{company.drives}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Applications</div>
              <div className="font-semibold tabular-nums">{company.applications}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Offers</div>
              <div className="font-semibold tabular-nums">{company.offers}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Avg CTC</div>
              <div className="font-semibold tabular-nums">{company.avgCtc != null ? `₹${company.avgCtc}L` : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Placement Rate</div>
              <div className="font-semibold tabular-nums">{company.placementRate != null ? `${company.placementRate}%` : "—"}</div>
            </div>
          </div>

          <div className="text-muted-foreground border-t pt-2 text-xs">
            {company.lastActivityAt
              ? `Last activity: ${company.lastActivityAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
              : "No activity logged yet"}
          </div>

          <span className="text-primary text-sm font-medium">View Company →</span>
        </CardContent>
      </Card>
    </Link>
  );
}
