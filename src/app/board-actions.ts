"use server";
import { z } from "zod";
import { mutate } from "@/lib/action-mutation";
import type { ActionState } from "@/lib/action-state";
import { boardSettingsSchema, idSchema, taskSchema, taskStatusSchema } from "@/lib/validation";

export async function saveTask(_: ActionState, form: FormData) {
  return mutate((client) => {
    const input=taskSchema.parse({title:form.get("title"),description:form.get("description") ?? "",assignee_id:form.get("assignee_id") ?? ""});
    return client.rpc("save_project_task",{
      p_project_id:idSchema.parse(form.get("project_id")),p_task_id:form.get("task_id") ? idSchema.parse(form.get("task_id")) : null,
      p_title:input.title,p_description:input.description,p_assignee_id:input.assignee_id || null,
    });
  },"Task saved.");
}
export async function moveTask(_: ActionState, form: FormData) {
  return mutate((client) => client.rpc("move_project_task",{
    p_project_id:idSchema.parse(form.get("project_id")),p_task_id:idSchema.parse(form.get("task_id")),p_status:taskStatusSchema.parse(form.get("status")),
  }),"Task moved.");
}
export async function deleteTask(_: ActionState, form: FormData) {
  return mutate((client) => {
    if (form.get("confirm")!=="yes") throw new z.ZodError([{code:"custom",path:[],message:"Confirm task deletion first."}]);
    return client.rpc("delete_project_task",{p_project_id:idSchema.parse(form.get("project_id")),p_task_id:idSchema.parse(form.get("task_id"))});
  },"Task deleted.");
}
export async function setBoard(_: ActionState, form: FormData) {
  return mutate((client) => {
    const input=boardSettingsSchema.parse({mode:form.get("mode"),url:form.get("url") ?? ""});
    return client.rpc("set_project_board",{p_project_id:idSchema.parse(form.get("project_id")),p_mode:input.mode,p_url:input.mode==="external" ? new URL(input.url).href : null});
  },"Board updated. Your native tasks are saved.");
}
