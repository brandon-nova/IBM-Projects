import { LoaderCircle } from "lucide-react";
export default function Loading() { return <div role="status" className="min-h-64 flex items-center justify-center gap-3 text-muted-foreground"><LoaderCircle size={18} className="animate-spin" />Loading your workspace…</div>; }
