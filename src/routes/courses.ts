import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { setFlash } from "../middleware/flash";
import { getActiveTerm, getCatalog } from "../services/courses";
import { stringArray } from "../utils/forms";

const router = Router();
const uuidSchema = z.string().uuid();

router.get("/courses", requireAuth, async (req, res, next) => {
  try {
    const term = await getActiveTerm();

    if (!term) {
      return res.render("courses", {
        title: "Courses",
        term: null,
        courses: [],
        currentCredits: 0,
        selectedOfferingIds: new Set<string>(),
        waitlistOfferingIds: new Set<string>(),
      });
    }

    const catalog = await getCatalog(req.user!.id, term);
    const draft = req.session.registrationDraft;
    const draftMatchesTerm = draft?.termId === term.id;

    return res.render("courses", {
      title: "Courses",
      term,
      courses: catalog.courses,
      currentCredits: catalog.currentCredits,
      selectedOfferingIds: new Set(draftMatchesTerm ? draft.offeringIds : []),
      waitlistOfferingIds: new Set(
        draftMatchesTerm ? draft.waitlistOfferingIds : [],
      ),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/courses/select", requireAuth, async (req, res, next) => {
  try {
    const term = await getActiveTerm();
    if (!term) {
      setFlash(req, "error", "There is no open semester for registration.");
      return res.redirect("/courses");
    }

    const offeringIds = [...new Set(stringArray(req.body.offeringIds))];
    const waitlistOfferingIds = [
      ...new Set(stringArray(req.body.waitlistOfferingIds)),
    ].filter((offeringId) => offeringIds.includes(offeringId));

    if (offeringIds.length === 0) {
      setFlash(req, "error", "Select at least one course before continuing.");
      return res.redirect("/courses");
    }

    if (offeringIds.some((offeringId) => !uuidSchema.safeParse(offeringId).success)) {
      setFlash(req, "error", "One or more selected courses were invalid.");
      return res.redirect("/courses");
    }

    const validOfferingCount = await prisma.courseOffering.count({
      where: { id: { in: offeringIds }, termId: term.id },
    });

    if (validOfferingCount !== offeringIds.length) {
      setFlash(req, "error", "One or more selected courses are no longer offered.");
      return res.redirect("/courses");
    }

    req.session.registrationDraft = {
      termId: term.id,
      offeringIds,
      waitlistOfferingIds,
    };

    return res.redirect("/registration/review");
  } catch (error) {
    return next(error);
  }
});

export default router;
