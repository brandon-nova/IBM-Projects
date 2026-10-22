import { notFound, redirect } from "next/navigation";
import { loadWorkspace, projectTags } from "@/lib/data";
import { ProjectForm } from "@/components/forms";
import { PageTitle } from "@/components/shell";
export default async function EditProject({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const data = await loadWorkspace();
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) notFound();
  const canEdit = project.owner_id === data.viewer.id || (!project.owner_id && project.creator_id === data.viewer.id && project.approval_status !== "approved");
  if (!canEdit || project.work_status === "completed") redirect(`/projects/${projectId}`);
  return <div className="max-w-2xl mx-auto"><PageTitle title="Edit project" description={project.approval_status === "approved" ? "Your project will stay published when you save." : "Make the opportunity clear and useful."} /><div className="panel"><ProjectForm project={{ ...project, skills: projectTags(data,project.id).map((s) => s.name).join(", ") }} /></div></div>;
}
