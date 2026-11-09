export type FlashType = "success" | "error" | "info";

export type FlashMessage = {
  type: FlashType;
  message: string;
};

export type RegistrationDraft = {
  termId: string;
  offeringIds: string[];
  waitlistOfferingIds: string[];
};
