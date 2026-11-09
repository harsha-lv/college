import type { Term } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  evaluateRegistration,
  type OfferingEvaluationData,
} from "../src/services/registration";

const term: Term = {
  id: "term-1",
  name: "Fall 2026",
  startsOn: new Date("2026-08-24T00:00:00.000Z"),
  endsOn: new Date("2026-12-11T00:00:00.000Z"),
  maxCredits: 18,
  registrationOpen: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

function offering(
  overrides: Partial<OfferingEvaluationData> = {},
): OfferingEvaluationData {
  return {
    offeringId: "offering-1",
    courseId: "course-1",
    code: "CS102",
    title: "Data Structures",
    credits: 4,
    facultyName: "Dr. Marcus Lee",
    room: "B-104",
    schedule: "Tue / Thu 10:30-11:45",
    capacity: 35,
    enrolledCount: 10,
    waitlistCount: 0,
    prerequisites: [],
    existingStatus: null,
    ...overrides,
  };
}

function evaluate(
  selections: Array<{ offeringId: string; joinWaitlist?: boolean }>,
  offerings: OfferingEvaluationData[],
  options: {
    completedCourseIds?: string[];
    currentCredits?: number;
    activeTerm?: Term | null;
  } = {},
) {
  return evaluateRegistration({
    term: options.activeTerm === undefined ? term : options.activeTerm,
    selections: selections.map((selection) => ({
      offeringId: selection.offeringId,
      joinWaitlist: selection.joinWaitlist ?? false,
    })),
    offerings: new Map(offerings.map((item) => [item.offeringId, item])),
    completedCourseIds: new Set(options.completedCourseIds ?? []),
    currentCredits: options.currentCredits ?? 0,
  });
}

describe("evaluateRegistration", () => {
  it("marks an eligible course as ready and counts its credits", () => {
    const result = evaluate([{ offeringId: "offering-1" }], [offering()]);

    expect(result.hasErrors).toBe(false);
    expect(result.canConfirm).toBe(true);
    expect(result.items[0].status).toBe("READY");
    expect(result.newCredits).toBe(4);
    expect(result.totalCredits).toBe(4);
  });

  it("blocks a course when a prerequisite is missing", () => {
    const result = evaluate([{ offeringId: "offering-1" }], [
      offering({
        prerequisites: [{ id: "course-0", code: "CS101", title: "Intro" }],
      }),
    ]);

    expect(result.hasErrors).toBe(true);
    expect(result.canConfirm).toBe(false);
    expect(result.items[0].status).toBe("ERROR");
    expect(result.items[0].errors).toContain("Missing prerequisite: CS101.");
  });

  it("allows a course when all prerequisites are completed", () => {
    const result = evaluate(
      [{ offeringId: "offering-1" }],
      [
        offering({
          prerequisites: [{ id: "course-0", code: "CS101", title: "Intro" }],
        }),
      ],
      { completedCourseIds: ["course-0"] },
    );

    expect(result.hasErrors).toBe(false);
    expect(result.items[0].status).toBe("READY");
  });

  it("blocks a full course when the waitlist option is not selected", () => {
    const result = evaluate([{ offeringId: "offering-1" }], [
      offering({ capacity: 10, enrolledCount: 10 }),
    ]);

    expect(result.hasErrors).toBe(true);
    expect(result.items[0].status).toBe("ERROR");
    expect(result.items[0].errors[0]).toContain("course is full");
  });

  it("places a full course on the waitlist when selected", () => {
    const result = evaluate(
      [{ offeringId: "offering-1", joinWaitlist: true }],
      [offering({ capacity: 10, enrolledCount: 10, waitlistCount: 1 })],
    );

    expect(result.hasErrors).toBe(false);
    expect(result.canConfirm).toBe(true);
    expect(result.items[0].status).toBe("WAITLIST");
    expect(result.items[0].waitlistPosition).toBe(2);
    expect(result.newCredits).toBe(0);
    expect(result.waitlistCount).toBe(1);
  });

  it("does not count waitlisted credits toward the limit", () => {
    const result = evaluate(
      [
        { offeringId: "offering-1", joinWaitlist: true },
        { offeringId: "offering-2" },
      ],
      [
        offering({ capacity: 1, enrolledCount: 1 }),
        offering({ offeringId: "offering-2", code: "CS110", credits: 3 }),
      ],
      { currentCredits: 16 },
    );

    expect(result.hasErrors).toBe(true);
    expect(result.items.find((item) => item.offeringId === "offering-1")?.status).toBe(
      "WAITLIST",
    );
    expect(result.items.find((item) => item.offeringId === "offering-2")?.status).toBe(
      "ERROR",
    );
  });

  it("blocks a course that would exceed the credit limit", () => {
    const result = evaluate([{ offeringId: "offering-1" }], [offering()], {
      currentCredits: 15,
    });

    expect(result.hasErrors).toBe(true);
    expect(result.items[0].status).toBe("ERROR");
    expect(result.items[0].errors[0]).toContain("18-credit limit");
  });

  it("blocks a course the student is already enrolled in", () => {
    const result = evaluate([{ offeringId: "offering-1" }], [
      offering({ existingStatus: "ENROLLED" }),
    ]);

    expect(result.hasErrors).toBe(true);
    expect(result.items[0].errors).toContain(
      "You are already enrolled in this course.",
    );
  });

  it("blocks a course the student is already waitlisted for", () => {
    const result = evaluate([{ offeringId: "offering-1" }], [
      offering({ existingStatus: "WAITLISTED" }),
    ]);

    expect(result.hasErrors).toBe(true);
    expect(result.items[0].errors).toContain(
      "You are already on the waitlist for this course.",
    );
  });

  it("blocks registration when the term is closed", () => {
    const result = evaluate([{ offeringId: "offering-1" }], [offering()], {
      activeTerm: { ...term, registrationOpen: false },
    });

    expect(result.hasErrors).toBe(true);
    expect(result.canConfirm).toBe(false);
    expect(result.globalErrors).toContain("Registration is closed for this semester.");
  });

  it("requires at least one course", () => {
    const result = evaluate([], [offering()]);

    expect(result.hasErrors).toBe(true);
    expect(result.canConfirm).toBe(false);
    expect(result.globalErrors).toContain("Select at least one course.");
  });
});
