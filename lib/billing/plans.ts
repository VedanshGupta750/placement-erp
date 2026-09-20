// Plan catalog definitions, upserted into the Plan table at provisioning
// time. Payment gateway integration is deliberately stubbed for v1 —
// colleges start on a trial and are managed manually by platform admins
// until a gateway is wired up.

export const TRIAL_LENGTH_DAYS = 30;

export const PLAN_DEFS = [
  {
    code: "STARTER" as const,
    name: "Starter",
    maxStudents: 500,
    maxRecruiters: 25,
    priceInPaise: 0,
    features: ["Drives & offers", "Student roster", "Reports", "Messaging"],
  },
  {
    code: "GROWTH" as const,
    name: "Growth",
    maxStudents: 3000,
    maxRecruiters: 100,
    priceInPaise: 4_999_00,
    features: ["Everything in Starter", "Recruiter portal", "Interview scheduling", "Forums"],
  },
  {
    code: "SCALE" as const,
    name: "Scale",
    maxStudents: 20000,
    maxRecruiters: 500,
    priceInPaise: 14_999_00,
    features: ["Everything in Growth", "Match scoring", "WhatsApp/SMS notifications", "Priority support"],
  },
];
