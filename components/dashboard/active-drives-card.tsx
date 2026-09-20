import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { ActiveDrive } from "@/lib/dashboard/get-active-drives";

export function ActiveDrivesCard({ drives }: { drives: ActiveDrive[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Active Drives</CardTitle>
        <Link href="/drives" className="text-sm font-medium text-primary hover:underline">
          View All
        </Link>
      </CardHeader>
      <CardContent>
        {drives.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No active drives right now.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Drive</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Eligible</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drives.map((drive) => (
                  <TableRow key={drive.id}>
                    <TableCell>
                      <Link href={drive.href} className="font-semibold hover:underline">
                        {drive.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{drive.company}</TableCell>
                    <TableCell className="tabular-nums">{drive.eligible}</TableCell>
                    <TableCell className="tabular-nums">
                      {drive.applied} ({drive.appliedPct}%)
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={drive.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${drive.appliedPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{drive.appliedPct}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="pt-4 text-center">
              <Link href="/drives" className="text-sm font-medium text-primary hover:underline">
                View All Drives
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
