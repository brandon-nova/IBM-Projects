"use client";
import { useActionState, useState } from "react";
import type { OwnerOption, Skill } from "@/lib/database.types";
import { initialState } from "@/lib/action-state";
import { saveProfile, createProject, editProject } from "@/app/actions";
import { SkillPicker } from "./skill-picker";
import { OwnerPicker } from "./owner-picker";
import { Button } from "./ui/button";
import type { z } from "zod";
import type { profileSchema } from "@/lib/validation";
export function ProjectForm({ project, catalog, owners, defaultOwnerId }: { catalog: Skill[]; owners?: OwnerOption[]; defaultOwnerId?: string; project?: { id: string; title: string; description: string; skills: string[]; estimated_hours: number | null } }) {
  const [state,action,pending] = useActionState(project ? editProject : createProject, initialState);
  const [description,setDescription] = useState(project?.description ?? "");
  const count = Array.from(description).length;
  const limit = project ? 5000 : 300;
  const publish = !project && owners !== undefined;
  return <form action={action} className="form-stack" aria-busy={pending}><fieldset disabled={pending} className="form-stack">
    {project && <input type="hidden" name="project_id" value={project.id} />}
    <label className="field">Project title<input className="field-input" name="title" required minLength={3} maxLength={100} defaultValue={project?.title} placeholder="What could we make better?" /></label>
    <label className="field">Description<textarea className="field-input" name="description" required minLength={10} value={description} onChange={(e) => setDescription(e.target.value)} rows={4} aria-describedby="project-description-count" aria-invalid={count>limit} /><span id="project-description-count" className={count>limit ? "field-error" : "field-hint"}>{count} / {limit}</span></label>
    <SkillPicker disabled={pending} catalog={catalog} name="skills" label="Skills needed" initial={project?.skills} />
    <label className="field">Estimated hours per week <span className="optional">Optional</span><input className="field-input" name="estimated_hours" type="number" min={0.5} max={10000} step={0.5} defaultValue={project?.estimated_hours ?? ""} /></label>
    {publish && <OwnerPicker id="new-project-owner" title="new project" ownerId={defaultOwnerId ?? null} candidates={owners} disabled={pending} />}
    <Button className="self-start" disabled={pending || count>limit}>{pending ? "Saving…" : project ? "Save changes" : publish ? "Create and publish project" : "Create private proposal"}</Button>
  </fieldset>{state.message && <p role={state.success ? "status" : "alert"} className={state.success ? "notice notice-success" : "notice notice-error"}>{state.message}</p>}</form>;
}
export function ProfileForm({ defaults, catalog }: { defaults: z.infer<typeof profileSchema>; catalog: Skill[] }) {
  const [state,action,pending] = useActionState(saveProfile,initialState);
  const [bio,setBio] = useState(defaults.bio);
  const count=Array.from(bio).length;
  return <form action={action} className="form-stack" aria-busy={pending}><fieldset disabled={pending} className="form-stack">
    <label className="field">Name<input className="field-input" name="display_name" defaultValue={defaults.display_name} required maxLength={80} autoComplete="name" /></label>
    <label className="field">A little about you<textarea className="field-input" name="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} aria-describedby="bio-count" aria-invalid={count>360} /><span id="bio-count" className={count>360 ? "field-error" : "field-hint"}>{count} / 360{count>360 ? " · Shorten your bio before saving." : ""}</span></label>
    <SkillPicker disabled={pending} catalog={catalog} name="existing_skills" label="Skills I have" initial={defaults.existing_skills} />
    <SkillPicker disabled={pending} catalog={catalog} name="learning_skills" label="Want to learn / interests" initial={defaults.learning_skills} limit={6} />
    <label className="field">Available hours per week<input className="field-input" name="available_hours" type="number" min={0} max={168} step={0.5} defaultValue={defaults.available_hours} /></label>
    <Button className="self-start" disabled={pending || count>360}>{pending ? "Saving…" : "Save profile"}</Button>
  </fieldset>{state.message && <p role={state.success ? "status" : "alert"} className={state.success ? "notice notice-success" : "notice notice-error"}>{state.message}</p>}</form>;
}
