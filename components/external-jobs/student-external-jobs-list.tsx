import { Briefcase, ExternalLinkIcon, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type ApprovedJobRow = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  link: string;
};

// Purely a read-through list — clicking a posting sends the student to the
// company's own listing page. There is no internal application flow for
// these (unlike Opportunities/Drives): the placement cell curated which
// off-campus postings are worth seeing, applying still happens off-platform.
export function StudentExternalJobsList({ rows }: { rows: ApprovedJobRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          No external opportunities yet — check back soon.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <Card key={row.id}>
          <CardHeader>
            <CardTitle className="flex items-start gap-2 text-base">
              <Briefcase className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span>{row.title}</span>
            </CardTitle>
            <p className="text-muted-foreground text-sm">{row.company}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {row.location && (
              <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <MapPin className="size-3.5" /> {row.location}
              </span>
            )}
            <Button size="sm" variant="outline" nativeButton={false} render={<a href={row.link} target="_blank" rel="noopener noreferrer" />}>
              View & apply <ExternalLinkIcon className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
