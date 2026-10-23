"use server";
import { z } from "zod";
import { mutate } from "@/lib/action-mutation";
import { idSchema, skillRequestSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
export async function requestSkill(_: ActionState, form: FormData) {
  return mutate((client) => {
    const v = skillRequestSchema.parse(Object.fromEntries(form));
    return client.rpc("request_skill", { p_name: v.name, p_reason: v.reason });
  }, "Skill requested. You can select it after approval.");
}
export async function reviewSkill(_: ActionState, form: FormData) {
  return mutate((client) => client.rpc("review_skill_request", {
    p_request_id: idSchema.parse(form.get("request_id")), p_approve: z.enum(["true","false"]).parse(form.get("approve")) === "true",
    p_feedback: z.string().trim().max(360).parse(form.get("feedback") ?? ""),
  }), "Skill request reviewed.");
}
export async function setSkillActive(_: ActionState, form: FormData) {
  return mutate((client) => client.rpc("set_skill_active", { p_skill_id: idSchema.parse(form.get("skill_id")), p_active: z.enum(["true","false"]).parse(form.get("active")) === "true" }), "Catalog updated.");
}
