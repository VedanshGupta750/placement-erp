import "dotenv/config";
import { prisma } from "@/lib/db";
import { provisionCollege } from "@/lib/provisioning";
import { buildDemoResume } from "./seed-pdf";
import { hashPassword } from "@/lib/auth/password";
import { computeMatchScore } from "@/lib/matching";
import { evaluateEligibility, DEFAULT_ELIGIBILITY_LOGIC } from "@/lib/eligibility";
import { recomputeDriveCounters } from "@/lib/drives/counters";

const COURSES = [
  { name: "B.Tech. - Computer Science & Engineering", degree: "B.Tech.", specialization: "Computer Science & Engineering", years: 4 },
  { name: "B.Tech. - CSE - Artificial Intelligence & Machine Learning", degree: "B.Tech.", specialization: "CSE - AI & ML", years: 4 },
  { name: "B.Tech. - CSE - Data Science", degree: "B.Tech.", specialization: "CSE - Data Science", years: 4 },
  { name: "B.Tech. - Electronics & Communication Engineering", degree: "B.Tech.", specialization: "Electronics & Communication", years: 4 },
  { name: "B.Tech. - Electrical Engineering", degree: "B.Tech.", specialization: "Electrical Engineering", years: 4 },
  { name: "B.Tech. - Mechanical Engineering", degree: "B.Tech.", specialization: "Mechanical Engineering", years: 4 },
  { name: "B.Tech. - Civil Engineering", degree: "B.Tech.", specialization: "Civil Engineering", years: 4 },
  { name: "MCA", degree: "M.C.A.", specialization: "Computer Applications", years: 3 },
  { name: "M.B.A. - General Management", degree: "M.B.A.", specialization: "General Management", years: 2 },
];

const SKILLS = [
  "Java", "Python", "JavaScript", "React", "Node.js", "SQL", "Data Structures",
  "Machine Learning", "AWS", "Communication", "Business Analysis", "AutoCAD",
  "SolidWorks", "Circuit Design", "Project Management", "Git",
];

const COMPANIES = [
  { name: "Infosys", industryType: "IT Services" },
  { name: "TCS", industryType: "IT Services" },
  { name: "Capgemini", industryType: "IT Services" },
  { name: "Deloitte", industryType: "Consulting" },
  { name: "Cummins India", industryType: "Manufacturing" },
  { name: "Siemens", industryType: "Engineering" },
  { name: "ZS Associates", industryType: "Analytics" },
  { name: "KPI Partners", industryType: "Data & Analytics" },
];

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditi", "Diya", "Ishaan", "Kabir", "Myra", "Sai",
  "Ananya", "Reyansh", "Saanvi", "Arjun", "Kiara", "Vihaan", "Zara",
  "Nikunj", "Prisha", "Rohan", "Meera", "Karan",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Reddy", "Iyer", "Patel", "Nair", "Singh",
  "Rao", "Mehta", "Joshi", "Kulkarni", "Deshmukh", "Agrawal", "Kapoor",
];

