import type { EnrollmentStatus, Term } from "@prisma/client";
import { prisma } from "../db";

export type RegistrationCourse = {
  enrollmentId: string;
  offeringId: string;
  code: string;
  title: string;
  credits: number;
  facultyName: string;
  room: string | null;
  schedule: string | null;
  status: EnrollmentStatus;
  waitlistPosition: number | null;
};

export type RegistrationRecord = {
  id: string;
  createdAt: Date;
  term: Term;
  courses: RegistrationCourse[];
  enrolledCredits: number;
  waitlistCount: number;
};

export type AcademicRecord = {
  completedCourses: Array<{
    courseId: string;
    code: string;
    title: string;
    credits: number;
    grade: string;
    completedTerm: string | null;
    completedAt: Date;
  }>;
  registrations: RegistrationRecord[];
};

type RegistrationWithRelations = {
  id: string;
  createdAt: Date;
  term: Term;
  enrollments: Array<{
    id: string;
    offeringId: string;
    status: EnrollmentStatus;
    offering: {
      facultyName: string;
      room: string | null;
      schedule: string | null;
      course: {
        code: string;
        title: string;
        credits: number;
      };
    };
  }>;
};

async function waitlistPositionsFor(enrollments: RegistrationWithRelations["enrollments"]) {
  const offeringIds = [
    ...new Set(
      enrollments
        .filter((enrollment) => enrollment.status === "WAITLISTED")
        .map((enrollment) => enrollment.offeringId),
    ),
  ];

  if (offeringIds.length === 0) return new Map<string, number>();

  const waitlisted = await prisma.enrollment.findMany({
    where: {
      offeringId: { in: offeringIds },
      status: "WAITLISTED",
    },
    orderBy: [{ offeringId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { id: true, offeringId: true },
  });

  const positions = new Map<string, number>();
  const counters = new Map<string, number>();

  for (const row of waitlisted) {
    const next = (counters.get(row.offeringId) ?? 0) + 1;
    counters.set(row.offeringId, next);
    positions.set(row.id, next);
  }

  return positions;
}

function toRegistrationRecord(
  registration: RegistrationWithRelations,
  positions: Map<string, number>,
): RegistrationRecord {
  const courses: RegistrationCourse[] = registration.enrollments
    .map((enrollment) => ({
      enrollmentId: enrollment.id,
      offeringId: enrollment.offeringId,
      code: enrollment.offering.course.code,
      title: enrollment.offering.course.title,
      credits: enrollment.offering.course.credits,
      facultyName: enrollment.offering.facultyName,
      room: enrollment.offering.room,
      schedule: enrollment.offering.schedule,
      status: enrollment.status,
      waitlistPosition:
        enrollment.status === "WAITLISTED" ? positions.get(enrollment.id) ?? null : null,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    id: registration.id,
    createdAt: registration.createdAt,
    term: registration.term,
    courses,
    enrolledCredits: courses
      .filter((course) => course.status === "ENROLLED")
      .reduce((total, course) => total + course.credits, 0),
    waitlistCount: courses.filter((course) => course.status === "WAITLISTED").length,
  };
}

async function mapRegistrations(registrations: RegistrationWithRelations[]) {
  const allEnrollments = registrations.flatMap((registration) => registration.enrollments);
  const positions = await waitlistPositionsFor(allEnrollments);
  return registrations.map((registration) => toRegistrationRecord(registration, positions));
}

export async function getStudentRegistrations(studentId: string) {
  const registrations = await prisma.registration.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    include: {
      term: true,
      enrollments: {
        orderBy: { createdAt: "asc" },
        include: {
          offering: {
            include: {
              course: {
                select: { code: true, title: true, credits: true },
              },
            },
          },
        },
      },
    },
  });

  return mapRegistrations(registrations);
}

export async function getRegistration(studentId: string, registrationId: string) {
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, studentId },
    include: {
      term: true,
      enrollments: {
        orderBy: { createdAt: "asc" },
        include: {
          offering: {
            include: {
              course: {
                select: { code: true, title: true, credits: true },
              },
            },
          },
        },
      },
    },
  });

  if (!registration) return null;

  const [record] = await mapRegistrations([registration]);
  return record;
}

export async function getAcademicRecord(studentId: string): Promise<AcademicRecord> {
  const [completed, registrations] = await Promise.all([
    prisma.completedCourse.findMany({
      where: { studentId },
      orderBy: { completedAt: "desc" },
      include: {
        course: {
          select: { id: true, code: true, title: true, credits: true },
        },
      },
    }),
    getStudentRegistrations(studentId),
  ]);

  return {
    completedCourses: completed.map((row) => ({
      courseId: row.course.id,
      code: row.course.code,
      title: row.course.title,
      credits: row.course.credits,
      grade: row.grade,
      completedTerm: row.completedTerm,
      completedAt: row.completedAt,
    })),
    registrations,
  };
}
