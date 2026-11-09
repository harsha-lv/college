import { PrismaClient, EnrollmentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Student123!";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const alice = await prisma.student.upsert({
    where: { email: "alice@college.edu" },
    update: { fullName: "Alice Morgan", studentNumber: "STU-2026-001", passwordHash },
    create: {
      fullName: "Alice Morgan",
      email: "alice@college.edu",
      studentNumber: "STU-2026-001",
      passwordHash,
    },
  });

  const bob = await prisma.student.upsert({
    where: { email: "bob@college.edu" },
    update: { fullName: "Bob Chen", studentNumber: "STU-2026-002", passwordHash },
    create: {
      fullName: "Bob Chen",
      email: "bob@college.edu",
      studentNumber: "STU-2026-002",
      passwordHash,
    },
  });

  const carol = await prisma.student.upsert({
    where: { email: "carol@college.edu" },
    update: { fullName: "Carol Diaz", studentNumber: "STU-2026-003", passwordHash },
    create: {
      fullName: "Carol Diaz",
      email: "carol@college.edu",
      studentNumber: "STU-2026-003",
      passwordHash,
    },
  });

  const term = await prisma.term.upsert({
    where: { name: "Fall 2026" },
    update: {
      startsOn: new Date("2026-08-24T00:00:00.000Z"),
      endsOn: new Date("2026-12-11T00:00:00.000Z"),
      maxCredits: 18,
      registrationOpen: true,
    },
    create: {
      name: "Fall 2026",
      startsOn: new Date("2026-08-24T00:00:00.000Z"),
      endsOn: new Date("2026-12-11T00:00:00.000Z"),
      maxCredits: 18,
      registrationOpen: true,
    },
  });

  const courseData = [
    {
      code: "CS101",
      title: "Introduction to Programming",
      description: "Variables, control flow, functions, and an introduction to problem solving with code.",
      credits: 3,
    },
    {
      code: "CS102",
      title: "Data Structures",
      description: "Arrays, linked lists, stacks, queues, trees, hash tables, and algorithm analysis.",
      credits: 4,
    },
    {
      code: "CS110",
      title: "Web Development",
      description: "Fundamentals of building accessible, data-driven web applications.",
      credits: 3,
    },
    {
      code: "CS201",
      title: "Algorithms",
      description: "Sorting, searching, graph algorithms, dynamic programming, and complexity.",
      credits: 4,
    },
    {
      code: "CS301",
      title: "Databases",
      description: "Relational modelling, SQL, transactions, indexes, and application data access.",
      credits: 3,
    },
    {
      code: "CS302",
      title: "Operating Systems",
      description: "Processes, threads, memory, file systems, and concurrency.",
      credits: 4,
    },
    {
      code: "MATH101",
      title: "Calculus I",
      description: "Limits, derivatives, integrals, and applications.",
      credits: 4,
    },
    {
      code: "MATH201",
      title: "Linear Algebra",
      description: "Vectors, matrices, linear transformations, and eigenvalues.",
      credits: 3,
    },
    {
      code: "STAT101",
      title: "Introduction to Statistics",
      description: "Descriptive statistics, probability, sampling, and inference.",
      credits: 3,
    },
    {
      code: "PHYS101",
      title: "Physics I",
      description: "Mechanics, motion, energy, momentum, and introductory thermodynamics.",
      credits: 4,
    },
    {
      code: "ENG101",
      title: "English Composition",
      description: "Academic writing, research, argument, and revision.",
      credits: 3,
    },
    {
      code: "BUS101",
      title: "Introduction to Business",
      description: "Organizations, markets, operations, and business decision making.",
      credits: 3,
    },
    {
      code: "ART101",
      title: "Introduction to Drawing",
      description: "Observation, line, form, composition, and studio practice.",
      credits: 2,
    },
  ];

  const courses = new Map<string, { id: string; credits: number }>();

  for (const item of courseData) {
    const course = await prisma.course.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    });
    courses.set(item.code, { id: course.id, credits: course.credits });
  }

  const prerequisites: Array<[string, string]> = [
    ["CS102", "CS101"],
    ["CS201", "CS102"],
    ["CS201", "MATH101"],
    ["CS301", "CS102"],
    ["CS302", "CS102"],
    ["MATH201", "MATH101"],
    ["STAT101", "MATH101"],
    ["PHYS101", "MATH101"],
  ];

  for (const [courseCode, prerequisiteCode] of prerequisites) {
    const course = courses.get(courseCode);
    const prerequisite = courses.get(prerequisiteCode);
    if (!course || !prerequisite) continue;

    await prisma.prerequisite.upsert({
      where: {
        courseId_prerequisiteId: {
          courseId: course.id,
          prerequisiteId: prerequisite.id,
        },
      },
      update: {},
      create: {
        courseId: course.id,
        prerequisiteId: prerequisite.id,
      },
    });
  }

  const offeringData = [
    {
      code: "CS101",
      facultyName: "Dr. Elena Ruiz",
      room: "A-201",
      schedule: "Mon / Wed 09:00-10:15",
      capacity: 40,
    },
    {
      code: "CS102",
      facultyName: "Dr. Marcus Lee",
      room: "B-104",
      schedule: "Tue / Thu 10:30-11:45",
      capacity: 35,
    },
    {
      code: "CS110",
      facultyName: "Prof. Nina Patel",
      room: "Lab C-1",
      schedule: "Fri 13:00-15:45",
      capacity: 24,
    },
    {
      code: "CS201",
      facultyName: "Dr. Priya Nair",
      room: "A-310",
      schedule: "Mon / Wed 13:00-14:15",
      capacity: 30,
    },
    {
      code: "CS301",
      facultyName: "Dr. Samuel Okafor",
      room: "Lab C-2",
      schedule: "Fri 09:00-11:45",
      capacity: 24,
    },
    {
      code: "CS302",
      facultyName: "Dr. Hannah Park",
      room: "B-210",
      schedule: "Tue / Thu 14:00-15:15",
      capacity: 28,
    },
    {
      code: "MATH101",
      facultyName: "Dr. Luis Romero",
      room: "M-101",
      schedule: "Mon / Wed / Fri 08:00-08:50",
      capacity: 45,
    },
    {
      code: "MATH201",
      facultyName: "Dr. Aisha Rahman",
      room: "M-204",
      schedule: "Tue / Thu 09:00-10:15",
      capacity: 30,
    },
    {
      code: "STAT101",
      facultyName: "Dr. Owen Wright",
      room: "M-112",
      schedule: "Mon / Wed 11:00-12:15",
      capacity: 32,
    },
    {
      code: "PHYS101",
      facultyName: "Dr. Kenji Watanabe",
      room: "S-110",
      schedule: "Mon / Wed 15:30-16:45",
      capacity: 36,
    },
    {
      code: "ENG101",
      facultyName: "Prof. Laura Bennett",
      room: "H-105",
      schedule: "Tue / Thu 11:00-12:15",
      capacity: 40,
    },
    {
      code: "BUS101",
      facultyName: "Prof. Daniel Kim",
      room: "E-120",
      schedule: "Wed 14:00-16:45",
      capacity: 50,
    },
    {
      code: "ART101",
      facultyName: "Prof. Maya Singh",
      room: "Studio 3",
      schedule: "Thu 15:00-17:45",
      capacity: 1,
    },
  ];

  const offerings = new Map<string, string>();

  for (const item of offeringData) {
    const course = courses.get(item.code);
    if (!course) continue;

    const offering = await prisma.courseOffering.upsert({
      where: {
        courseId_termId: {
          courseId: course.id,
          termId: term.id,
        },
      },
      update: {
        facultyName: item.facultyName,
        room: item.room,
        schedule: item.schedule,
        capacity: item.capacity,
      },
      create: {
        courseId: course.id,
        termId: term.id,
        facultyName: item.facultyName,
        room: item.room,
        schedule: item.schedule,
        capacity: item.capacity,
      },
    });

    offerings.set(item.code, offering.id);
  }

  const completedData = [
    { studentId: alice.id, code: "CS101", grade: "A", completedTerm: "Spring 2026" },
    { studentId: alice.id, code: "MATH101", grade: "B+", completedTerm: "Spring 2026" },
    { studentId: alice.id, code: "ENG101", grade: "A-", completedTerm: "Fall 2025" },
    { studentId: bob.id, code: "ENG101", grade: "B", completedTerm: "Spring 2026" },
    { studentId: carol.id, code: "CS101", grade: "A", completedTerm: "Fall 2025" },
    { studentId: carol.id, code: "CS102", grade: "B", completedTerm: "Spring 2026" },
  ];

  for (const item of completedData) {
    const course = courses.get(item.code);
    if (!course) continue;

    await prisma.completedCourse.upsert({
      where: {
        studentId_courseId: {
          studentId: item.studentId,
          courseId: course.id,
        },
      },
      update: {
        grade: item.grade,
        completedTerm: item.completedTerm,
      },
      create: {
        studentId: item.studentId,
        courseId: course.id,
        grade: item.grade,
        completedTerm: item.completedTerm,
      },
    });
  }

  const artOfferingId = offerings.get("ART101");
  if (artOfferingId) {
    let carolRegistration = await prisma.registration.findFirst({
      where: { studentId: carol.id, termId: term.id },
      orderBy: { createdAt: "asc" },
    });

    if (!carolRegistration) {
      carolRegistration = await prisma.registration.create({
        data: { studentId: carol.id, termId: term.id },
      });
    }

    await prisma.enrollment.upsert({
      where: {
        studentId_offeringId: {
          studentId: carol.id,
          offeringId: artOfferingId,
        },
      },
      update: { status: EnrollmentStatus.ENROLLED },
      create: {
        registrationId: carolRegistration.id,
        studentId: carol.id,
        offeringId: artOfferingId,
        status: EnrollmentStatus.ENROLLED,
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Demo password for all students: ${DEMO_PASSWORD}`);
  console.log("  alice@college.edu  (prerequisites completed)");
  console.log("  bob@college.edu    (missing CS101 prerequisite)");
  console.log("  carol@college.edu  (holds the last ART101 seat)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
