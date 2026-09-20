import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Position = {
  id: string;
  title: string;
  positionType: string;
  employmentType: string;
  minCtc: unknown;
  maxCtc: unknown;
  stipend: unknown;
  joiningBonus: unknown;
  openings: number | null;
};

// Positions are drive-scoped configuration, not a top-level module — this
// panel is deliberately read-only (positions are created via the drive
// wizard); it exists so a multi-position drive's roles are all visible
// individually instead of only the first one, which Overview showed before.
export function PositionsPanel({ positions, locationCategory, skills }: { positions: Position[]; locationCategory: string; skills: { skillId: string; skill: { name: string } }[] }) {
  return (
    <div className="flex flex-col gap-4">
      {positions.map((p) => (
        <Card key={p.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{p.title}</CardTitle>
            <div className="flex gap-1.5">
              <Badge variant="outline">{p.positionType.replaceAll("_", " ")}</Badge>
              <Badge variant="outline">{p.employmentType.replaceAll("_", " ")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-muted-foreground text-xs">CTC range</div>
              <div className="font-medium">
                {p.minCtc ? `₹${(Number(p.minCtc) / 100000).toFixed(1)}L` : "—"}
                {p.maxCtc ? ` – ₹${(Number(p.maxCtc) / 100000).toFixed(1)}L` : ""}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Stipend</div>
              <div className="font-medium">{p.stipend ? `₹${Number(p.stipend).toLocaleString("en-IN")}/mo` : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Joining bonus</div>
              <div className="font-medium">{p.joiningBonus ? `₹${Number(p.joiningBonus).toLocaleString("en-IN")}` : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Openings</div>
              <div className="font-medium">{p.openings ?? "—"}</div>
            </div>
          </CardContent>
        </Card>
      ))}
      {positions.length === 0 && (
        <Card><CardContent className="text-muted-foreground py-8 text-center text-sm">No positions configured for this drive.</CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Shared across positions</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Location</div>
            <p>{locationCategory.replaceAll("_", " ")}</p>
          </div>
          {skills.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-1">Required skills</div>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => <Badge key={s.skillId} variant="outline">{s.skill.name}</Badge>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
