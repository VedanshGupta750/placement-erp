// One-off bulk data generator: the user wants the platform to look like a
// real, actively-used college placement cell (1000+ real-shaped records),
// not a thin demo. Purely ADDITIVE — never deletes or modifies existing
// rows, safe to run against a college that already has real data on it.
// Skips the O(students) eligibility-snapshot computation seed.ts does per
// drive (that's tens of thousands of rows at this scale, and isn't part of
// what makes the platform "look populated" in the UI) — every other model
// seed.ts touches is generated at full scale.
import "dotenv/config";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { computeMatchScore } from "@/lib/matching";
import { recomputeDriveCounters } from "@/lib/drives/counters";
import { DEFAULT_ELIGIBILITY_LOGIC } from "@/lib/eligibility";

const STUDENTS_TO_ADD = Number(process.env.EXPAND_STUDENTS) || 960;
const COMPANIES_TO_ADD = Number(process.env.EXPAND_COMPANIES) || 42;
const DRIVES_TO_ADD = Number(process.env.EXPAND_DRIVES) || 50;
const CONCURRENCY = Number(process.env.EXPAND_CONCURRENCY) || 12;

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditi", "Diya", "Ishaan", "Kabir", "Myra", "Sai",
  "Ananya", "Reyansh", "Saanvi", "Arjun", "Kiara", "Vihaan", "Zara",
  "Nikunj", "Prisha", "Rohan", "Meera", "Karan", "Advait", "Anaya",
  "Dhruv", "Riya", "Kian", "Navya", "Yash", "Tanvi", "Aryan", "Aisha",
  "Rudra", "Siya", "Veer", "Anika", "Shaurya", "Ira", "Om", "Pihu",
  "Atharv", "Kavya", "Krish", "Trisha", "Reyaansh", "Avni", "Samar",
  "Nitya", "Yuvraj", "Palak", "Devansh", "Ritika", "Parth", "Simran",
  "Harsh", "Sneha", "Manan", "Pooja", "Rehan", "Neha", "Vedant", "Isha",
  "Aayush", "Priya", "Kunal", "Divya", "Rajat", "Shreya", "Naman", "Alia",
  "Gaurav", "Ritu", "Suraj", "Kritika",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Reddy", "Iyer", "Patel", "Nair", "Singh",
  "Rao", "Mehta", "Joshi", "Kulkarni", "Deshmukh", "Agrawal", "Kapoor",
  "Chauhan", "Bhatt", "Menon", "Pillai", "Chowdhury", "Bose", "Ghosh",
  "Malhotra", "Khanna", "Saxena", "Trivedi", "Pandey", "Mishra", "Yadav",
  "Thakur", "Chandra", "Bhandari", "Naidu", "Krishnan", "Subramaniam",
  "Bansal", "Goyal", "Jain", "Chopra", "Arora", "Bhatia", "Sinha",
];
const COMPANY_POOL: { name: string; industryType: string }[] = [
  { name: "Wipro", industryType: "IT Services" },
  { name: "Accenture", industryType: "Consulting" },
  { name: "Cognizant", industryType: "IT Services" },
  { name: "HCLTech", industryType: "IT Services" },
  { name: "Tech Mahindra", industryType: "IT Services" },
  { name: "IBM India", industryType: "IT Services" },
  { name: "Amazon", industryType: "E-Commerce" },
  { name: "Flipkart", industryType: "E-Commerce" },
  { name: "Microsoft India", industryType: "Software" },
  { name: "Adobe", industryType: "Software" },
  { name: "Oracle India", industryType: "Software" },
  { name: "SAP Labs India", industryType: "Software" },
  { name: "Zomato", industryType: "Consumer Internet" },
  { name: "Swiggy", industryType: "Consumer Internet" },
  { name: "Paytm", industryType: "Fintech" },
  { name: "PhonePe", industryType: "Fintech" },
  { name: "Razorpay", industryType: "Fintech" },
  { name: "CRED", industryType: "Fintech" },
  { name: "Zerodha", industryType: "Fintech" },
  { name: "Groww", industryType: "Fintech" },
  { name: "EY", industryType: "Consulting" },
  { name: "KPMG India", industryType: "Consulting" },
  { name: "PwC India", industryType: "Consulting" },
  { name: "JP Morgan Chase", industryType: "Banking & Finance" },
  { name: "Goldman Sachs", industryType: "Banking & Finance" },
  { name: "Morgan Stanley", industryType: "Banking & Finance" },
  { name: "HDFC Bank", industryType: "Banking & Finance" },
  { name: "ICICI Bank", industryType: "Banking & Finance" },
  { name: "Axis Bank", industryType: "Banking & Finance" },
  { name: "Bajaj Finserv", industryType: "Banking & Finance" },
  { name: "Larsen & Toubro", industryType: "Engineering" },
  { name: "Mahindra & Mahindra", industryType: "Manufacturing" },
  { name: "Tata Motors", industryType: "Manufacturing" },
  { name: "Maruti Suzuki", industryType: "Manufacturing" },
  { name: "Bosch India", industryType: "Manufacturing" },
  { name: "Schneider Electric", industryType: "Engineering" },
  { name: "ABB India", industryType: "Engineering" },
  { name: "LTIMindtree", industryType: "IT Services" },
  { name: "Persistent Systems", industryType: "IT Services" },
  { name: "Zensar Technologies", industryType: "IT Services" },
  { name: "Mphasis", industryType: "IT Services" },
  { name: "Hexaware Technologies", industryType: "IT Services" },
  { name: "Cyient", industryType: "Engineering" },
  { name: "Genpact", industryType: "Analytics" },
  { name: "WNS Global Services", industryType: "Analytics" },
  { name: "EXL Service", industryType: "Analytics" },
  { name: "Byju's", industryType: "Edtech" },
  { name: "Unacademy", industryType: "Edtech" },
  { name: "Ola", industryType: "Mobility" },
  { name: "Nykaa", industryType: "E-Commerce" },
  { name: "Meesho", industryType: "E-Commerce" },
  { name: "Dream11", industryType: "Consumer Internet" },
  { name: "PolicyBazaar", industryType: "Fintech" },
  { name: "MakeMyTrip", industryType: "Travel & Hospitality" },
  { name: "redBus", industryType: "Travel & Hospitality" },
  { name: "Google India", industryType: "Software" },
  { name: "Salesforce India", industryType: "Software" },
  { name: "Nvidia Graphics", industryType: "Semiconductors" },
  { name: "Qualcomm India", industryType: "Semiconductors" },
  { name: "Intel India", industryType: "Semiconductors" },
];

