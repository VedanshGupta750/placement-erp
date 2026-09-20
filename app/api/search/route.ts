import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";

// Global topbar search — students, drives, companies by name, plus
// applications by applicant name (no dedicated application detail page
// exists, so that result links to the filterable /applications list rather
// than fabricating a target). Read-only, scoped to the caller's own college
// via getTenantDb; capped small since this backs a live-as-you-type
// dropdown, not a full search page.
export async function GET(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ students: [], drives: [], companies: [], applications: [], messages: [], contacts: [] });
  }

  const [students, drives, companies, applicationCount, messages, contacts] = await Promise.all([
    db.student.findMany({
      where: { user: { name: { contains: q, mode: "insensitive" } } },
      select: { id: true, user: { select: { name: true } }, enrollmentNumber: true },
      take: 5,
    }),
    db.drive.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, company: { select: { name: true } } },
      take: 5,
    }),
    db.company.findMany({
      where: { name: { contains: q, mode: "insensitive" }, partnerships: { some: { collegeId: session.collegeId } } },
      select: { id: true, name: true },
      take: 5,
    }),
    db.application.count({ where: { student: { user: { name: { contains: q, mode: "insensitive" } } } } }),
    // Only messages in conversations the caller actually participates in —
    // Message has no collegeId of its own, so it's scoped through the
    // tenant-scoped Conversation relation (see lib/tenant/scoped-db.ts).
    db.message.findMany({
      where: {
        conversation: { participants: { some: { userId: session.userId } } },
        OR: [
          { body: { contains: q, mode: "insensitive" } },
          { attachmentName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        body: true,
        attachmentName: true,
        conversationId: true,
        sender: { select: { name: true } },
        conversation: { select: { isGroup: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.contact.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { company: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: { id: true, name: true, designation: true, company: { select: { name: true } } },
      take: 5,
    }),
  ]);

  return NextResponse.json({
    students: students.map((s) => ({ id: s.id, label: s.user.name, sublabel: s.enrollmentNumber, href: `/students/${s.id}` })),
    drives: drives.map((d) => ({ id: d.id, label: d.title, sublabel: d.company.name, href: `/drives/${d.id}` })),
    companies: companies.map((c) => ({ id: c.id, label: c.name, href: `/companies/${c.id}` })),
    applications:
      applicationCount > 0
        ? [{ id: "apps", label: `${applicationCount} application${applicationCount === 1 ? "" : "s"} for "${q}"`, href: `/applications?q=${encodeURIComponent(q)}` }]
        : [],
    messages: messages.map((m: {
      id: string;
      body: string;
      attachmentName: string | null;
      conversationId: string;
      sender: { name: string } | null;
      conversation: { isGroup: boolean; name: string | null };
    }) => ({
      id: m.id,
      label: m.body?.trim() || (m.attachmentName ? `📎 ${m.attachmentName}` : "Attachment"),
      sublabel: [m.sender?.name, m.conversation.isGroup ? m.conversation.name : null].filter(Boolean).join(" · "),
      href: `/messages/${m.conversationId}`,
    })),
    contacts: contacts.map((c: { id: string; name: string | null; designation: string | null; company: { name: string } | null }) => ({
      id: c.id,
      label: c.name ?? "Unnamed contact",
      sublabel: [c.designation, c.company?.name].filter(Boolean).join(" · "),
      href: `/contacts/${c.id}`,
    })),
  });
}
