import { z } from "zod";
import { safeExternalUrl } from "./domain.ts";

const email = z.string().trim().email("Enter a valid email address.").max(254);
const password = z.string().min(12, "Use at least 12 characters.").max(128);
const name = z.string().trim().min(1, "Enter your name.").max(80);
const skillIds = (max: number) => z.array(z.string().uuid("Select skills from the catalog.")).max(max, `Choose up to ${max} skills.`).transform((ids) => [...new Set(ids)]);
const hours = (max: number, allowZero: boolean) => z.string().refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) <= max && (allowZero ? Number(v) >= 0 : Number(v) > 0)), `Enter ${allowZero ? "0" : "more than 0"} to ${max} hours.`);
export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password.") });
const confirmation = z.string().min(1, "Type your password again.").max(128);
const passwordsMatch = (v: { password: string; confirm_password: string }) => v.password === v.confirm_password;
const mismatch = { message: "Passwords do not match.", path: ["confirm_password"] };
export const signupSchema = z.object({ display_name: name, email, password, confirm_password: confirmation }).refine(passwordsMatch, mismatch);
export const resetRequestSchema = z.object({ email });
export const passwordSchema = z.object({ password, confirm_password: confirmation }).refine(passwordsMatch, mismatch);
export const profileSchema = z.object({ display_name: name, bio: z.string().trim().refine((v) => Array.from(v).length <= 360, "Use up to 360 characters."), existing_skills: skillIds(20), learning_skills: skillIds(6), available_hours: hours(168, true) });
export const projectSchema = z.object({
  title: z.string().trim().min(3, "Use at least 3 characters.").max(100),
  description: z.string().trim().min(10, "Tell people what needs to be done.").max(5000),
  skills: skillIds(20).refine((v) => v.length > 0, "Add at least one skill."),
  estimated_hours: hours(10000, false),
});
export const deliverableSchema = z.object({
  url: z.string().trim().refine(safeExternalUrl, "Enter a full http:// or https:// link without embedded credentials.").transform((value) => new URL(value).href),
  summary: z.string().trim().min(10, "Describe what you accomplished in at least 10 characters.").max(2000),
  outcome: z.string().trim().max(1000),
});
export const projectCreateSchema = projectSchema.extend({
  description: projectSchema.shape.description.refine((v) => Array.from(v).length <= 300, "Use up to 300 characters."),
});
export const taskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(160),
  description: z.string().trim().max(2000),
  assignee_id: z.union([z.string().uuid("Choose a participant."), z.literal("")]),
});
export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);
export const boardSettingsSchema = z.object({
  mode: z.enum(["native", "external"]), url: z.string().trim(),
}).superRefine((v, ctx) => {
  if (v.mode === "external" && !safeExternalUrl(v.url)) ctx.addIssue({ code: "custom", path: ["url"], message: "Enter a full HTTP or HTTPS board link without embedded credentials." });
});
export const idSchema = z.string().uuid("Invalid item.");
export const interestSchema = z.string().trim().min(1, "Enter a skill or interest.").max(80);
export const accessSchema = z.object({ email, active: z.enum(["true", "false"]) });
export const projectLinkSchema = z.object({ label: z.string().trim().min(1).max(80), url: deliverableSchema.shape.url });
export const skillRequestSchema = z.object({ name: z.string().trim().min(1).max(80), reason: z.string().trim().max(360) });
