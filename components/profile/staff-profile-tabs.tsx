"use client";

import { ExternalLink, FileText, Mail, Phone, User as UserIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Post = { id: string; title: string; description: string; createdAt: string };

function timeAgo(iso: string) {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 365) return `${Math.round(days / 30)} month${Math.round(days / 30) === 1 ? "" : "s"} ago`;
  return `${Math.round(days / 365)} year${Math.round(days / 365) === 1 ? "" : "s"} ago`;
}

export function StaffProfileTabs({
  careerJourney,
  email,
  phone,
  linkedinUrl,
  posts,
}: {
  careerJourney: { roleLabel: string; collegeName: string }[];
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  posts: Post[];
}) {
  return (
    <Tabs defaultValue="career" className="mt-6 px-6">
      <TabsList variant="line" className="w-fit justify-start gap-6 border-b px-0">
        <TabsTrigger value="career">Career Journey</TabsTrigger>
        <TabsTrigger value="contact">Contact</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <TabsContent value="career" className="mt-6 flex flex-col gap-8">
        <div>
          <h2 className="mb-4 text-base font-semibold">Career Journey</h2>
          <div className="flex flex-col divide-y">
            {careerJourney.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 py-3 first:pt-0">
                <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
                  <UserIcon className="size-4" />
                </span>
                <div>
                  <div className="font-medium">{entry.roleLabel}</div>
                  <div className="text-muted-foreground text-sm">{entry.collegeName}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-base font-semibold">Contact Information</h2>
          <ContactList email={email} phone={phone} linkedinUrl={linkedinUrl} />
        </div>

        <div>
          <h2 className="mb-4 text-base font-semibold">Activity</h2>
          <ActivityList posts={posts} />
        </div>
      </TabsContent>

      <TabsContent value="contact" className="mt-6">
        <h2 className="mb-4 text-base font-semibold">Contact Information</h2>
        <ContactList email={email} phone={phone} linkedinUrl={linkedinUrl} />
      </TabsContent>

      <TabsContent value="activity" className="mt-6">
        <h2 className="mb-4 text-base font-semibold">Activity</h2>
        <ActivityList posts={posts} />
      </TabsContent>
    </Tabs>
  );
}

function ContactList({ email, phone, linkedinUrl }: { email: string; phone: string | null; linkedinUrl: string | null }) {
  return (
    <div className="flex flex-col divide-y">
      <div className="flex flex-col gap-1.5 py-3 first:pt-0">
        <span className="text-muted-foreground text-sm">Email</span>
        <a href={`mailto:${email}`} className="text-primary flex items-center gap-2 hover:underline">
          <Mail className="size-4" /> {email}
        </a>
      </div>
      {phone && (
        <div className="flex flex-col gap-1.5 py-3">
          <span className="text-muted-foreground text-sm">Phone</span>
          <span className="flex items-center gap-2">
            <Phone className="text-muted-foreground size-4" /> {phone}
          </span>
        </div>
      )}
      {linkedinUrl && (
        <div className="flex flex-col gap-1.5 py-3">
          <span className="text-muted-foreground text-sm">LinkedIn</span>
          <a href={linkedinUrl} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-2 hover:underline">
            <ExternalLink className="size-4" /> {linkedinUrl}
          </a>
        </div>
      )}
    </div>
  );
}

function ActivityList({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return <p className="text-muted-foreground text-sm">No posts yet.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {posts.map((p) => (
        <div key={p.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
              <FileText className="size-3.5" /> Post
            </span>
            <span className="text-muted-foreground text-xs">{timeAgo(p.createdAt)}</span>
          </div>
          <div className="mt-1.5 font-medium">{p.title}</div>
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">{p.description}</p>
        </div>
      ))}
    </div>
  );
}
