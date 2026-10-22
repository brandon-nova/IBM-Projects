import { requireViewer } from "@/lib/auth";
import { WorkspaceShell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireViewer();
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