const DRIVE_ROLE_TEMPLATES = [
  { title: "Software Engineer", positionType: "JOB" as const, minCtc: 500000, maxCtc: 1200000 },
  { title: "Associate Software Engineer", positionType: "JOB" as const, minCtc: 400000, maxCtc: 700000 },
  { title: "Data Analyst", positionType: "JOB" as const, minCtc: 450000, maxCtc: 800000 },
  { title: "Business Analyst", positionType: "JOB" as const, minCtc: 500000, maxCtc: 900000 },
  { title: "Graduate Engineer Trainee", positionType: "JOB" as const, minCtc: 350000, maxCtc: 550000 },
  { title: "Cloud Support Associate", positionType: "JOB" as const, minCtc: 400000, maxCtc: 600000 },
  { title: "ML Engineer", positionType: "JOB" as const, minCtc: 800000, maxCtc: 1800000 },
  { title: "QA Engineer", positionType: "JOB" as const, minCtc: 400000, maxCtc: 650000 },
  { title: "DevOps Engineer", positionType: "JOB" as const, minCtc: 600000, maxCtc: 1300000 },
  { title: "Product Analyst", positionType: "JOB" as const, minCtc: 550000, maxCtc: 1000000 },
  { title: "Backend Developer Intern", positionType: "INTERNSHIP" as const, minCtc: null, maxCtc: null },
  { title: "Frontend Developer Intern", positionType: "INTERNSHIP" as const, minCtc: null, maxCtc: null },
  { title: "Business Analyst Internship + PPO", positionType: "JOB_AND_INTERNSHIP" as const, minCtc: 400000, maxCtc: 550000 },
  { title: "Design Intern + PPO", positionType: "JOB_AND_INTERNSHIP" as const, minCtc: 350000, maxCtc: 500000 },
];

