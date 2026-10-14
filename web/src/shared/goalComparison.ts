export function relatedSkill(a: string, b: string) {
  const clean = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9+#.]+/g, " ")
      .trim();
  const first = clean(a),
    second = clean(b);
  if (!first || !second) return false;
  if (first === second) return true;
  const ignored = new Set([
    "skills",
    "knowledge",
    "basic",
    "manage",
    "apply",
    "perform",
    "develop",
    "systems",
    "become",
    "learn",
    "with",
    "your",
    "career",
    "data",
    "engineer",
    "engineering",
    "safety",
    "management",
    "support",
    "technical",
    "information",
    "technology",
    "experience",
    "services",
  ]);
  const tokens = (text: string) =>
    text.split(" ").filter((token) => token.length > 3 && !ignored.has(token));
  return tokens(first).some((token) => tokens(second).includes(token));
}
