"use client";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
const ThemeContext = createContext({ dark: false, pending: false, toggle: () => {} });
function snapshot() { return document.documentElement.dataset.theme === "dark"; }
function subscribe(callback: () => void) {
  const media=window.matchMedia("(prefers-color-scheme: dark)");
  const sync=() => { let preference: string | null=null; try { preference=localStorage.getItem("ibm-theme"); } catch {} document.documentElement.dataset.theme=preference === "dark" || (preference !== "light" && media.matches) ? "dark" : "light"; callback(); };
  window.addEventListener("ibm-theme",callback); window.addEventListener("storage",sync); media.addEventListener("change",sync);
  return () => { window.removeEventListener("ibm-theme",callback); window.removeEventListener("storage",sync); media.removeEventListener("change",sync); };
}
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const dark=useSyncExternalStore(subscribe,snapshot,() => false);
  const [pending,setPending]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if(timer.current) clearTimeout(timer.current); },[]);
  function toggle() {
    if(timer.current) return;
    setPending(true);
    timer.current=setTimeout(() => {
      const next=snapshot() ? "light" : "dark";
      document.documentElement.dataset.theme=next;
      try { localStorage.setItem("ibm-theme",next); } catch {}
      window.dispatchEvent(new Event("ibm-theme"));
      timer.current=null; setPending(false);
    },200);
  }
  return <ThemeContext.Provider value={{ dark,pending,toggle }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { return useContext(ThemeContext); }