function pick<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function main() {
  const colleges = await prisma.college.findMany({ select: { id: true, name: true } });
  if (colleges.length !== 1) {
    console.error(`Expected exactly 1 college, found ${colleges.length}. Aborting — pass a collegeId explicitly if this changes.`);
    process.exit(1);
  }
  const collegeId = colleges[0].id;
  console.log(`Expanding data for: ${colleges[0].name} (${collegeId})`);

  const campus = await prisma.campus.findFirstOrThrow({ where: { collegeId } });
  const department = await prisma.department.findFirstOrThrow({ where: { collegeId } });
  const batch = await prisma.batch.findFirstOrThrow({ where: { collegeId } });
  const courses = await prisma.course.findMany({ where: { collegeId } });
  const skills = await prisma.skill.findMany({ where: { collegeId } });
  const studentRole = await prisma.role.findFirstOrThrow({ where: { collegeId, name: "Student" } });
  const tpo = await prisma.user.findFirstOrThrow({ where: { collegeId, userType: "PLACEMENT_TEAM" } });
  const existingStudentCount = await prisma.user.count({ where: { collegeId, userType: "STUDENT" } });
  const passwordHash = await hashPassword("Password123!");

  // ---- Companies ----
  console.log(`Adding ${COMPANIES_TO_ADD} companies...`);
  const companyDefs = pick(COMPANY_POOL, Math.min(COMPANIES_TO_ADD, COMPANY_POOL.length));
  const newCompanies = await mapPool(companyDefs, CONCURRENCY, async (c) => {
    const company = await prisma.company.upsert({ where: { name: c.name }, create: c, update: {} });
    await prisma.collegePartnership.upsert({
      where: { collegeId_companyId: { collegeId, companyId: company.id } },
      create: { collegeId, companyId: company.id, status: "ACTIVE", connectedAt: new Date() },
      update: {},
    });
    return company;
  });
  const existingCompanies = await prisma.company.findMany({
    where: { partnerships: { some: { collegeId } } },
  });
  const allCompanies = existingCompanies.length ? existingCompanies : newCompanies;
  console.log(`Companies now: ${allCompanies.length}`);

  // ---- Contacts (recruiter CRM rows against the new companies) ----
  console.log("Adding recruiter contacts...");
  await mapPool(newCompanies, CONCURRENCY, async (company) => {
    const person = rand(FIRST_NAMES);
    await prisma.contact.create({
      data: {
        collegeId,
        companyId: company.id,
        name: `${person} - HR Team`,
        email: `hr.${company.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}@partner-demo.local`,
        contactType: "Recruiter",
        addedById: tpo.id,
      },
    }).catch(() => {});
  });

  // ---- Students ----
  console.log(`Adding ${STUDENTS_TO_ADD} students...`);
  const studentIndexes = Array.from({ length: STUDENTS_TO_ADD }, (_, i) => existingStudentCount + 20000 + i);
  const newStudents = await mapPool(studentIndexes, CONCURRENCY, async (idx) => {
    const first = rand(FIRST_NAMES);
    const last = rand(LAST_NAMES);
    const course = rand(courses);
    const email = `student${idx}.${first.toLowerCase()}@demo.placement-erp.local`;
    const user = await prisma.user.create({
      data: { collegeId, email, name: `${first} ${last}`, passwordHash, status: "ACTIVE", userType: "STUDENT", roleId: studentRole.id },
    });
    const studentSkills = pick(skills, 4 + Math.floor(Math.random() * 3));
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        collegeId,
        campusId: campus.id,
        departmentId: department.id,
        batchId: batch.id,
        courseId: course.id,
        enrollmentNumber: `2026${String(200000 + idx)}`,
        aggregate: Math.round((6.5 + Math.random() * 3.3) * 100) / 100,
        aggregateType: "CGPA",
        tenthScore: Math.round((70 + Math.random() * 28) * 100) / 100,
        tenthScoreType: "Percentage",
        twelfthScore: Math.round((65 + Math.random() * 30) * 100) / 100,
        twelfthScoreType: "Percentage",
        liveBacklogs: Math.random() > 0.85 ? 1 : 0,
        hasPlacementAccess: true,
        eligibleForPlacements: true,
        interestedInJobs: true,
        interestedInInternships: Math.random() > 0.5,
        summary: `${course.specialization} student exploring placement opportunities.`,
        expertise: pick(skills.map((s) => s.name), 3),
        skills: { create: studentSkills.map((s) => ({ skillId: s.id })) },
      },
    });
    await prisma.resume.create({ data: { collegeId, studentId: student.id, name: `${first} ${last} Resume`, isDefault: true, isValid: true } });
    await prisma.studentExperience.create({
      data: {
        studentId: student.id,
        organisation: rand(["Self Project", "College Lab", "Internshala"]),
        role: "Intern",
        experienceType: "Internship",
        startDate: new Date(Date.now() - 200 * 86400000),
        endDate: new Date(Date.now() - 100 * 86400000),
        description: "Contributed to a small team project.",
      },
    }).catch(() => {});
    return { ...student, skillNames: studentSkills.map((s) => s.name) };
  });
  console.log(`Students added: ${newStudents.length}`);

  const allStudents = await prisma.student.findMany({
    where: { collegeId },
    include: { skills: { include: { skill: true } } },
  });
  const studentsWithSkillNames = allStudents.map((s) => ({ ...s, skillNames: s.skills.map((ss) => ss.skill.name) }));

  // ---- Drives ----
  console.log(`Adding ${DRIVES_TO_ADD} drives...`);
  const driveDefs = Array.from({ length: DRIVES_TO_ADD }, () => rand(DRIVE_ROLE_TEMPLATES));
  const newDrives = await mapPool(driveDefs, CONCURRENCY, async (d) => {
    const company = rand(allCompanies);
    const eligibleCourses = pick(courses, 3 + Math.floor(Math.random() * 3));
    const requiredSkills = pick(skills, 3 + Math.floor(Math.random() * 3));
    const status = rand(["PUBLISHED", "PUBLISHED", "PUBLISHED", "REGISTRATION_CLOSED", "DRAFT"] as const);
    const drive = await prisma.drive.create({
      data: {
        collegeId,
        batchId: batch.id,
        departmentId: department.id,
        companyId: company.id,
        createdById: tpo.id,
        title: `${d.title} - ${company.name}`,
        status,
        locationCategory: "ON_CAMPUS",
        sourceType: "SELF",
        expectedOpenings: 5 + Math.floor(Math.random() * 25),
        eligibilityCriteria: "No active backlogs. Minimum 60% throughout academics.",
        selectionProcessDetails: "Online Test -> Technical Interview -> HR Interview",
        registrationOpensAt: new Date(Date.now() - 10 * 86400000),
        registrationClosesAt: new Date(Date.now() + (status === "PUBLISHED" ? 10 : -3) * 86400000),
        approvedAt: status === "DRAFT" ? null : new Date(Date.now() - 9 * 86400000),
        publishedAt: status === "DRAFT" ? null : new Date(Date.now() - 9 * 86400000),
        eligibleCourses: { create: eligibleCourses.map((c) => ({ courseId: c.id })) },
        requiredSkills: { create: requiredSkills.map((s) => ({ skillId: s.id })) },
        positions: {
          create: {
            collegeId,
            title: d.title,
            positionType: d.positionType,
            employmentType: d.positionType === "INTERNSHIP" ? "INTERNSHIP" : "FULL_TIME",
            minCtc: d.minCtc,
            maxCtc: d.maxCtc,
            openings: 5 + Math.floor(Math.random() * 25),
          },
        },
        historyEntries: { create: { actorId: tpo.id, action: "CREATED" } },
      },
      include: { requiredSkills: { include: { skill: true } }, eligibleCourses: true, positions: true },
    });
    if (status !== "DRAFT") {
      await prisma.driveEligibilityRule.create({
        data: {
          collegeId,
          driveId: drive.id,
          version: 1,
          isPublished: true,
          logic: DEFAULT_ELIGIBILITY_LOGIC,
          publishedAt: new Date(),
          publishedById: tpo.id,
          createdById: tpo.id,
        },
      });
    }
    return drive;
  });
  console.log(`Drives added: ${newDrives.length}`);

  // ---- Applications, rounds, offers ----
  console.log("Generating applications...");
  const tasks: { drive: (typeof newDrives)[number]; round1Id: string; round2Id: string; student: (typeof studentsWithSkillNames)[number] }[] = [];
  for (const drive of newDrives) {
    if (drive.status === "DRAFT") continue;
    const eligibleCourseIds = new Set(drive.eligibleCourses.map((c) => c.courseId));
    const eligibleStudents = studentsWithSkillNames.filter((s) => eligibleCourseIds.has(s.courseId));
    const applicants = pick(eligibleStudents, Math.min(eligibleStudents.length, 15 + Math.floor(Math.random() * 20)));

    const round1 = await prisma.selectionRound.create({
      data: { collegeId, driveId: drive.id, name: "Online Assessment", roundType: "Aptitude", sequenceNo: 1, status: "COMPLETED" },
    });
    const round2 = await prisma.selectionRound.create({
      data: { collegeId, driveId: drive.id, name: "Technical Interview", roundType: "Technical", sequenceNo: 2, status: "SCHEDULED" },
    });
    for (const student of applicants) {
      tasks.push({ drive, round1Id: round1.id, round2Id: round2.id, student });
    }
  }
  console.log(`Application tasks: ${tasks.length}`);

  await mapPool(tasks, CONCURRENCY, async ({ drive, round1Id, round2Id, student }) => {
    const position = drive.positions[0];
    const resume = await prisma.resume.findFirst({ where: { studentId: student.id, isDefault: true } });
    const requiredSkillNames = drive.requiredSkills.map((rs) => rs.skill.name);
    const { matchScore, matchedSkills, missingSkills } = computeMatchScore(student.skillNames, requiredSkillNames);
    const status = rand(["APPLIED", "COLLEGE_APPROVED", "SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED"] as const);
    const application = await prisma.application.create({
      data: {
        collegeId,
        studentId: student.id,
        driveId: drive.id,
        positionId: position.id,
        resumeId: resume?.id,
        status,
        matchScore,
        matchedSkills,
        missingSkills,
        approvedAt: status !== "APPLIED" ? new Date() : null,
        statusHistory: { create: { collegeId, toStatus: "APPLIED", changedById: tpo.id } },
      },
    });
    if (resume) {
      await prisma.resumeUsage.create({ data: { resumeId: resume.id, driveId: drive.id, applicationId: application.id } }).catch(() => {});
    }
    if (["SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED"].includes(status)) {
      await prisma.roundCandidate.create({
        data: { collegeId, roundId: round1Id, applicationId: application.id, studentId: student.id, status: "PASSED", score: 60 + Math.floor(Math.random() * 40), resultPublishedAt: new Date() },
      });
    }
    if (["ROUND_IN_PROGRESS", "SELECTED"].includes(status)) {
      await prisma.roundCandidate.create({
        data: {
          collegeId, roundId: round2Id, applicationId: application.id, studentId: student.id,
          status: status === "SELECTED" ? "PASSED" : "SCHEDULED", mode: "ONLINE",
          scheduledAt: new Date(Date.now() + 3 * 86400000), meetingUrl: "https://meet.example.com/interview", interviewerName: "Panel A",
        },
      });
    }
    if (status === "SELECTED" && Math.random() > 0.4 && position.maxCtc) {
      const offerStatus = rand(["ISSUED", "ACCEPTED", "JOINING_PENDING", "JOINED"] as const);
      const offer = await prisma.offer.create({
        data: {
          collegeId, applicationId: application.id, studentId: student.id, driveId: drive.id, positionId: position.id,
          offerType: "JOB", status: offerStatus, totalCompensation: position.maxCtc, fixedCompensation: position.maxCtc,
          offerDate: new Date(), issuedAt: new Date(),
          acceptedAt: offerStatus !== "ISSUED" ? new Date() : null,
        },
      });
      if (offerStatus === "JOINED" || offerStatus === "JOINING_PENDING") {
        await prisma.joiningRecord.create({
          data: { collegeId, offerId: offer.id, joiningStatus: offerStatus === "JOINED" ? "JOINED" : "PENDING", actualJoiningDate: offerStatus === "JOINED" ? new Date() : null },
        });
      }
    }
  });

  console.log("Recomputing drive counters...");
  for (const drive of newDrives) {
    await recomputeDriveCounters(prisma, drive.id).catch(() => {});
  }

  const finalStudentCount = await prisma.user.count({ where: { collegeId, userType: "STUDENT" } });
  const finalDriveCount = await prisma.drive.count({ where: { collegeId } });
  const finalCompanyCount = allCompanies.length;
  const finalApplicationCount = await prisma.application.count({ where: { collegeId } });
  console.log("\nExpansion complete.");
  console.log("-----------------------------------------");
  console.log(`Students:     ${finalStudentCount}`);
  console.log(`Companies:    ${finalCompanyCount}`);
  console.log(`Drives:       ${finalDriveCount}`);
  console.log(`Applications: ${finalApplicationCount}`);
  console.log("-----------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
