import Link from "next/link";
import { UserPlus, Upload, ShieldCheck, MessageSquare, Download, FileBarChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ACTIONS = [
  { label: "Add Student", href: "/students/import", icon: UserPlus },
  { label: "Import Students", href: "/students/import", icon: Upload },
  { label: "Eligibility Check", href: "/students?eligible=1", icon: ShieldCheck },
  { label: "Send Message", href: "/messages", icon: MessageSquare },
  { label: "Download List", href: "/api/students/export", icon: Download },
  { label: "Create Report", href: "/reports", icon: FileBarChart },
];

export function QuickActionsPanel() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-3 gap-2">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.label} href={a.href} className="hover:bg-accent text-muted-foreground hover:text-foreground flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors">
              <Icon className="size-4" />
              <span className="text-[11px] leading-tight">{a.label}</span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
