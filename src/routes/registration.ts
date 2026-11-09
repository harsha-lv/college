import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { setFlash } from "../middleware/flash";
import { getTerm } from "../services/courses";
import {
  AlreadyRegisteredError,
  RegistrationValidationError,
  confirmRegistration,
  validateRegistration,
  type RegistrationSelection,
} from "../services/registration";

const router = Router();

function selectionsFromDraft(
  offeringIds: string[],
  waitlistOfferingIds: string[],
): RegistrationSelection[] {
  const waitlist = new Set(waitlistOfferingIds);
  return offeringIds.map((offeringId) => ({
    offeringId,
    joinWaitlist: waitlist.has(offeringId),
  }));
}

router.get("/registration/review", requireAuth, async (req, res, next) => {
  try {
    const draft = req.session.registrationDraft;
    if (!draft || draft.offeringIds.length === 0) {
      setFlash(req, "info", "Select courses before reviewing your registration.");
      return res.redirect("/courses");
    }

    const term = await getTerm(draft.termId);
    if (!term) {
      delete req.session.registrationDraft;
      setFlash(req, "error", "The selected semester is no longer available.");
      return res.redirect("/courses");
    }

    const evaluation = await validateRegistration(
      req.user!.id,
      draft.termId,
      selectionsFromDraft(draft.offeringIds, draft.waitlistOfferingIds),
    );

    return res.render("review", {
      title: "Review registration",
      evaluation,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/registration/confirm", requireAuth, async (req, res, next) => {
  const draft = req.session.registrationDraft;

  if (!draft || draft.offeringIds.length === 0) {
    setFlash(req, "info", "Select courses before confirming your registration.");
    return res.redirect("/courses");
  }

  try {
    const registration = await confirmRegistration(
      req.user!.id,
      draft.termId,
      selectionsFromDraft(draft.offeringIds, draft.waitlistOfferingIds),
    );

    delete req.session.registrationDraft;
    setFlash(req, "success", "Registration confirmed.");
    return res.redirect(`/registrations/${registration.id}`);
  } catch (error) {
    if (error instanceof RegistrationValidationError) {
      return res.status(409).render("review", {
        title: "Review registration",
        evaluation: error.evaluation,
        confirmError:
          "Nothing was registered. Review the issues below, then update your selection.",
      });
    }

    if (error instanceof AlreadyRegisteredError) {
      delete req.session.registrationDraft;
      setFlash(req, "error", error.message);
      return res.redirect("/courses");
    }

    return next(error);
  }
});

export default router;
