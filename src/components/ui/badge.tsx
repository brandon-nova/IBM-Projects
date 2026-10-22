import { cn } from "@/lib/utils";
export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "teal" | "amber" }) {
  return <span className={cn("badge", tone === "teal" && "badge-teal", tone === "amber" && "badge-amber")}>{children}</span>;
}
