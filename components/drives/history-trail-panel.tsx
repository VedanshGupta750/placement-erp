import { History } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  CREATED: "Created the drive",
};

function describeAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const match = action.match(/^STATUS_CHANGED_TO_(.+)$/);
  if (match) return `Changed the status to ${match[1].replaceAll("_", " ")}`;
  return action.replaceAll("_", " ");
}

type Entry = { id: string; action: string; createdAt: string; actor: { name: string } };

export function HistoryTrailPanel({ entries }: { entries: Entry[] }) {
  return (
    <div className="flex flex-col gap-3">
      {entries.map((e) => (
        <div key={e.id} className="rounded-lg border px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{e.actor.name}</span>
            <span className="text-muted-foreground text-xs">{new Date(e.createdAt).toLocaleString("en-IN")}</span>
          </div>
          <p className="text-muted-foreground mt-1">{describeAction(e.action)}</p>
        </div>
      ))}
      {entries.length === 0 && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <History className="size-4" /> No history recorded yet.
        </p>
      )}
    </div>
  );
}
