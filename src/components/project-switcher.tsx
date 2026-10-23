"use client";
import { useState } from "react";
import { Button } from "./ui/button";
export function ProjectSwitcher({ projects,selected }: { projects:{id:string;title:string}[];selected:string }) {
  const [query,setQuery]=useState("");
  const options=projects.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()) || p.id===selected);
  return <form className="filter-bar" action="/admin"><input type="hidden" name="tab" value="assignments" /><label className="field filter-search">Find a project<input className="field-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects…" /></label><label className="field flex-1">Selected project<select className="field-input" name="project" defaultValue={selected} required><option value="" disabled>Select a project</option>{options.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label><Button>Select project</Button></form>;
}
