"use client";
import { useState } from "react";
import type { OwnerOption } from "@/lib/database.types";
export function OwnerPicker({ id,title,ownerId,candidates }: { id:string;title:string;ownerId:string|null;candidates:OwnerOption[] }) {
  const [query,setQuery]=useState("");
  return <div className="field w-full"><label htmlFor={`${id}-search`}>Find an owner</label><input id={`${id}-search`} className="field-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search active employees…" /><label className="sr-only" htmlFor={id}>Official owner for {title}</label><select className="field-input" id={id} name="owner_id" defaultValue={ownerId ?? ""} required><option value="" disabled>Choose official owner</option>{candidates.filter((p) => p.user_id===ownerId || p.display_name.toLowerCase().includes(query.toLowerCase())).map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}</select></div>;
}
