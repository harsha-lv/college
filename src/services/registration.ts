import { Prisma, type EnrollmentStatus, type Term } from "@prisma/client";
import { prisma } from "../db";

export type RegistrationSelection = {
  offeringId: string;
  joinWaitlist: boolean;
};

export type EvaluationStatus = "READY" | "WAITLIST" | "ERROR";

export type EvaluationItem = {
  offeringId: string;
  courseId: string;
  code: string;
  title: string;
  credits: number;
  facultyName: string;
  room: string | null;
  schedule: string | null;
  capacity: number;
  enrolledCount: number;
  waitlistCount: number;
  availableSeats: number;
  prerequisites: Array<{ code: string; title: string }>;
  missingPrerequisites: string[];
  joinWaitlist: boolean;
  status: EvaluationStatus;
  waitlistPosition: number | null;
  errors: string[];
};

export type Evaluation = {
  term: Term | null;
  items: EvaluationItem[];
  currentCredits: number;
  newCredits: number;
  totalCredits: number;
  maxCredits: number;
  globalErrors: string[];
  hasErrors: boolean;
  canConfirm: boolean;
  waitlistCount: number;
};

export type OfferingEvaluationData = {
  offeringId: string;
  courseId: string;
  code: string;
  title: string;
  credits: number;
  facultyName: string;
  room: string | null;
  schedule: string | null;
  capacity: number;
  enrolledCount: number;
  waitlistCount: number;
  prerequisites: Array<{ id: string; code: string; title: string }>;
  existingStatus: EnrollmentStatus | null;
};

type EvaluationData = {
  term: Term | null;
  selections: RegistrationSelection[];
  offerings: Map<string, OfferingEvaluationData>;
  completedCourseIds: Set<string>;
  currentCredits: number;
};

type DbClient = Prisma.TransactionClient;

export class RegistrationValidationError extends Error {
  constructor(public readonly evaluation: Evaluation) {
    super("Registration could not be completed.");
    this.name = "RegistrationValidationError";
  }
}

export class AlreadyRegisteredError extends Error {
  constructor() {
    super("One or more selected courses are already registered.");
    this.name = "AlreadyRegisteredError";
  }
}

function uniqueSelections(selections: RegistrationSelection[]) {
  const seen = new Set<string>();
  return selections.filter((selection) => {
    if (seen.has(selection.offeringId)) return false;
    seen.add(selection.offeringId);
    return true;
  });
}

