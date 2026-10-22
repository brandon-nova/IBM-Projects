import { requireViewer } from "@/lib/auth";
import { ProjectForm } from "@/components/forms";
import { PageTitle } from "@/components/shell";
export default async function NewProject() {
  await requireViewer();
  return <div className="max-w-2xl mx-auto"><PageTitle eyebrow="Make room for an idea" title="What’s worth working on?" description="Start small. Your proposal stays private until an admin assigns an owner and approves publication." /><div className="panel"><ProjectForm /></div></div>;
}
