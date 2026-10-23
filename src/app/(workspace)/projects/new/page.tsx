import { loadWorkspace } from "@/lib/data";
import { SkillRequestForm } from "@/components/skill-request-form";
import { ProjectForm } from "@/components/forms";
import { PageTitle } from "@/components/shell";
import { createClient } from "@/lib/supabase/server";
import type { OwnerOption } from "@/lib/database.types";
export default async function NewProject() {
  const data = await loadWorkspace();
  const admin = data.viewer.role === "admin";
  const owners: OwnerOption[] = [];
  if (admin) {
    const client = await createClient();
    for (let offset=0;;offset+=100) {
      const {data:rows,error}=await client.rpc("admin_project_owners",{p_offset:offset,p_limit:100});
      if (error) throw new Error("Project owners could not be loaded. Check that the project tools update is installed.");
      owners.push(...rows);
      if (rows.length<100) break;
    }
  }
  return <div className="max-w-2xl mx-auto"><PageTitle title="Create a project" description={admin ? "Choose an owner and publish your project." : "Your proposal stays private until an admin assigns an owner and approves it."} /><div className="panel"><ProjectForm catalog={data.skills} owners={admin ? owners : undefined} defaultOwnerId={data.viewer.id} /></div><SkillRequestForm /></div>;
}
