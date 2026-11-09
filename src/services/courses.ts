import type { EnrollmentStatus, Term } from "@prisma/client";
import { prisma } from "../db";

export type CatalogPrerequisite = {
  code: string;
  title: string;
};

export type CatalogCourse = {
  offeringId: string;
  courseId: string;
  code: string;
  title: string;
  description: string | null;
  credits: number;
  facultyName: string;
  room: string | null;
  schedule: string | null;
  capacity: number;
  enrolledCount: number;
  waitlistCount: number;
  availableSeats: number;
  prerequisites: CatalogPrerequisite[];
  missingPrerequisites: string[];
  studentStatus: EnrollmentStatus | null;
  completed: boolean;
};

export type Catalog = {
  term: Term;
  courses: CatalogCourse[];
  currentCredits: number;
  completedCourseIds: Set<string>;
};

export async function getActiveTerm() {
  return prisma.term.findFirst({
    where: { registrationOpen: true },
    orderBy: { startsOn: "desc" },
  });
}

export async function getTerm(termId: string) {
  return prisma.term.findUnique({ where: { id: termId } });
}

export async function getCompletedCourseIds(studentId: string) {
  const rows = await prisma.completedCourse.findMany({
    where: { studentId },
    select: { courseId: true },
  });
  return new Set(rows.map((row) => row.courseId));
}

export async function getCurrentCredits(studentId: string, termId: string) {
  const rows = await prisma.enrollment.findMany({
    where: {
      studentId,
      status: "ENROLLED",
      offering: { termId },
    },
    select: {
      offering: {
        select: {
          course: { select: { credits: true } },
        },
      },
    },
  });

  return rows.reduce((total, row) => total + row.offering.course.credits, 0);
}

export async function getCatalog(studentId: string, term: Term): Promise<Catalog> {
  const offerings = await prisma.courseOffering.findMany({
    where: { termId: term.id },
    include: {
      course: {
        include: {
          prerequisites: {
            include: {
              prerequisite: {
                select: { id: true, code: true, title: true },
              },
            },
          },
        },
      },
    },
  });

  const offeringIds = offerings.map((offering) => offering.id);

  const [counts, existingEnrollments, completedCourseIds, currentCredits] = await Promise.all([
    prisma.enrollment.groupBy({
      by: ["offeringId", "status"],
      where: { offeringId: { in: offeringIds } },
      _count: { _all: true },
    }),
    prisma.enrollment.findMany({
      where: { studentId, offeringId: { in: offeringIds } },
      select: { offeringId: true, status: true },
    }),
    getCompletedCourseIds(studentId),
    getCurrentCredits(studentId, term.id),
  ]);

  const countMap = new Map<string, number>();
  for (const row of counts) {
    countMap.set(`${row.offeringId}:${row.status}`, row._count._all);
  }

  const existingMap = new Map<string, EnrollmentStatus>();
  for (const row of existingEnrollments) {
    existingMap.set(row.offeringId, row.status);
  }

  const courses: CatalogCourse[] = offerings
    .map((offering) => {
      const enrolledCount = countMap.get(`${offering.id}:ENROLLED`) ?? 0;
      const waitlistCount = countMap.get(`${offering.id}:WAITLISTED`) ?? 0;
      const prerequisites = offering.course.prerequisites.map((item) => ({
        code: item.prerequisite.code,
        title: item.prerequisite.title,
      }));
      const missingPrerequisites = offering.course.prerequisites
        .filter((item) => !completedCourseIds.has(item.prerequisite.id))
        .map((item) => item.prerequisite.code);

      return {
        offeringId: offering.id,
        courseId: offering.courseId,
        code: offering.course.code,
        title: offering.course.title,
        description: offering.course.description,
        credits: offering.course.credits,
        facultyName: offering.facultyName,
        room: offering.room,
        schedule: offering.schedule,
        capacity: offering.capacity,
        enrolledCount,
        waitlistCount,
        availableSeats: Math.max(0, offering.capacity - enrolledCount),
        prerequisites,
        missingPrerequisites,
        studentStatus: existingMap.get(offering.id) ?? null,
        completed: completedCourseIds.has(offering.courseId),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    term,
    courses,
    currentCredits,
    completedCourseIds,
  };
}
