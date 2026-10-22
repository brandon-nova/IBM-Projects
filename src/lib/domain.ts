export type Role = "member" | "admin";
export type ApprovalStatus = "draft" | "pending" | "approved" | "rejected";
export type WorkStatus = "open" | "in_progress" | "completed";
export type SubmissionStatus = "submitted" | "changes_requested" | "accepted";

export function splitSkills(value: string): string[] {
  const seen = new Set<string>();
  return value.split(",").map((v) => v.trim()).filter((v) => {
    if (!v || seen.has(v.toLowerCase())) return false;
    seen.add(v.toLowerCase());
    return true;
  });
}

export function normalizeInterest(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  const aliases: [RegExp, string][] = [
    [/\bpython\b/i, "Python"], [/\bsql\b/i, "SQL"], [/\b(ai|artificial intelligence)\b/i, "AI"],
    [/\b(website|web development|web app)\b/i, "Web development"], [/\bdata engineering\b/i, "Data engineering"],
    [/\b(design|ux|ui)\b/i, "Design"], [/\breact\b/i, "React"], [/\btypescript\b/i, "TypeScript"],
  ];
  return aliases.find(([pattern]) => pattern.test(cleaned))?.[1] ?? cleaned;
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "?";
}

export function safeExternalUrl(value: string): boolean {
  if (value.length > 2048 || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/";
  try {
    const origin = "https://projects.fncai.org";
    const url = new URL(value, origin);
    return url.origin === origin ? url.pathname + url.search : "/";
  } catch { return "/"; }
}

export function hasVerifiedCredit(projectStatus: WorkStatus, submissionStatus?: SubmissionStatus): boolean {
  return projectStatus === "completed" && submissionStatus === "accepted";
}

export const labels = {
  open: "Open", in_progress: "In progress", completed: "Completed",
  draft: "Draft", pending: "Waiting for approval", approved: "Approved", rejected: "Changes needed",
  submitted: "Awaiting review", changes_requested: "Changes requested", accepted: "Accepted",
} as const;
