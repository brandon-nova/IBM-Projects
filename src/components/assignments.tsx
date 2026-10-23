"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { AssignmentData } from "@/lib/assignment-data";
import type { Candidate } from "@/lib/database.types";
import { initialState } from "@/lib/action-state";
import { inviteMembers, cancelInvitation, removeMember, searchAssignmentCandidates, suggestAssignmentCandidates } from "@/app/assignment-actions";
import { ActionForm } from "./forms";
import { Button } from "./ui/button";
export function Assignments({ data }: { data: AssignmentData }) {
  const [query,setQuery]=useState("");
  const [candidates,setCandidates]=useState(data.candidates);
  const [offset,setOffset]=useState(0);
  const [hasMore,setHasMore]=useState(data.candidates.length===50);
  const [selected,setSelected]=useState<string[]>([]);
  const [kind,setKind]=useState<"contribution"|"training">("contribution");
  const [preview,setPreview]=useState(false);
  const [error,setError]=useState("");
  const [dragOver,setDragOver]=useState(false);
  const [loading,startTransition]=useTransition();
  const generation=useRef(0);
  const mounted=useRef(true);
  useEffect(() => { mounted.current=true; return () => { mounted.current=false; }; },[]);
  const [state,action,pending]=useActionState(async (previous: typeof initialState,form: FormData) => {
    const result=await inviteMembers(previous,form);
    if(result.success && mounted.current) setSelected([]);
    return result;
  },initialState);
  useEffect(() => {
    const version=++generation.current;
    let canceled=false;
    const timer=setTimeout(() => { startTransition(async () => {
      try {
        const rows=await searchAssignmentCandidates(data.project.id,query,offset);
        if(!canceled && mounted.current && version===generation.current) { setCandidates(rows); setHasMore(rows.length===50); setError(""); }
      } catch { if(!canceled && mounted.current && version===generation.current) setError("Employees could not be loaded. Try another search."); }
    }); },250);
    return () => { clearTimeout(timer); canceled=true; };
  },[query,offset,data.project.id]);
  const members=data.members.filter((m) => m.membership_status==="active");
  const pendingIds=new Set(data.requests.filter((r) => r.status==="pending").map((r) => r.user_id));
  const eligible=candidates.filter((c) => !members.some((m) => m.user_id===c.user_id) && !pendingIds.has(c.user_id));
  const needsReinvite=selected.some((uid) => data.requests.some((r) => r.user_id===uid && r.status!=="pending"));
  const ready=data.project.approval_status==="approved" && data.project.visibility==="organization" && data.project.work_status!=="completed" && Boolean(data.project.owner_id);
  function toggle(uid:string) { setSelected((ids) => ids.includes(uid) ? ids.filter((id) => id!==uid) : ids.length<25 ? [...ids,uid] : ids); }
  function matchReason(c:Candidate) {
    const ids=kind==="training" ? c.learning_ids : [...c.existing_ids,...c.learning_ids];
    const names=data.skills.filter((s) => ids.includes(s.id)).map((s) => s.name);
    return names.length ? kind==="training" ? `Interested in learning ${names.join(", ")}` : `${names.join(" and ")} match` : "Browse profile to learn more";
  }
  function browse() {
    const version=++generation.current; setPreview(false); setSelected([]); setCandidates([]); setKind("contribution");
    startTransition(async () => {
      try { const rows=await searchAssignmentCandidates(data.project.id,query,offset); if(mounted.current&&version===generation.current) { setCandidates(rows); setHasMore(rows.length===50); setError(""); } }
      catch { if(mounted.current&&version===generation.current) setError("Employees could not be loaded. Try again."); }
    });
  }
  function suggestions(nextKind: "contribution"|"training") {
    const version=++generation.current; setKind(nextKind); setSelected([]); setCandidates([]); setPreview(true);
    startTransition(async () => {
      try { const rows=await suggestAssignmentCandidates(data.project.id,nextKind); if(mounted.current && version===generation.current) { setCandidates(rows); setHasMore(false); setError(""); } }
      catch { if(mounted.current && version===generation.current) setError("Suggestions could not be loaded. Try searching employees."); }
    });
  }
  return <div className="assignment-grid">
    <section className="panel stack" aria-labelledby={`employees-${data.project.id}`}><h2 id={`employees-${data.project.id}`}>Employees</h2>
      <label className="field">Search people or skills<input className="field-input" type="search" value={query} maxLength={80} placeholder={data.canSearchEmail ? "Name, email or skill" : "Name or skill"} onChange={(e) => { setQuery(e.target.value); setOffset(0); setPreview(false); setSelected([]); setCandidates([]); }} /></label>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={loading||!ready} onClick={browse}>Assign</Button><Button type="button" variant="outline" disabled={loading||!ready} onClick={() => suggestions("contribution")}>Auto-Assign</Button><Button type="button" variant="outline" disabled={loading||!ready} onClick={() => suggestions("training")}>Train</Button></div>
      {preview && <p role="status" className="field-hint">{kind==="training" ? "Learning matches" : "Suggested matches"} · Review and select people before inviting.</p>}
      {loading && <p role="status" className="muted">Loading employees…</p>}{error && <p role="alert" className="notice notice-error">{error}</p>}
      <div className="candidate-list" aria-busy={loading}>{candidates.map((c) => <article className="candidate-card" key={c.user_id} draggable={ready&&!pending&&!loading&&eligible.some((e) => e.user_id===c.user_id)} onDragStart={(event) => { event.dataTransfer.setData("application/x-ibm-person",c.user_id); event.dataTransfer.effectAllowed="copy"; }}>
        <div className="flex justify-between gap-3"><Link className="font-semibold text-link" href={`/people/${c.user_id}`}>{c.display_name}</Link>{members.some((m) => m.user_id===c.user_id) ? <span className="field-hint">Already participating</span> : pendingIds.has(c.user_id) ? <span className="field-hint">Invitation pending</span> : <label className="filter-check"><input type="checkbox" checked={selected.includes(c.user_id)} disabled={loading||!ready||pending||(!selected.includes(c.user_id)&&selected.length>=25)} onChange={() => toggle(c.user_id)} />Select<span className="sr-only"> {c.display_name}</span></label>}</div><p className="text-xs muted">{matchReason(c)}</p><p className="text-xs muted">{c.available_hours===null ? "Availability not specified" : `${c.available_hours} hours / week`}</p>
        {eligible.some((e) => e.user_id===c.user_id)&&data.requests.some((r) => r.user_id===c.user_id) && <p className="field-hint">Previously invited · explicit reinvitation required</p>}
      </article>)}</div>
      {!loading&&!error&&!candidates.length && <p role="status" className="muted">{preview ? "No skill matches. Choose Assign to browse people." : query.trim() ? "No people match this search. Try their profile name or clear the search." : offset>0 ? "No more people on this page. Choose Previous." : "No active accounts found. Check that workspace access is approved and account profiles exist."}</p>}
      {!preview && <div className="flex gap-3"><Button type="button" variant="ghost" disabled={offset===0||loading} onClick={() => { setOffset(Math.max(0,offset-50)); setSelected([]); setCandidates([]); }}>Previous</Button><Button type="button" variant="ghost" disabled={!hasMore||loading} onClick={() => { setOffset(offset+50); setSelected([]); setCandidates([]); }}>Next</Button></div>}
    </section>
    <section className="stack"><div className="panel stack"><h2>{data.project.title}</h2><p className="muted line-clamp-3">{data.project.description}</p><div className="tags">{data.skills.map((s) => <span className="skill" key={s.id}>{s.name}</span>)}</div><Link className="text-link" href={`/projects/${data.project.id}`}>View project</Link>
      {!ready ? <p className="notice notice-error">Invitations need a published, unfinished project with an active owner.</p> : <form action={action} className={`assignment-drop form-stack ${dragOver ? "drag-over" : ""}`} onDragOver={(e) => { if(e.dataTransfer.types.includes("application/x-ibm-person")) { e.preventDefault(); setDragOver(true); } }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); const uid=e.dataTransfer.getData("application/x-ibm-person"); if(!pending&&!loading&&eligible.some((c) => c.user_id===uid)&&!selected.includes(uid)&&selected.length<25) setSelected([...selected,uid]); }}>
        <p className="field-hint">Select employees or drag them here. Then confirm the invitation.</p>
        <fieldset className="form-stack" disabled={pending}><input type="hidden" name="project_id" value={data.project.id} />{selected.map((uid) => <input key={uid} type="hidden" name="user_id" value={uid} />)}
          <div><p role="status">{selected.length} selected</p><p className="field-hint">{selected.map((uid) => candidates.find((c) => c.user_id===uid)?.display_name).filter(Boolean).join(", ")}</p></div><label className="field">Invitation type<select className="field-input" name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="contribution">Contribution</option><option value="training">Learning opportunity</option></select></label>
          <label className="field">Reason <span className="optional">Optional</span><textarea className="field-input" name="reason" maxLength={360} rows={2} placeholder={kind==="training" ? "What could they learn?" : "Why is this a useful opportunity?"} /></label>
          {needsReinvite && <label className="filter-check"><input type="checkbox" name="reinvite" value="yes" required />I intend to invite previous recipients again.</label>}
          <Button disabled={!selected.length||pending||loading}>{pending ? "Sending…" : "Invite selected"}</Button>
        </fieldset>{state.message && <p role={state.success ? "status" : "alert"} className={state.success ? "notice notice-success" : "notice notice-error"}>{data.project.title}: {state.message}</p>}
      </form>}
    </div><div className="panel stack"><h3>Participants · {members.length}</h3>{members.map((m) => <div key={m.user_id} className="stack-sm"><Link className="text-link" href={`/people/${m.user_id}`}>{m.name}{m.user_id===data.project.owner_id ? " · Official owner" : ""}</Link>{data.project.work_status!=="completed" && m.user_id!==data.project.owner_id && <details><summary className="muted text-xs">Remove participant</summary><ActionForm action={removeMember} label="Remove participant" variant="destructive"><input type="hidden" name="project_id" value={data.project.id} /><input type="hidden" name="user_id" value={m.user_id} /><label className="filter-check"><input type="checkbox" name="confirm" value="yes" required />Remove {m.name}? Work and evidence stay saved.</label></ActionForm></details>}</div>)}</div>
      <div className="panel stack"><h3>Pending invitations</h3>{data.requests.filter((r) => r.status==="pending").map((r) => <div key={r.id} className="stack-sm"><Link href={`/people/${r.user_id}`}>{r.name}</Link><p className="field-hint">{r.suggestion_kind==="training" ? "Learning opportunity" : "Contribution"} · Invited by {r.sender_name}{r.reason ? ` · ${r.reason}` : ""}</p><ActionForm action={cancelInvitation} label="Cancel invitation"><input type="hidden" name="request_id" value={r.id} /></ActionForm></div>)}{!data.requests.some((r) => r.status==="pending") && <p className="muted text-xs">No pending invitations.</p>}
      <details><summary>Invitation history</summary>{data.requests.map((r) => <div key={r.id} className="review-card"><p>{r.name} · {r.status==="rejected" ? "Declined" : r.status}</p><p className="field-hint">{r.reason}</p>{data.events.filter((e) => e.request_id===r.id).map((e) => <p key={e.id} className="field-hint">{e.event} by {e.actor_name} · {new Date(e.created_at).toLocaleDateString("en-US",{timeZone:"UTC"})}{e.reason ? ` · ${e.reason}` : ""}</p>)}</div>)}</details></div>
    </section>
  </div>;
}
