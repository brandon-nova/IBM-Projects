"use client";
import { useActionState, useRef, useState, useTransition, type DragEvent } from "react";
import { ArrowUpRight, GripVertical, Plus } from "lucide-react";
import { deleteTask, moveTask, saveTask, setBoard } from "@/app/board-actions";
import { initialState } from "@/lib/action-state";
import type { Project, ProjectTask, TaskStatus } from "@/lib/database.types";
import { ActionForm } from "./forms";
import { Button } from "./ui/button";

type BoardPerson = { user_id: string; display_name: string; active: boolean };
const columns: {id:TaskStatus;title:string}[]=[{id:"todo",title:"To Do"},{id:"in_progress",title:"In Progress"},{id:"done",title:"Done"}];

function TaskForm({projectId,task,people,disabled=false}:{projectId:string;task?:ProjectTask;people:BoardPerson[];disabled?:boolean}) {
  const formRef=useRef<HTMLFormElement>(null);
  const [state,action,pending]=useActionState(async (previous:typeof initialState,form:FormData) => {
    const result=await saveTask(previous,form);
    if (result.success&&!task) formRef.current?.reset();
    return result;
  },initialState);
  return <form ref={formRef} action={action} className="form-stack task-form">
    <fieldset disabled={pending||disabled} className="form-stack">
      <input type="hidden" name="project_id" value={projectId} />{task && <input type="hidden" name="task_id" value={task.id} />}
      <label className="field">Task title<input className="field-input" name="title" required maxLength={160} defaultValue={task?.title} /></label>
      <label className="field">Task description <span className="optional">Optional</span><textarea className="field-input" name="description" rows={2} maxLength={2000} defaultValue={task?.description} /></label>
      <label className="field">Assign to<select className="field-input" name="assignee_id" defaultValue={task?.assignee_id ?? ""}><option value="">Unassigned</option>{people.filter((p) => p.active||p.user_id===task?.assignee_id).map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name}{p.active ? "" : " (former participant)"}</option>)}</select></label>
      <Button size="sm" className="self-start" disabled={pending||disabled}>{pending ? "Saving…" : task ? "Save task" : "Add task"}</Button>
    </fieldset>
    {state.message && <p role={state.success ? "status" : "alert"} className={state.success ? "action-success" : "field-error"}>{state.message}</p>}
  </form>;
}

function TaskCard({task,people,editable,busy}:{task:ProjectTask;people:BoardPerson[];editable:boolean;busy:boolean}) {
  const assignee=people.find((p) => p.user_id===task.assignee_id);
  return <article className="kanban-task" draggable={editable&&!busy} onDragStart={(event) => {
    event.dataTransfer.setData("application/x-ibm-task",JSON.stringify({projectId:task.project_id,taskId:task.id}));
    event.dataTransfer.effectAllowed="move";
  }}>
    <div className="kanban-task-heading">{editable && <GripVertical size={15} className="muted shrink-0" aria-hidden="true" />}<h3>{task.title}</h3></div>
    {task.description && <p className="kanban-task-description">{task.description}</p>}
    {assignee && <p className="kanban-assignee">{assignee.display_name}</p>}
    {editable && <div className="kanban-task-actions">
      <ActionForm key={task.status} action={moveTask} label="Move" disabled={busy}>
        <input type="hidden" name="project_id" value={task.project_id} /><input type="hidden" name="task_id" value={task.id} />
        <label className="sr-only" htmlFor={`move-${task.id}`}>Move {task.title} to</label><select className="field-input" id={`move-${task.id}`} name="status" defaultValue={task.status} disabled={busy}>{columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}</select>
      </ActionForm>
      <details className="task-editor"><summary>Edit task<span className="sr-only">: {task.title}</span></summary><TaskForm key={task.updated_at} projectId={task.project_id} task={task} people={people} disabled={busy} /></details>
      <details className="task-delete"><summary>Delete task<span className="sr-only">: {task.title}</span></summary><ActionForm action={deleteTask} label="Delete task" variant="destructive" disabled={busy}><input type="hidden" name="project_id" value={task.project_id} /><input type="hidden" name="task_id" value={task.id} /><label className="filter-check"><input type="checkbox" name="confirm" value="yes" required disabled={busy} />Delete this task permanently?</label></ActionForm></details>
    </div>}
  </article>;
}

