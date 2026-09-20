import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { generateJSON } from "@/lib/ai/client";
import { parseJdSchema } from "@/lib/validators/ai";

type ParsedJd = {
  title: string;
  companyName: string;
  positionType: "JOB" | "INTERNSHIP" | "JOB_AND_INTERNSHIP";
  employmentType: "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "INTERNSHIP_PLUS_PPO";
  locationCategory: "ON_CAMPUS" | "OFF_CAMPUS" | "POOL_CAMPUS" | "VIRTUAL";
  minCtc: number | null;
  maxCtc: number | null;
  maxStipend: number | null;
  expectedOpenings: number | null;
  eligibilityCriteria: string;
  selectionProcessDetails: string;
  skillNames: string[];
  courseNames: string[];
};

const FIRST_LINE_MAX = 120;

export async function POST(request: Request) {
  const session = await requireSession();

  try {
    await requirePermission(session, "drive.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = parseJdSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { data, stub } = await generateJSON<ParsedJd>({
    system:
      "You extract structured placement-drive fields from a pasted job description for a placement-cell ERP. positionType is JOB unless the JD is clearly an internship (then INTERNSHIP) or offers both (JOB_AND_INTERNSHIP). employmentType mirrors that (FULL_TIME / INTERNSHIP / INTERNSHIP_PLUS_PPO if a pre-placement offer is mentioned / PART_TIME). locationCategory defaults to ON_CAMPUS unless the JD says otherwise (remote -> VIRTUAL, off-campus/pool drive -> OFF_CAMPUS/POOL_CAMPUS). minCtc/maxCtc/maxStipend are annual rupee figures as plain numbers (no currency symbols, no lakhs shorthand — convert e.g. '6 LPA' to 600000), null if not mentioned. skillNames and courseNames are your best-effort extraction of required technical skills and eligible degree/branch names mentioned in the JD.",
    prompt: `Job description:\n${parsed.data.text}`,
    stubFallback: () => {
      const firstLine = parsed.data.text.trim().split("\n")[0].slice(0, FIRST_LINE_MAX);
      return {
        title: firstLine || "New drive",
        companyName: "",
        positionType: "JOB" as const,
        employmentType: "FULL_TIME" as const,
        locationCategory: "ON_CAMPUS" as const,
        minCtc: null,
        maxCtc: null,
        maxStipend: null,
        expectedOpenings: null,
        eligibilityCriteria: parsed.data.text.trim().slice(0, 500),
        selectionProcessDetails: "",
        skillNames: [],
        courseNames: [],
      };
    },
  });

  return NextResponse.json({ ...data, stub });
}
