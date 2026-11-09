-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ENROLLED', 'WAITLISTED');

-- CreateTable
CREATE TABLE "Student" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "maxCredits" INTEGER NOT NULL DEFAULT 18,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "credits" INTEGER NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prerequisite" (
    "courseId" UUID NOT NULL,
    "prerequisiteId" UUID NOT NULL,

    CONSTRAINT "Prerequisite_pkey" PRIMARY KEY ("courseId","prerequisiteId")
);

-- CreateTable
CREATE TABLE "CourseOffering" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "facultyName" TEXT NOT NULL,
    "room" TEXT,
    "schedule" TEXT,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletedCourse" (
    "studentId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "grade" TEXT NOT NULL,
    "completedTerm" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompletedCourse_pkey" PRIMARY KEY ("studentId","courseId")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "status" "EnrollmentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentNumber_key" ON "Student"("studentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Term_name_key" ON "Term"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE INDEX "CourseOffering_termId_idx" ON "CourseOffering"("termId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOffering_courseId_termId_key" ON "CourseOffering"("courseId", "termId");

-- CreateIndex
CREATE INDEX "CompletedCourse_studentId_idx" ON "CompletedCourse"("studentId");

-- CreateIndex
CREATE INDEX "Registration_studentId_createdAt_idx" ON "Registration"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "Registration_termId_idx" ON "Registration"("termId");

-- CreateIndex
CREATE INDEX "Enrollment_offeringId_status_idx" ON "Enrollment"("offeringId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_studentId_status_idx" ON "Enrollment"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_offeringId_key" ON "Enrollment"("studentId", "offeringId");

-- AddForeignKey
ALTER TABLE "Prerequisite" ADD CONSTRAINT "Prerequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prerequisite" ADD CONSTRAINT "Prerequisite_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletedCourse" ADD CONSTRAINT "CompletedCourse_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletedCourse" ADD CONSTRAINT "CompletedCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
