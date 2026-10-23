"use server";
import { mutate } from "@/lib/action-mutation";
import { idSchema, projectLinkSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
export async function saveLink(_: ActionState, form: FormData) {
  return mutate((client) => {
    const v = projectLinkSchema.parse(Object.fromEntries(form));
    return client.rpc("save_project_link", { p_project_id: idSchema.parse(form.get("project_id")), p_label: v.label, p_url: v.url, ...(form.get("link_id") ? { p_link_id: idSchema.parse(form.get("link_id")) } : {}) });
  }, "Link saved.");
}
export async function deleteLink(_: ActionState, form: FormData) {
  return mutate((client) => client.rpc("delete_project_link", { p_link_id: idSchema.parse(form.get("link_id")) }), "Link removed.");
}
