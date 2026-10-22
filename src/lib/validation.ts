import { z } from "zod";
import { safeExternalUrl, splitSkills } from "./domain";

const email = z.string().trim().email("Enter a valid email address.").max(254);
const password = z.string().min(12, "Use at least 12 characters.").max(128);
const name = z.string().trim().min(1, "Enter your name.").max(80);
const skillList = z.string().max(1700).refine((v) => splitSkills(v).length <= 20 && splitSkills(v).every((s) => s.length <= 80), "Use up to 20 skills, each under 81 characters.");
const hours = (max: number, allowZero: boolean) => z.string().refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) <= max && (allowZero ? Number(v) >= 0 : Number(v) > 0)), `Enter ${allowZero ? "0" : "more than 0"} to ${max} hours.`);
export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password.") });
export const signupSchema = z.object({ display_name: name, email, password });
export const resetRequestSchema = z.object({ email });
export const passwordSchema = z.object({ password });
export const profileSchema = z.object({ display_name: name, bio: z.string().trim().max(500), existing_skills: skillList, learning_skills: skillList, available_hours: hours(168, true) });
export const projectSchema = z.object({
  title: z.string().trim().min(3, "Use at least 3 characters.").max(100),
  description: z.string().trim().min(10, "Tell people what needs to be done.").max(5000),
  skills: skillList.refine((v) => splitSkills(v).length > 0, "Add at least one skill."),
  estimated_hours: hours(10000, false),
});
export const deliverableSchema = z.object({
  url: z.string().trim().refine(safeExternalUrl, "Enter a full http:// or https:// link without embedded credentials."),
  summary: z.string().trim().min(10, "Describe what you accomplished in at least 10 characters.").max(2000),
  outcome: z.string().trim().max(1000),
});
export const idSchema = z.string().uuid("Invalid item.");
export const interestSchema = z.string().trim().min(1, "Enter a skill or interest.").max(80);
export const accessSchema = z.object({ email, active: z.enum(["true", "false"]) });