async function loadEvaluationData(
  client: DbClient,
  studentId: string,
  termId: string,
  selections: RegistrationSelection[],
): Promise<EvaluationData> {
  const offeringIds = [...new Set(selections.map((selection) => selection.offeringId))];

  const [term, offerings, counts, existing, completed, current] = await Promise.all([
    client.term.findUnique({ where: { id: termId } }),
    offeringIds.length
      ? client.courseOffering.findMany({
          where: { id: { in: offeringIds }, termId },
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
        })
      : Promise.resolve([]),
    offeringIds.length
      ? client.enrollment.groupBy({
          by: ["offeringId", "status"],
          where: { offeringId: { in: offeringIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    offeringIds.length
      ? client.enrollment.findMany({
          where: { studentId, offeringId: { in: offeringIds } },
          select: { offeringId: true, status: true },
        })
      : Promise.resolve([]),
    client.completedCourse.findMany({
      where: { studentId },
      select: { courseId: true },
    }),
    client.enrollment.findMany({
      where: {
        studentId,
        status: "ENROLLED",
        offering: { termId },
      },
      select: {
        offering: {
          select: { course: { select: { credits: true } } },
        },
      },
    }),
  ]);

  const countMap = new Map<string, number>();
  for (const row of counts) {
    countMap.set(`${row.offeringId}:${row.status}`, row._count._all);
  }

  const existingMap = new Map<string, EnrollmentStatus>();
  for (const row of existing) {
    existingMap.set(row.offeringId, row.status);
  }

  const offeringMap = new Map<string, OfferingEvaluationData>();
  for (const offering of offerings) {
    offeringMap.set(offering.id, {
      offeringId: offering.id,
      courseId: offering.courseId,
      code: offering.course.code,
      title: offering.course.title,
      credits: offering.course.credits,
      facultyName: offering.facultyName,
      room: offering.room,
      schedule: offering.schedule,
      capacity: offering.capacity,
      enrolledCount: countMap.get(`${offering.id}:ENROLLED`) ?? 0,
      waitlistCount: countMap.get(`${offering.id}:WAITLISTED`) ?? 0,
      prerequisites: offering.course.prerequisites.map((item) => ({
        id: item.prerequisite.id,
        code: item.prerequisite.code,
        title: item.prerequisite.title,
      })),
      existingStatus: existingMap.get(offering.id) ?? null,
    });
  }

  return {
    term,
    selections,
    offerings: offeringMap,
    completedCourseIds: new Set(completed.map((row) => row.courseId)),
    currentCredits: current.reduce((total, row) => total + row.offering.course.credits, 0),
  };
}

export function evaluateRegistration(input: {
  term: Term | null;
  selections: RegistrationSelection[];
  offerings: Map<string, OfferingEvaluationData>;
  completedCourseIds: Set<string>;
  currentCredits: number;
}): Evaluation {
  const { term, offerings, completedCourseIds, currentCredits } = input;
  const selections = uniqueSelections(input.selections);
  const maxCredits = term?.maxCredits ?? 0;
  const globalErrors: string[] = [];

  if (!term) {
    globalErrors.push("The selected semester is no longer available.");
  } else if (!term.registrationOpen) {
    globalErrors.push("Registration is closed for this semester.");
  }

  if (selections.length === 0) {
    globalErrors.push("Select at least one course.");
  }

  const orderedSelections = [...selections].sort((a, b) => {
    const offeringA = offerings.get(a.offeringId);
    const offeringB = offerings.get(b.offeringId);
    if (!offeringA && !offeringB) return 0;
    if (!offeringA) return 1;
    if (!offeringB) return -1;
    return offeringA.code.localeCompare(offeringB.code);
  });

  let newCredits = 0;
  const items: EvaluationItem[] = [];

  for (const selection of orderedSelections) {
    const offering = offerings.get(selection.offeringId);
    if (!offering) {
      globalErrors.push("One or more selected courses are no longer offered.");
      continue;
    }

    const availableSeats = Math.max(0, offering.capacity - offering.enrolledCount);
    const missing = offering.prerequisites.filter(
      (prerequisite) => !completedCourseIds.has(prerequisite.id),
    );
    const errors: string[] = [];

    if (missing.length > 0) {
      errors.push(
        `Missing prerequisite${missing.length > 1 ? "s" : ""}: ${missing
          .map((prerequisite) => prerequisite.code)
          .join(", ")}.`,
      );
    }

    if (offering.existingStatus === "ENROLLED") {
      errors.push("You are already enrolled in this course.");
    } else if (offering.existingStatus === "WAITLISTED") {
      errors.push("You are already on the waitlist for this course.");
    }

    const full = availableSeats <= 0;
    let status: EvaluationStatus = "READY";
    let waitlistPosition: number | null = null;

    if (full) {
      if (selection.joinWaitlist) {
        status = "WAITLIST";
        waitlistPosition = offering.waitlistCount + 1;
      } else {
        errors.push("This course is full. Select the waitlist option to join the waitlist.");
      }
    }

    if (!full && errors.length === 0) {
      const nextTotal = currentCredits + newCredits + offering.credits;
      if (nextTotal > maxCredits) {
        errors.push(`Adding this course would exceed the ${maxCredits}-credit limit.`);
      }
    }

    if (errors.length > 0) {
      status = "ERROR";
      waitlistPosition = null;
    } else if (status === "READY") {
      newCredits += offering.credits;
    }

    items.push({
      offeringId: offering.offeringId,
      courseId: offering.courseId,
      code: offering.code,
      title: offering.title,
      credits: offering.credits,
      facultyName: offering.facultyName,
      room: offering.room,
      schedule: offering.schedule,
      capacity: offering.capacity,
      enrolledCount: offering.enrolledCount,
      waitlistCount: offering.waitlistCount,
      availableSeats,
      prerequisites: offering.prerequisites.map((prerequisite) => ({
        code: prerequisite.code,
        title: prerequisite.title,
      })),
      missingPrerequisites: missing.map((prerequisite) => prerequisite.code),
      joinWaitlist: selection.joinWaitlist,
      status,
      waitlistPosition,
      errors,
    });
  }

  const hasErrors =
    globalErrors.length > 0 || items.some((item) => item.status === "ERROR");

  return {
    term,
    items,
    currentCredits,
    newCredits,
    totalCredits: currentCredits + newCredits,
    maxCredits,
    globalErrors,
    hasErrors,
    canConfirm: !hasErrors && items.length > 0,
    waitlistCount: items.filter((item) => item.status === "WAITLIST").length,
  };
}

export async function validateRegistration(
  studentId: string,
  termId: string,
  selections: RegistrationSelection[],
) {
  const data = await loadEvaluationData(prisma, studentId, termId, selections);
  return evaluateRegistration(data);
}

function isRetryableTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
  );
}

async function runConfirmation(
  studentId: string,
  termId: string,
  selections: RegistrationSelection[],
) {
  return prisma.$transaction(
    async (tx) => {
      const offeringIds = [...new Set(selections.map((selection) => selection.offeringId))];

      if (offeringIds.length > 0) {
        const idList = Prisma.join(
          offeringIds.map((offeringId) => Prisma.sql`${offeringId}::uuid`),
        );
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "CourseOffering" WHERE id IN (${idList}) ORDER BY id FOR UPDATE`,
        );
      }

      const data = await loadEvaluationData(tx, studentId, termId, selections);
      const evaluation = evaluateRegistration(data);

      if (!evaluation.canConfirm) {
        throw new RegistrationValidationError(evaluation);
      }

      const registration = await tx.registration.create({
        data: { studentId, termId },
      });

      await tx.enrollment.createMany({
        data: evaluation.items.map((item) => ({
          registrationId: registration.id,
          studentId,
          offeringId: item.offeringId,
          status: item.status === "WAITLIST" ? "WAITLISTED" : "ENROLLED",
        })),
      });

      return registration;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10_000,
    },
  );
}

export async function confirmRegistration(
  studentId: string,
  termId: string,
  selections: RegistrationSelection[],
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await runConfirmation(studentId, termId, selections);
    } catch (error) {
      if (error instanceof RegistrationValidationError) throw error;

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AlreadyRegisteredError();
      }

      if (isRetryableTransactionError(error) && attempt < 2) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}
