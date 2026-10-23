"use client";

import { useActionState, useId, useTransition } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { initialState, type FormAction } from "@/lib/action-state";
import { loginSchema, signupSchema, resetRequestSchema, passwordSchema, deliverableSchema } from "@/lib/validation";
import { login, signup, resendVerification, requestPasswordReset, updatePassword, setDirectoryVisibility, submitDeliverable, searchInterest } from "@/app/actions";

type Field<T extends FieldValues> = { name: Path<T>; label: string; type?: string; placeholder?: string; hint?: string; required?: boolean; autoComplete?: string; maxLength?: number };
function FieldsForm<T extends FieldValues>({ schema, defaults, fields, action, label, pendingLabel = "Saving…", hidden = {} }: {
  schema: z.ZodType<T>; defaults: DefaultValues<T>; fields: Field<T>[]; action: FormAction; label: string; pendingLabel?: string; hidden?: Record<string, string>;
}) {
  const [state, dispatch, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const prefix = useId();
  const form = useForm<T>({ resolver: zodResolver(schema), defaultValues: defaults });
  return <form className="form-stack" noValidate aria-busy={pending} onSubmit={(event) => {
    const element = event.currentTarget;
    void form.handleSubmit(() => {
      const data = new FormData(element);
      startTransition(() => dispatch(data));
    })(event);
  }}>
    {Object.entries(hidden).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
    {Object.keys(form.formState.errors).length > 0 && <p role="alert" className="notice notice-error">Check the highlighted fields. Your request hasn’t been sent.</p>}
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
      <Button type="submit" className="self-start" disabled={pending}>{pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}{pending ? pendingLabel : label}</Button>
    </fieldset>
    {Object.keys(form.formState.errors).length === 0 && state.message && <p role={state.success ? "status" : "alert"} className={state.success ? "notice notice-success" : "notice notice-error"}>{state.message}</p>}
  </form>;
}

export function AuthForm({ mode }: { mode: "login" | "signup" | "verify" | "reset" | "password" }) {
  if (mode === "signup") return <FieldsForm schema={signupSchema} defaults={{ display_name: "", email: "", password: "", confirm_password: "" }} action={signup} label="Create account" pendingLabel="Creating account…" fields={[
    { name: "display_name", label: "Your name", required: true, autoComplete: "name", maxLength: 80 },
    { name: "email", label: "Work email", type: "email", required: true, autoComplete: "email", hint: "ibm.com and IBM subdomain addresses are approved automatically. Other addresses need administrator approval." },
    { name: "password", label: "Password", type: "password", required: true, autoComplete: "new-password", hint: "At least 12 characters.", maxLength: 128 },
    { name: "confirm_password", label: "Confirm password", type: "password", required: true, autoComplete: "new-password", maxLength: 128 },
  ]} />;
  if (mode === "verify") return <FieldsForm schema={resetRequestSchema} defaults={{ email: "" }} action={resendVerification} label="Send verification email" pendingLabel="Sending email…" fields={[{ name: "email", label: "Email", type: "email", required: true, autoComplete: "email" }]} />;
  if (mode === "reset") return <FieldsForm schema={resetRequestSchema} defaults={{ email: "" }} action={requestPasswordReset} label="Send reset link" pendingLabel="Sending email…" fields={[{ name: "email", label: "Email", type: "email", required: true, autoComplete: "email" }]} />;
  if (mode === "password") return <FieldsForm schema={passwordSchema} defaults={{ password: "", confirm_password: "" }} action={updatePassword} label="Save new password" fields={[
    { name: "password", label: "New password", type: "password", required: true, autoComplete: "new-password", hint: "At least 12 characters.", maxLength: 128 },
    { name: "confirm_password", label: "Confirm password", type: "password", required: true, autoComplete: "new-password", maxLength: 128 },
  ]} />;
  return <FieldsForm schema={loginSchema} defaults={{ email: "", password: "" }} action={login} label="Sign in" pendingLabel="Signing in…" fields={[
    { name: "email", label: "Email", type: "email", required: true, autoComplete: "email" },
    { name: "password", label: "Password", type: "password", required: true, autoComplete: "current-password" },
  ]} />;
}
export { ProjectForm, ProfileForm } from "./catalog-forms";
export function DeliverableForm({ projectId, defaults }: { projectId: string; defaults?: { url: string; summary: string; outcome: string } }) {
  return <FieldsForm schema={deliverableSchema} defaults={defaults ?? { url: "", summary: "", outcome: "" }} action={submitDeliverable} label={defaults ? "Resubmit work" : "Submit work"} hidden={{ project_id: projectId }} fields={[
    { name: "url", label: "Deliverable URL", type: "url", placeholder: "https://…", hint: "Link to the work. Make sure your owner can access it.", required: true, maxLength: 2048 },
    { name: "summary", label: "What did you accomplish?", type: "textarea", required: true, maxLength: 2000 },
    { name: "outcome", label: "What changed?", type: "textarea", placeholder: "Time saved, a process improved, or another useful result.", maxLength: 1000 },
  ]} />;
}
export function DirectoryVisibilityForm({ hidden }: { hidden: boolean }) {
  const inputId = useId();
  return <section className="panel mt-6" aria-labelledby={`${inputId}-title`}>
    <h2 id={`${inputId}-title`} className="font-semibold">People visibility</h2>
    <p id={`${inputId}-help`} className="muted text-sm mt-2 mb-4">Hide your profile from People search. Admins can still find you when assigning projects. Your profile link, project work, and administrator access stay available.</p>
    <ActionForm action={setDirectoryVisibility} label="Save visibility">
      <label htmlFor={inputId} className="sr-only">People visibility</label>
      <select key={String(hidden)} id={inputId} name="hidden_from_people" defaultValue={String(hidden)} className="field-input" aria-describedby={`${inputId}-help`}>
        <option value="false">Visible in People</option>
        <option value="true">Hidden from People</option>
      </select>
    </ActionForm>
  </section>;
}
export function ActionForm({ action, label, children, variant = "outline", className = "", disabled = false }: { action: FormAction; label: string; children?: React.ReactNode; variant?: "default" | "outline" | "ghost" | "destructive"; className?: string; disabled?: boolean }) {
  const [state, dispatch, pending] = useActionState(action, initialState);
  return <form action={dispatch} className={`action-form ${className}`}>
    <fieldset disabled={pending} className="contents">{children}</fieldset>
    <Button type="submit" variant={variant} size="sm" disabled={pending || disabled}>{pending && <LoaderCircle size={14} className="animate-spin" />}{pending ? "Saving…" : label}</Button>
    {state.message && <p role={state.success ? "status" : "alert"} className={state.success ? "action-success" : "field-error"}>{state.message}</p>}
  </form>;
}
export function InterestSearch() {
  const [state, dispatch, pending] = useActionState(searchInterest, initialState);
  return <div className="interest-search">
    <form action={dispatch} className="search-box">
      <Search size={21} aria-hidden="true" />
      <label htmlFor="interest" className="sr-only">A skill or interest</label>
      <input id="interest" name="interest" placeholder="AI, Python, design, data engineering…" required maxLength={80} disabled={pending} />
      <Button type="submit" disabled={pending} aria-label="Find projects">{pending ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}</Button>
    </form>
    {state.message && <p role="alert" className="field-error mt-3">{state.message}</p>}
  </div>;
}