function pick<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("Provisioning demo college...");
  const { collegeId, campusId, departmentId, batchId } = await provisionCollege({
    collegeName: "Shri Ramdeobaba College of Engineering and Management",
    tpoName: "CDPC Placement Cell",
    tpoEmail: "tpo@demo.placement-erp.local",
    tpoPassword: "Password123!",
  });
  const batch = await prisma.batch.findUniqueOrThrow({ where: { id: batchId } });

  // ---- Courses + link to department ----
  const courses = [];
  for (const c of COURSES) {
    const course = await prisma.course.create({ data: { collegeId, ...c } });
    await prisma.departmentCourse.create({ data: { departmentId, courseId: course.id } });
    courses.push(course);
  }

  // ---- Skills catalog ----
  const skills = [];
  for (const name of SKILLS) {
    skills.push(await prisma.skill.create({ data: { collegeId, name } }));
  }

  // ---- Companies + partnerships + one recruiter login ----
  const companies = [];
  for (const c of COMPANIES) {
    const company = await prisma.company.create({ data: c });
    await prisma.collegePartnership.create({ data: { collegeId, companyId: company.id, status: "ACTIVE", connectedAt: new Date() } });
    companies.push(company);
  }
  const recruiterCompany = companies[0];
  await prisma.companyUser.create({
    data: {
      companyId: recruiterCompany.id,
      email: "recruiter@demo.placement-erp.local",
      passwordHash: await hashPassword("Password123!"),
      name: "Priya Recruiter",
      isOwner: true,
      status: "ACTIVE",
    },
  });

  const studentRole = await prisma.role.findFirstOrThrow({ where: { collegeId, name: "Student" } });

  // ---- Students ----
  const students = [];
  for (let i = 0; i < 40; i++) {
    const first = rand(FIRST_NAMES);
    const last = rand(LAST_NAMES);
    const name = `${first} ${last}`;
    const course = rand(courses);
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@demo.placement-erp.local`;
    const user = await prisma.user.create({
      data: { collegeId, email, name, passwordHash: await hashPassword("Password123!"), status: "ACTIVE", userType: "STUDENT", roleId: studentRole.id },
    });
    const studentSkills = pick(skills, 4 + Math.floor(Math.random() * 3));
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        collegeId,
        campusId,
        departmentId,
        batchId,
        courseId: course.id,
        enrollmentNumber: `2023${String(100000 + i)}`,
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
        expertise: pick(SKILLS, 3),
        skills: { create: studentSkills.map((s) => ({ skillId: s.id })) },
      },
    });
    // A real File row behind every seeded resume, so the TPO-facing
    // download link works in a demo instead of showing the "uploaded before
    // file download was wired up" fallback on every single application.
    const resumeDataUri = buildDemoResume(`${first} ${last}`, course.specialization ?? course.name, student.enrollmentNumber);
    const resumeFile = await prisma.file.create({
      data: {
        collegeId,
        storageKey: `seed/resume-${student.id}.pdf`,
        dataUrl: resumeDataUri,
        originalName: `${first}-${last}-Resume.pdf`,
        mimeType: "application/pdf",
        sizeBytes: Buffer.byteLength(resumeDataUri.split(",")[1] ?? "", "base64"),
        uploadedById: student.userId,
      },
    });
    await prisma.resume.create({
      data: {
        collegeId,
        studentId: student.id,
        name: `${first} ${last} Resume`,
        fileId: resumeFile.id,
        isDefault: true,
        isValid: true,
      },
    });
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
    students.push({ ...student, skillNames: studentSkills.map((s) => s.name) });
  }

  const demoStudentUser = await prisma.user.update({
    where: { id: students[0].userId },
    data: { email: "student@demo.placement-erp.local" },
  });
  console.log(`Demo student login: ${demoStudentUser.email}`);

  // ---- Drives + positions + eligibility rule + snapshot ----
  const tpo = await prisma.user.findFirstOrThrow({ where: { collegeId, userType: "PLACEMENT_TEAM" } });
  const driveDefs = [
    { title: "Software Engineer - Campus Drive 2026", positionType: "JOB" as const, minCtc: 450000, maxCtc: 700000, status: "PUBLISHED" as const },
    { title: "Data Analyst Recruitment", positionType: "JOB" as const, minCtc: 500000, maxCtc: 650000, status: "PUBLISHED" as const },
    { title: "Graduate Engineer Trainee", positionType: "JOB" as const, minCtc: 400000, maxCtc: 600000, status: "PUBLISHED" as const },
    { title: "Business Analyst Internship + PPO", positionType: "JOB_AND_INTERNSHIP" as const, minCtc: 400000, maxCtc: 550000, status: "PUBLISHED" as const },
    { title: "Frontend Developer Intern", positionType: "INTERNSHIP" as const, minCtc: null, maxCtc: null, status: "PUBLISHED" as const },
    { title: "ML Engineer - Analyst Drive", positionType: "JOB" as const, minCtc: 900000, maxCtc: 1600000, status: "REGISTRATION_CLOSED" as const },
    { title: "Cloud Support Associate", positionType: "JOB" as const, minCtc: 400000, maxCtc: 450000, status: "DRAFT" as const },
  ];
  const drives = [];
  for (let i = 0; i < driveDefs.length; i++) {
    const d = driveDefs[i];
    const company = companies[i % companies.length];
    const eligibleCourses = pick(courses, 3 + Math.floor(Math.random() * 3));
    const requiredSkills = pick(skills, 3 + Math.floor(Math.random() * 3));
    const drive = await prisma.drive.create({
      data: {
        collegeId,
        batchId,
        departmentId,
        companyId: company.id,
        createdById: tpo.id,
        title: d.title,
        status: d.status,
        locationCategory: "ON_CAMPUS",
        sourceType: "SELF",
        expectedOpenings: 5 + Math.floor(Math.random() * 20),
        eligibilityCriteria: "No active backlogs. Minimum 60% throughout academics.",
        selectionProcessDetails: "Online Test -> Technical Interview -> HR Interview",
        registrationOpensAt: new Date(Date.now() - 10 * 86400000),
        registrationClosesAt: new Date(Date.now() + (d.status === "PUBLISHED" ? 10 : -3) * 86400000),
        approvedAt: d.status === "DRAFT" ? null : new Date(Date.now() - 9 * 86400000),
        publishedAt: d.status === "DRAFT" ? null : new Date(Date.now() - 9 * 86400000),
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
            openings: 5 + Math.floor(Math.random() * 20),
          },
        },
        historyEntries: { create: { actorId: tpo.id, action: "CREATED" } },
      },
      include: { requiredSkills: { include: { skill: true } }, eligibleCourses: true, positions: true },
    });

    if (d.status !== "DRAFT") {
      const rule = await prisma.driveEligibilityRule.create({
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
      const eligibleCourseIds = new Set(drive.eligibleCourses.map((c) => c.courseId));
      const candidatePopulation = students.filter((s) => eligibleCourseIds.has(s.courseId));
      const snapshot = await prisma.eligibilitySnapshot.create({
        data: { collegeId, driveId: drive.id, ruleVersion: rule.version, studentCount: candidatePopulation.length },
      });
      for (const s of candidatePopulation) {
        const { eligible, checks } = evaluateEligibility(DEFAULT_ELIGIBILITY_LOGIC, {
          cgpa: s.aggregate,
          active_backlogs: s.liveBacklogs,
          batch_year: batch.year,
          course_id: s.courseId,
          department_id: departmentId,
          // DEFAULT_ELIGIBILITY_LOGIC only checks active_backlogs — these
          // are unused by this specific evaluation, filled with neutral
          // defaults just to satisfy the full StudentEligibilityFacts shape.
          tenth_score: null,
          twelfth_score: null,
          diploma_score: null,
          closed_backlogs: 0,
          skill_ids: [],
          has_experience: false,
          has_certification: false,
        });
        await prisma.eligibilityResult.create({
          data: { collegeId, snapshotId: snapshot.id, studentId: s.id, eligible, explanation: checks },
        });
      }
    }
    drives.push(drive);
  }

  // ---- Applications, offers, rounds ----
  for (const drive of drives) {
    if (drive.status === "DRAFT") continue;
    const eligibleCourseIds = new Set(drive.eligibleCourses.map((c) => c.courseId));
    const requiredSkillNames = drive.requiredSkills.map((rs) => rs.skill.name);
    const position = drive.positions[0];
    const eligibleStudents = students.filter((s) => eligibleCourseIds.has(s.courseId));
    const applicants = pick(eligibleStudents, Math.min(eligibleStudents.length, 8 + Math.floor(Math.random() * 10)));

    const round1 = await prisma.selectionRound.create({
      data: { collegeId, driveId: drive.id, name: "Online Assessment", roundType: "Aptitude", sequenceNo: 1, status: "COMPLETED" },
    });
    const round2 = await prisma.selectionRound.create({
      data: { collegeId, driveId: drive.id, name: "Technical Interview", roundType: "Technical", sequenceNo: 2, status: "SCHEDULED" },
    });

    for (const student of applicants) {
      const resume = await prisma.resume.findFirst({ where: { studentId: student.id, isDefault: true } });
      const snapshotResult = await prisma.eligibilityResult.findFirst({
        where: { studentId: student.id, snapshot: { driveId: drive.id } },
      });
      const { matchScore, matchedSkills, missingSkills } = computeMatchScore(student.skillNames, requiredSkillNames);
      const status = rand(["APPLIED", "COLLEGE_APPROVED", "SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED"] as const);
      const application = await prisma.application.create({
        data: {
          collegeId,
          studentId: student.id,
          driveId: drive.id,
          positionId: position.id,
          resumeId: resume?.id,
          eligibilityResultId: snapshotResult?.id,
          status,
          matchScore,
          matchedSkills,
          missingSkills,
          approvedAt: status !== "APPLIED" ? new Date() : null,
          statusHistory: { create: { collegeId, toStatus: "APPLIED", changedById: tpo.id } },
        },
      });
      if (resume) {
        await prisma.resumeUsage.create({ data: { resumeId: resume.id, driveId: drive.id, applicationId: application.id } });
      }

      if (["SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED"].includes(status)) {
        await prisma.roundCandidate.create({
          data: {
            collegeId,
            roundId: round1.id,
            applicationId: application.id,
            studentId: student.id,
            status: "PASSED",
            score: 60 + Math.floor(Math.random() * 40),
            resultPublishedAt: new Date(),
          },
        });
      }
      if (["ROUND_IN_PROGRESS", "SELECTED"].includes(status)) {
        await prisma.roundCandidate.create({
          data: {
            collegeId,
            roundId: round2.id,
            applicationId: application.id,
            studentId: student.id,
            status: status === "SELECTED" ? "PASSED" : "SCHEDULED",
            mode: "ONLINE",
            scheduledAt: new Date(Date.now() + 3 * 86400000),
            meetingUrl: "https://meet.example.com/interview",
            interviewerName: "Panel A",
          },
        });
      }

      if (status === "SELECTED" && Math.random() > 0.4 && position.maxCtc) {
        const offer = await prisma.offer.create({
          data: {
            collegeId,
            applicationId: application.id,
            studentId: student.id,
            driveId: drive.id,
            positionId: position.id,
            offerType: "JOB",
            status: rand(["ISSUED", "ACCEPTED", "JOINING_PENDING", "JOINED"] as const),
            totalCompensation: position.maxCtc,
            fixedCompensation: position.maxCtc,
            offerDate: new Date(),
            issuedAt: new Date(),
          },
        });
        if (offer.status === "ACCEPTED" || offer.status === "JOINING_PENDING" || offer.status === "JOINED") {
          await prisma.offer.update({ where: { id: offer.id }, data: { acceptedAt: new Date() } });
        }
        if (offer.status === "JOINED" || offer.status === "JOINING_PENDING") {
          await prisma.joiningRecord.create({
            data: {
              collegeId,
              offerId: offer.id,
              joiningStatus: offer.status === "JOINED" ? "JOINED" : "PENDING",
              actualJoiningDate: offer.status === "JOINED" ? new Date() : null,
            },
          });
        }
      }
    }
    await recomputeDriveCounters(prisma, drive.id);
  }

  // ---- Contacts ----
  await prisma.contact.create({
    data: { collegeId, companyId: companies[0].id, name: "HR Team", email: "hr@infosys-demo.local", contactType: "Recruiter", addedById: tpo.id },
  });

  // ---- Events & Engagement ----
  const eventSpeaker = await prisma.eventSpeaker.create({
    data: {
      collegeId,
      name: "Atul Bengeri",
      designation: "Founder",
      organization: "MIT India",
      email: "atul.b@mitindia-demo.local",
      bio: "Entrepreneur and innovation consultant working at the intersection of technology and enterprise.",
      createdById: tpo.id,
    },
  });

  const day = 86400000;
  const expertSession = await prisma.event.create({
    data: {
      collegeId,
      createdById: tpo.id,
      category: "EXPERT_SESSION",
      title: "Innovation & Entrepreneurship in the Digital Era",
      description: "A comprehensive session on how digital technologies and innovation are creating new opportunities for entrepreneurship and solving real-world problems.",
      organizerLabel: "CDPC Placement Cell",
      mode: "HYBRID",
      venue: "MIT India",
      startAt: new Date(Date.now() + 3 * day),
      endAt: new Date(Date.now() + 3 * day + 2 * 3600000),
      registrationOpensAt: new Date(Date.now() - 5 * day),
      registrationClosesAt: new Date(Date.now() + 2 * day),
      capacity: 200,
      speakerId: eventSpeaker.id,
      certificateEnabled: true,
      publishedAt: new Date(Date.now() - 5 * day),
    },
  });
  for (const s of students.slice(0, 15)) {
    await prisma.eventRegistration.create({
      data: { eventId: expertSession.id, userId: s.userId, status: Math.random() > 0.15 ? "CONFIRMED" : "WAITLISTED" },
    });
  }

  await prisma.event.create({
    data: {
      collegeId,
      createdById: tpo.id,
      category: "COMPETITION",
      title: "Open Innovation Challenge 2026",
      description: "Apply Design Thinking to solve real-world community problems.",
      organizerLabel: "National Innovation Council",
      mode: "OFFLINE",
      venue: "Seminar Hall",
      startAt: new Date(Date.now() + 18 * day),
      endAt: new Date(Date.now() + 18 * day + 8 * 3600000),
      registrationOpensAt: new Date(Date.now() - 2 * day),
      registrationClosesAt: new Date(Date.now() + 17 * day),
      publishedAt: new Date(Date.now() - 2 * day),
    },
  });

  const liveTalk = await prisma.event.create({
    data: {
      collegeId,
      createdById: tpo.id,
      category: "PRE_PLACEMENT_TALK",
      title: "Pre-Placement Talk: Roadmap to Success",
      description: "Industry insights and roadmap for campus placements.",
      organizerLabel: "CDPC Placement Cell",
      mode: "ONLINE",
      meetingUrl: "https://meet.google.com/demo-ppt",
      startAt: new Date(Date.now() - 30 * 60000),
      endAt: new Date(Date.now() + 60 * 60000),
      registrationOpensAt: new Date(Date.now() - 6 * day),
      registrationClosesAt: new Date(Date.now() - 60 * 60000),
      companyId: companies[0]?.id,
      driveId: drives[0]?.id,
      feedbackEnabled: true,
      publishedAt: new Date(Date.now() - 6 * day),
    },
  });
  for (const s of students.slice(0, 20)) {
    const reg = await prisma.eventRegistration.create({ data: { eventId: liveTalk.id, userId: s.userId, status: "CONFIRMED" } });
    if (Math.random() > 0.3) {
      await prisma.eventAttendance.create({
        data: { eventId: liveTalk.id, userId: reg.userId, checkInAt: new Date(Date.now() - 20 * 60000), method: "MANUAL", markedById: tpo.id },
      });
    }
  }

  await prisma.event.create({
    data: {
      collegeId,
      createdById: tpo.id,
      category: "WORKSHOP",
      title: "Resume Building & LinkedIn Optimization",
      description: "Hands-on workshop to build a strong resume and LinkedIn profile.",
      organizerLabel: "CDPC Placement Cell",
      mode: "OFFLINE",
      venue: "Lab 3, CSE Dept.",
      startAt: new Date(Date.now() + 5 * day),
      endAt: new Date(Date.now() + 5 * day + 2.5 * 3600000),
      registrationOpensAt: new Date(Date.now() - 3 * day),
      registrationClosesAt: new Date(Date.now() + 4 * day),
      eligibleDepartmentIds: [departmentId],
      publishedAt: new Date(Date.now() - 3 * day),
    },
  });

  await prisma.event.create({
    data: {
      collegeId,
      createdById: tpo.id,
      category: "CAREER_FAIR",
      title: "Tech Giants Careers Fair 2026",
      description: "Connect with top tech companies and explore opportunities.",
      organizerLabel: "CDPC Placement Cell",
      mode: "OFFLINE",
      venue: "Main Auditorium",
      startAt: new Date(Date.now() + 25 * day),
      endAt: new Date(Date.now() + 25 * day + 6 * 3600000),
      registrationOpensAt: new Date(Date.now() - 1 * day),
      registrationClosesAt: new Date(Date.now() + 24 * day),
      capacity: 300,
      publishedAt: new Date(Date.now() - 1 * day),
    },
  });

  // A draft event nobody's seen yet — exercises the Drafts tab / status derivation.
  await prisma.event.create({
    data: {
      collegeId,
      createdById: tpo.id,
      category: "TRAINING",
      title: "Aptitude & Reasoning Bootcamp",
      description: "A 3-day intensive bootcamp covering quantitative aptitude, logical reasoning and verbal ability.",
      organizerLabel: "CDPC Placement Cell",
      mode: "OFFLINE",
      venue: "Seminar Hall",
    },
  });

  // ---- Forum ----
  const forum = await prisma.forum.create({ data: { collegeId, title: "Interview Experiences", description: "Share your interview experiences.", createdById: tpo.id } });
  await prisma.forumPost.create({
    data: { forumId: forum.id, authorId: demoStudentUser.id, title: "Infosys interview experience", body: "Had 3 rounds — online test, tech interview, HR. Focus on DSA basics." },
  });

  // ---- Notifications ----
  await prisma.notification.create({
    data: {
      collegeId,
      userId: demoStudentUser.id,
      eventType: "drive.published",
      title: "New placement drive",
      body: `New Placement Drive — '${drives[0].title}' has been published`,
      link: `/opportunities/${drives[0].id}`,
    },
  });

  console.log("\nSeed complete.");
  console.log("-----------------------------------------");
  console.log("TPO login:       tpo@demo.placement-erp.local / Password123!");
  console.log("Student login:   student@demo.placement-erp.local / Password123!");
  console.log("Recruiter login: recruiter@demo.placement-erp.local / Password123!");
  console.log("-----------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
