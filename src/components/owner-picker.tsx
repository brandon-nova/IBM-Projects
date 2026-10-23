"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import type { OwnerOption } from "@/lib/database.types";
export function OwnerPicker({ id,title,ownerId,candidates,disabled=false }: { id:string;title:string;ownerId:string|null;candidates:OwnerOption[];disabled?:boolean }) {
  const [selectedId,setSelectedId]=useState(ownerId ?? "");
  const selected=candidates.find((person) => person.user_id===selectedId);
  const [query,setQuery]=useState(selected?.display_name ?? "");
  const [open,setOpen]=useState(false);
  const [searching,setSearching]=useState(false);
  const [active,setActive]=useState(0);
  const input=useRef<HTMLInputElement>(null);
  const list=useRef<HTMLDivElement>(null);
  const {pending}=useFormStatus();
  const unavailable=disabled || pending;
  const matches=searching ? candidates.filter((person) => person.display_name.toLowerCase().includes(query.trim().toLowerCase())) : candidates;
  const expanded=open && !unavailable;
  useEffect(() => {
    if(expanded) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({block:"nearest"});
  },[active,expanded,query]);
  function openChoices() {
    setSearching(false);
    setActive(Math.max(0,candidates.findIndex((person) => person.user_id===selectedId)));
    setOpen(true);
    input.current?.select();
  }
  function cancelSearch() {
    setOpen(false);
    setSearching(false);
    setQuery(selected?.display_name ?? "");
  }
  function choose(person:OwnerOption) {
    if(unavailable) return;
    setSelectedId(person.user_id);
    setQuery(person.display_name);
    setSearching(false);
    setOpen(false);
  }
  return <div className="field w-full">
    <label htmlFor={id}>Project owner<span className="sr-only"> for {title}</span></label>
    <input type="hidden" name="owner_id" value={selectedId} disabled={unavailable} />
    <div className="owner-picker">
      <input ref={input} id={id} className="field-input owner-picker-input" role="combobox" autoComplete="off" required disabled={unavailable}
        aria-expanded={expanded} aria-controls={`${id}-options`} aria-autocomplete="list"
        aria-activedescendant={expanded && matches[active] ? `${id}-option-${matches[active].user_id}` : undefined}
        value={query} placeholder="Search people…"
        onFocus={openChoices}
        onClick={() => {if(!open) openChoices();}}
        onBlur={cancelSearch}
        onChange={(event) => {setQuery(event.target.value);setSearching(true);setActive(0);setOpen(true);}}
        onKeyDown={(event) => {
          if(event.nativeEvent.isComposing) return;
          if(event.key==="ArrowDown" || event.key==="ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive(!expanded ? (event.key==="ArrowDown" ? 0 : Math.max(0,matches.length-1)) : Math.max(0,Math.min(matches.length-1,active+(event.key==="ArrowDown" ? 1 : -1))));
          } else if(event.key==="Enter" && expanded) {
            event.preventDefault();
            if(matches[active]) choose(matches[active]);
          } else if(event.key==="Escape" && expanded) {
            event.preventDefault();event.stopPropagation();cancelSearch();input.current?.select();
          }
        }} />
      <ChevronDown className="owner-picker-chevron" size={16} aria-hidden="true" />
      {expanded && <div className="owner-picker-menu">
        <div ref={list} id={`${id}-options`} role="listbox" aria-label="Project owners" className="owner-picker-options">
          {matches.map((person,index) => <button type="button" role="option" tabIndex={-1} disabled={unavailable}
            key={person.user_id} id={`${id}-option-${person.user_id}`} data-index={index}
            aria-selected={selectedId===person.user_id}
            className={`owner-picker-option${index===active ? " active" : ""}`}
            onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(person)}>
            <span>{person.display_name}</span>{selectedId===person.user_id && <Check size={16} aria-hidden="true" />}
          </button>)}
        </div>
        {matches.length===0 && <p role="status" className="owner-picker-empty">No people found.</p>}
      </div>}
    </div>
  </div>;
}
