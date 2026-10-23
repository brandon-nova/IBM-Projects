import { requestSkill } from "@/app/skill-actions";
import { ActionForm } from "./forms";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
export async function SkillRequestForm() {
  const viewer=await requireViewer(); const client=await createClient();
  const {data:requests,error}=await client.from("skill_requests").select("*").eq("requester_id",viewer.id).order("created_at",{ascending:false}).limit(25);
  if(error) throw new Error("Skill requests could not be loaded.");
  return <details className="panel mt-6"><summary>Request a skill</summary><div className="mt-4"><ActionForm action={requestSkill} label="Request skill">
    <label className="field w-full">Skill name<input className="field-input" name="name" required maxLength={80} /></label>
    <label className="field w-full">Why add it? <span className="optional">Optional</span><textarea className="field-input" name="reason" maxLength={360} rows={2} /></label>
  </ActionForm>{requests?.map((r) => <div className="review-card" key={r.id}><p>{r.name} · {r.status}</p>{r.feedback && <p className="field-hint">{r.feedback}</p>}{r.status==="approved" && <p className="field-hint">Search for this skill above to select it.</p>}</div>)}</div></details>;
}
