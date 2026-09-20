"use client";

import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Video, CalendarPlus } from "lucide-react";

type Info = {
  companyName: string;
  driveTitle: string;
  roundName: string;
  roundType: string;
  scheduledAt: string | null;
  mode: string;
  venue: string | null;
  meetingUrl: string | null;
  interviewerName: string | null;
};

function icsHref(info: Info) {
  if (!info.scheduledAt) return null;
  const start = new Date(info.scheduledAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const location = info.mode === "ONLINE" ? (info.meetingUrl ?? "Online") : (info.venue ?? "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${info.roundName} — ${info.companyName}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${info.driveTitle}${info.interviewerName ? ` · Interviewer: ${info.interviewerName}` : ""}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function InterviewInfoCard({ info }: { info: Info }) {
  const ics = icsHref(info);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Interview Details</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 text-sm">
        <div><div className="text-muted-foreground text-xs">Company</div><div className="font-medium">{info.companyName}</div></div>
        <div><div className="text-muted-foreground text-xs">Drive</div><div className="font-medium">{info.driveTitle}</div></div>
        <div><div className="text-muted-foreground text-xs">Round</div><div className="font-medium">{info.roundName} <span className="text-muted-foreground font-normal">({info.roundType})</span></div></div>
        <div><div className="text-muted-foreground text-xs">Mode</div><div className="font-medium">{info.mode === "ONLINE" ? "Online" : "Offline"}</div></div>
        <div>
          <div className="text-muted-foreground text-xs">Date &amp; time</div>
          <div className="font-medium">{info.scheduledAt ? new Date(info.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Not scheduled yet"}</div>
        </div>
        <div><div className="text-muted-foreground text-xs">Interviewer</div><div className="font-medium">{info.interviewerName ?? "-"}</div></div>
        {info.mode === "OFFLINE" && info.venue && (
          <div className="col-span-2"><div className="text-muted-foreground text-xs">Venue</div><div className="font-medium">{info.venue}</div></div>
        )}

        {(info.mode === "ONLINE" && info.meetingUrl) || ics ? (
          <div className="col-span-2 flex flex-wrap gap-2 border-t pt-3">
            {info.mode === "ONLINE" && info.meetingUrl && (
              <>
                <Button size="sm" render={<a href={info.meetingUrl} target="_blank" rel="noreferrer" />}>
                  <Video className="size-3.5" /> Join Interview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { navigator.clipboard?.writeText(info.meetingUrl!); toast.success("Meeting link copied."); }}
                >
                  <Copy className="size-3.5" /> Copy Link
                </Button>
              </>
            )}
            {ics && (
              <Button size="sm" variant="outline" render={<a href={ics} download="interview.ics" />}>
                <CalendarPlus className="size-3.5" /> Add to Calendar
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
