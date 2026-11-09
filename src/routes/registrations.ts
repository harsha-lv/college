import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import {
  getAcademicRecord,
  getRegistration,
  getStudentRegistrations,
} from "../services/registrations";

const router = Router();
const uuidSchema = z.string().uuid();

router.get("/registrations", requireAuth, async (req, res, next) => {
  try {
    const registrations = await getStudentRegistrations(req.user!.id);
    return res.render("registrations", {
      title: "My registrations",
      registrations,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/registrations/:id", requireAuth, async (req, res, next) => {
  try {
    const registrationId = typeof req.params.id === "string" ? req.params.id : "";

    if (!uuidSchema.safeParse(registrationId).success) {
      return res.status(404).render("404", {
        title: "Registration not found",
        message: "The registration you requested does not exist.",
      });
    }

    const registration = await getRegistration(req.user!.id, registrationId);
    if (!registration) {
      return res.status(404).render("404", {
        title: "Registration not found",
        message: "The registration you requested does not exist.",
      });
    }

    return res.render("confirmation", {
      title: "Registration details",
      registration,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/records", requireAuth, async (req, res, next) => {
  try {
    const record = await getAcademicRecord(req.user!.id);
    return res.render("records", {
      title: "Academic record",
      record,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
