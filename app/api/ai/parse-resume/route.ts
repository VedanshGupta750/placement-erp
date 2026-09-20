import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { generateJSON } from "@/lib/ai/client";
import { parseResumeSchema } from "@/lib/validators/ai";

type ParsedResume = {
  skills: string[];
  experiences: { organisation: string; role: string; experienceType?: string; description?: string }[];
  projects: { title: string; description?: string; techStack: string[] }[];
};

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const body = await request.json().catch(() => null);
  const parsed = parseResumeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const knownSkills = await db.skill.findMany({ select: { name: true } });
  const knownSkillNames = knownSkills.map((s: { name: string }) => s.name);

  const { data, stub } = await generateJSON<ParsedResume>({
    system:
      "You extract structured data from a student's resume text for a placement-cell ERP. Return skills (technical + tools, deduplicated), experiences (internships/jobs with organisation, role, experienceType as 'Internship'/'Full-time'/'Freelance', and a one-line description), and projects (title, description, techStack as an array of technology names). Omit anything not clearly present in the text — do not invent entries.",
    prompt: `Resume text:\n${parsed.data.text}`,
    stubFallback: () => {
      const lower = parsed.data.text.toLowerCase();
      const matchedSkills = knownSkillNames.filter((name: string) => lower.includes(name.toLowerCase()));
      return { skills: matchedSkills, experiences: [], projects: [] };
    },
  });

  return NextResponse.json({ ...data, stub });
}
