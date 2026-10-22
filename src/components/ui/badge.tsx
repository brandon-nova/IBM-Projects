import { cn } from "@/lib/utils";
export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "blue" | "amber" }) {
  return <span className={cn("badge", tone === "blue" && "badge-blue", tone === "amber" && "badge-amber")}>{children}</span>;
}
