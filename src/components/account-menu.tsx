"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { LogOut, Moon, UserRound } from "lucide-react";
import { logout } from "@/app/actions";
import { initials } from "@/lib/domain";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";
export function AccountMenu({ id, name }: { id: string; name: string }) {
  const theme=useTheme();
  const menu=useRef<HTMLDetailsElement>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const [pending,setPending]=useState(false);
  function cancel() { if(pending) return; dialog.current?.close(); menu.current?.querySelector("summary")?.focus(); }
  return <div className="account-menu"><details ref={menu} onKeyDown={(e) => { if(e.key==="Escape") { e.currentTarget.open=false; e.currentTarget.querySelector("summary")?.focus(); } }}>
    <summary className="avatar" aria-label={`Account: ${name}`}>{initials(name)}</summary>
    <div className="account-options"><Link href={`/people/${id}`} onClick={() => { if(menu.current) menu.current.open=false; }}><UserRound size={16} />Profile</Link>
      <button type="button" role="switch" aria-checked={theme.dark} disabled={theme.pending} onClick={theme.toggle}><Moon size={16} />Dark mode<span className="ml-auto muted text-xs">{theme.pending ? "…" : theme.dark ? "On" : "Off"}</span></button>
      <button type="button" onClick={() => { if(menu.current) menu.current.open=false; dialog.current?.showModal(); }}><LogOut size={16} />Sign out</button>
    </div>
  </details><dialog ref={dialog} className="confirm-dialog" onCancel={(e) => { e.preventDefault(); cancel(); }} aria-labelledby="signout-title"><h2 id="signout-title">Sign out?</h2><p className="muted mt-3">You can sign in again anytime.</p><form action={async () => { setPending(true); await logout(); }} className="flex gap-3 justify-end mt-6"><Button type="button" variant="outline" disabled={pending} onClick={cancel}>Cancel</Button><Button disabled={pending}>{pending ? "Signing out…" : "Sign out"}</Button></form></dialog></div>;
}