function BoardSettings({project}:{project:Project}) {
  const [mode,setMode]=useState(project.board_mode);
  const [state,action,pending]=useActionState(setBoard,initialState);
  return <details className="board-settings"><summary>Board settings</summary><form action={action} className="form-stack mt-4">
    <fieldset disabled={pending} className="form-stack"><input type="hidden" name="project_id" value={project.id} />
      <label className="field">Project board<select className="field-input" name="mode" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="native">Native board</option><option value="external">External board</option></select></label>
      {mode==="external" && <label className="field">External board URL<input className="field-input" name="url" type="url" required maxLength={2048} placeholder="https://…" defaultValue={project.external_board_url ?? ""} /></label>}
      <p className="field-hint">Switching boards keeps every native task.</p>
      <Button className="self-start" size="sm" disabled={pending}>{pending ? "Saving…" : "Save board"}</Button>
    </fieldset>{state.message && <p role={state.success ? "status" : "alert"} className={state.success ? "action-success" : "field-error"}>{state.message}</p>}
  </form></details>;
}

export function ProjectBoard({project,tasks,people,editable,manager}:{project:Project;tasks:ProjectTask[];people:BoardPerson[];editable:boolean;manager:boolean}) {
  const [dragOver,setDragOver]=useState<TaskStatus|null>(null);
  const [state,setState]=useState(initialState);
  const [moving,startTransition]=useTransition();
  const canEdit=editable&&project.work_status!=="completed"&&project.board_mode==="native";
  function drop(event:DragEvent,status:TaskStatus) {
    event.preventDefault();setDragOver(null);
    if (!canEdit||moving) return;
    let payload;
    try {payload=JSON.parse(event.dataTransfer.getData("application/x-ibm-task"));} catch {return;}
    const task=tasks.find((t) => t.id===payload?.taskId&&payload.projectId===project.id);
    if (!task||task.status===status) return;
    startTransition(async () => {
      const form=new FormData();form.set("project_id",project.id);form.set("task_id",task.id);form.set("status",status);
      try {setState(await moveTask(initialState,form));} catch {setState({success:false,message:"Task could not be moved. Try again."});}
    });
  }
  return <section className="project-board" aria-labelledby={`board-${project.id}`}>
    <div className="board-heading"><h2 id={`board-${project.id}`}>Project board</h2>{project.work_status==="completed" && <span className="field-hint">Read-only</span>}</div>
    {manager&&project.work_status!=="completed" && <BoardSettings key={`${project.board_mode}:${project.external_board_url}`} project={project} />}
    {project.board_mode==="external" ? <div className="panel stack-sm"><h3>Work in your external board</h3>{project.external_board_url && <Button asChild className="self-start"><a href={project.external_board_url} target="_blank" rel="noopener noreferrer">Open board<ArrowUpRight size={15} /></a></Button>}{tasks.length>0 && <p className="field-hint">Your {tasks.length} native {tasks.length===1 ? "task is" : "tasks are"} saved.</p>}</div> : <>
      {canEdit && <details className="board-add"><summary><Plus size={15} aria-hidden="true" />Add a task</summary><TaskForm projectId={project.id} people={people} disabled={moving} /></details>}
      {moving && <p role="status" className="field-hint">Moving task…</p>}{state.message && <p role={state.success ? "status" : "alert"} className={state.success ? "action-success" : "field-error"}>{state.message}</p>}
      <div className="kanban-scroll" tabIndex={0} role="region" aria-label="Task board columns"><div className="kanban-board">{columns.map((column) => {
        const cards=tasks.filter((t) => t.status===column.id).sort((a,b) => a.position-b.position||a.id.localeCompare(b.id));
        return <section key={column.id} className={`kanban-column ${dragOver===column.id ? "kanban-drop" : ""}`} aria-labelledby={`column-${project.id}-${column.id}`} onDragOver={(event) => {if (canEdit&&!moving&&event.dataTransfer.types.includes("application/x-ibm-task")) {event.preventDefault();event.dataTransfer.dropEffect="move";setDragOver(column.id);}}} onDragLeave={(event) => {const next=event.relatedTarget;if (!(next instanceof Node)||!event.currentTarget.contains(next)) setDragOver(null);}} onDrop={(event) => drop(event,column.id)}>
          <div className="kanban-column-heading"><h3 id={`column-${project.id}-${column.id}`}>{column.title}</h3><span className="field-hint">{cards.length}</span></div>
          {cards.map((task) => <TaskCard key={task.id} task={task} people={people} editable={canEdit} busy={moving} />)}
          {!cards.length && <p className="kanban-empty">No tasks yet.</p>}
        </section>;
      })}</div></div>
    </>}
  </section>;
}
