"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="max-w-md mx-auto py-20 text-center stack"><h1>Something didn’t load.</h1><p className="muted">Please try again. If it keeps happening, ask your workspace administrator to check the connection and database setup.</p><Button onClick={reset}>Try again</Button></div>;
}
