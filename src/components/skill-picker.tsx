"use client";
import { useId, useState } from "react";
import { Check, X } from "lucide-react";
import type { Skill } from "@/lib/database.types";
export function SkillPicker({ name, label, catalog, initial = [], limit = 20, disabled = false }: { name: string; label: string; catalog: Skill[]; initial?: string[]; limit?: number; disabled?: boolean }) {
  const id = useId();
  const [selected, setSelected] = useState([...new Set(initial)]);
  const [query,setQuery] = useState("");
  const [open,setOpen] = useState(false);
  const [active,setActive] = useState(0);
  const options = catalog.filter((s) => s.active && !selected.includes(s.id) && s.name.toLowerCase().includes(query.toLowerCase())).slice(0,40);
  function add(skillId: string) { if (!disabled && selected.length < limit) { setSelected([...selected,skillId]); setQuery(""); setActive(0); } }
  return <div className="field skill-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id}>{label}<span className="optional"> · {selected.length} / {limit}</span></label>
    <div className="tags">{selected.map((skillId) => <span className="skill selected-skill" key={skillId}>
      {catalog.find((s) => s.id===skillId)?.name ?? "Unavailable skill"}{catalog.find((s) => s.id===skillId)?.active===false ? " · Retired" : ""}
      <input type="hidden" name={name} value={skillId} />
      <button type="button" disabled={disabled} aria-label={`Remove ${catalog.find((s) => s.id===skillId)?.name ?? "skill"}`} onClick={() => setSelected(selected.filter((s) => s!==skillId))}><X size={14} aria-hidden="true" /></button>
    </span>)}</div>
    <input disabled={disabled} id={id} className="field-input" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open && options[active] ? `${id}-${options[active].id}` : undefined} aria-describedby={`${id}-help`} autoComplete="off" value={query} placeholder="Search approved skills…" onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }} onKeyDown={(e) => {
      if (e.key==="ArrowDown") { e.preventDefault(); setOpen(true); setActive(Math.min(active+1,options.length-1)); }
      if (e.key==="ArrowUp") { e.preventDefault(); setActive(Math.max(0,active-1)); }
      if (e.key==="Escape") { e.preventDefault(); setOpen(false); }
      if (e.key==="Enter" && open) { e.preventDefault(); if(options[active]) add(options[active].id); }
    }} />
    {open && <div className="skill-options" role="listbox" id={`${id}-options`} aria-label={label}>
      {options.map((skill,i) => <div role="option" aria-selected={false} aria-disabled={disabled||selected.length>=limit} id={`${id}-${skill.id}`} key={skill.id} className={i===active ? "skill-option active" : "skill-option"} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => add(skill.id)}>{skill.name}<Check size={14} aria-hidden="true" /></div>)}
      {options.length===0 && <p className="muted p-3">No more matching skills.</p>}
    </div>}
    <p id={`${id}-help`} className={selected.length>limit ? "field-error" : "field-hint"}>{selected.length>=limit ? `Remove a skill to choose another. Maximum ${limit}.` : "Type to search; use arrow keys and Enter to select."}</p>
  </div>;
}
