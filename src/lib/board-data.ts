import "server-only";
import { requireViewer } from "./auth";
import { createClient } from "./supabase/server";
import type { ProjectTask } from "./database.types";

export async function loadBoardTasks(projectId: string) {
  await requireViewer();
  const client=await createClient();
  const tasks: ProjectTask[]=[];
  for (let offset=0;;offset+=100) {
    const {data,error}=await client.from("project_tasks").select("*").eq("project_id",projectId).order("position").order("id").range(offset,offset+99);
    if (error) throw new Error("The project board could not be loaded. Check that the project tools update is installed.");
    tasks.push(...data);
    if (data.length<100) return tasks;
  }
}
