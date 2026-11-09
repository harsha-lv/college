export function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  return [];
}

export function safeNextPath(value: unknown) {
  if (typeof value !== "string") return "/courses";
  if (!value.startsWith("/") || value.startsWith("//")) return "/courses";
  if (value.startsWith("/login")) return "/courses";
  return value;
}
