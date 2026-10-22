"use client";

import { useActionState, useId, useRef, useTransition } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { initialState, type FormAction } from "@/lib/action-state";
import { loginSchema, signupSchema, resetRequestSchema, passwordSchema, projectSchema, profileSchema, deliverableSchema } from "@/lib/validation";
import { login, signup, requestPasswordReset, updatePassword, createProject, editProject, saveProfile, submitDeliverable, searchInterest } from "@/app/actions";

type Field<T extends FieldValues> = { name: Path<T>; label: string; type?: string; placeholder?: string; hint?: string; required?: boolean; autoComplete?: string; maxLength?: number };
function FieldsForm<T extends FieldValues>({ schema, defaults, fields, action, label, hidden = {} }: {
  schema: z.ZodType<T>; defaults: DefaultValues<T>; fields: Field<T>[]; action: FormAction; label: string; hidden?: Record<string, string>;
}) {
  const [state, dispatch, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const prefix = useId();
  const form = useForm<T>({ resolver: zodResolver(schema), defaultValues: defaults });
  return <form ref={ref} className="form-stack" noValidate onSubmit={form.handleSubmit(() => {
    if (ref.current) { const data = new FormData(ref.current); startTransition(() => dispatch(data)); }
  })}>
    {Object.entries(hidden).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
    <fieldset disabled={pending} className="form-stack">
      {fields.map((field) => {
        const error = form.getFieldState(field.name, form.formState).error;
        const inputId = `${prefix}-${field.name}`;
        const props = { ...form.register(field.name), id: inputId, placeholder: field.placeholder, required: field.required, maxLength: field.maxLength, "aria-invalid": Boolean(error), "aria-describedby": error || field.hint ? `${inputId}-help` : undefined };
        return <div className="field" key={field.name}>
          <label htmlFor={inputId}>{field.label}{!field.required && <span className="optional"> · optional</span>}</label>
          {field.type === "textarea" ? <textarea {...props} className="field-input" rows={4} /> : <Input {...props} type={field.type ?? "text"} autoComplete={field.autoComplete} step={field.type === "number" ? "0.5" : undefined} />}
          {(error || field.hint) && <p id={`${inputId}-help`} className={error ? "field-error" : "field-hint"}>{error?.message ?? field.hint}</p>}
        </div>;
      })}
      <Button type="submit" className="self-start" disabled={pending}>{pending ? <LoaderCircle size={16} className="animate-spin" /> : null}{pending ? "Saving…" : label}</Button>
    </fieldset>
    {state.message && <p role={state.success ? "status" : "alert"} className={state.success ? "notice notice-success" : "notice notice-error"}>{state.message}</p>}
  </form>;
}

export function AuthForm({ mode }: { mode: "login" | "signup" | "reset" | "password" }) {
  if (mode === "signup") return <FieldsForm schema={signupSchema} defaults={{ display_name: "", email: "", password: "" }} action={signup} label="Create account" fields={[
    { name: "display_name", label: "Your name", required: true, autoComplete: "name", maxLength: 80 },
    { name: "email", label: "Approved email", type: "email", required: true, autoComplete: "email" },
    { name: "password", label: "Password", type: "password", required: true, autoComplete: "new-password", hint: "At least 12 characters.", maxLength: 128 },
  ]} />;
  if (mode === "reset") return <FieldsForm schema={resetRequestSchema} defaults={{ email: "" }} action={requestPasswordReset} label="Send reset link" fields={[{ name: "email", label: "Email", type: "email", required: true, autoComplete: "email" }]} />;
  if (mode === "password") return <FieldsForm schema={passwordSchema} defaults={{ password: "" }} action={updatePassword} label="Save new password" fields={[{ name: "password", label: "New password", type: "password", required: true, autoComplete: "new-password", hint: "At least 12 characters.", maxLength: 128 }]} />;
  return <FieldsForm schema={loginSchema} defaults={{ email: "", password: "" }} action={login} label="Sign in" fields={[
    { name: "email", label: "Email", type: "email", required: true, autoComplete: "email" },
    { name: "password", label: "Password", type: "password", required: true, autoComplete: "current-password" },
  ]} />;
}
export function ProjectForm({ project }: { project?: { id: string; title: string; description: string; skills: string; estimated_hours: number | null } }) {
  return <FieldsForm schema={projectSchema} defaults={{ title: project?.title ?? "", description: project?.description ?? "", skills: project?.skills ?? "", estimated_hours: project?.estimated_hours?.toString() ?? "" }} action={project ? editProject : createProject} hidden={project ? { project_id: project.id } : {}} label={project ? "Save changes" : "Create private proposal"} fields={[
    { name: "title", label: "Project title", placeholder: "What could we make better?", required: true, maxLength: 100 },
    { name: "description", label: "What needs to be done?", type: "textarea", placeholder: "Describe the opportunity and what a useful result would look like.", required: true, maxLength: 5000 },
    { name: "skills", label: "Skills involved", placeholder: "Python, SQL, Design", hint: "Separate skills with commas. You don’t need to be an expert.", required: true },
    { name: "estimated_hours", label: "Estimated hours", type: "number", placeholder: "8" },
  ]} />;
}
export function ProfileForm({ defaults }: { defaults: z.infer<typeof profileSchema> }) {
  return <FieldsForm schema={profileSchema} defaults={defaults} action={saveProfile} label="Save profile" fields={[
    { name: "display_name", label: "Name", required: true, autoComplete: "name", maxLength: 80 },
    { name: "bio", label: "A little about you", type: "textarea", maxLength: 500 },
    { name: "existing_skills", label: "Skills you have", hint: "Separate skills with commas." },
    { name: "learning_skills", label: "Skills you want to learn", hint: "Separate interests with commas." },
    { name: "available_hours", label: "Available hours per week", type: "number" },
  ]} />;
}
export function DeliverableForm({ projectId, defaults }: { projectId: string; defaults?: { url: string; summary: string; outcome: string } }) {
  return <FieldsForm schema={deliverableSchema} defaults={defaults ?? { url: "", summary: "", outcome: "" }} action={submitDeliverable} label={defaults ? "Resubmit work" : "Submit work"} hidden={{ project_id: projectId }} fields={[
    { name: "url", label: "Deliverable URL", type: "url", placeholder: "https://…", hint: "Link to the work. Make sure your owner can access it.", required: true, maxLength: 2048 },
    { name: "summary", label: "What did you accomplish?", type: "textarea", required: true, maxLength: 2000 },
    { name: "outcome", label: "What changed?", type: "textarea", placeholder: "Time saved, a process improved, or another useful result.", maxLength: 1000 },
  ]} />;
}
export function ActionForm({ action, label, children, variant = "outline", className = "" }: { action: FormAction; label: string; children?: React.ReactNode; variant?: "default" | "outline" | "ghost" | "destructive"; className?: string }) {
  const [state, dispatch, pending] = useActionState(action, initialState);
  return <form action={dispatch} className={`action-form ${className}`}>
    <fieldset disabled={pending} className="contents">{children}</fieldset>
    <Button type="submit" variant={variant} size="sm" disabled={pending}>{pending && <LoaderCircle size={14} className="animate-spin" />}{pending ? "Saving…" : label}</Button>
    {state.message && <p role={state.success ? "status" : "alert"} className={state.success ? "action-success" : "field-error"}>{state.message}</p>}
  </form>;
}
export function InterestSearch() {
  const [state, dispatch, pending] = useActionState(searchInterest, initialState);
  const input = useRef<HTMLInputElement>(null);
  return <div className="interest-search">
    <form action={dispatch} className="search-box">
      <Search size={21} aria-hidden="true" />
      <label htmlFor="interest" className="sr-only">A skill or interest</label>
      <input ref={input} id="interest" name="interest" placeholder="A skill, an idea, something you’re curious about…" required maxLength={80} disabled={pending} />
      <Button type="submit" size="sm" disabled={pending} aria-label="Find opportunities">{pending ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowRight size={18} />}</Button>
    </form>
    {state.message && <p role="alert" className="field-error mt-3">{state.message}</p>}
    <div className="suggestions" aria-label="Try an interest">{["Learn Python", "Work on AI", "Build a website", "Practice data engineering"].map((s) => <button key={s} type="button" onClick={() => { if (input.current) { input.current.value = s; input.current.focus(); } }}>{s}<ArrowRight size={12} /></button>)}</div>
  </div>;
}
