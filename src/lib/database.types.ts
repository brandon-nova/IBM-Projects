import type { ApprovalStatus, Role, SubmissionStatus, WorkStatus } from "./domain";

export type Profile = { user_id: string; display_name: string; bio: string; hidden_from_people: boolean; created_at: string; updated_at: string };
export type Project = {
  id: string; creator_id: string; owner_id: string | null; title: string; description: string;
  estimated_hours: number | null; visibility: "private" | "organization"; approval_status: ApprovalStatus;
  work_status: WorkStatus; completed_by: string | null; completed_at: string | null; created_at: string; updated_at: string;
};
export type Skill = { id: string; name: string; created_at: string };
export type UserSkill = { user_id: string; skill_id: string; type: "existing" | "learning" };
export type ProjectSkill = { project_id: string; skill_id: string };
export type Member = { project_id: string; user_id: string; membership_status: "active" | "inactive"; created_at: string };
export type Request = { id: string; project_id: string; user_id: string; request_type: "join" | "invitation"; status: "pending" | "accepted" | "rejected"; reviewed_by: string | null; created_at: string; updated_at: string };
export type Deliverable = { id: string; project_id: string; contributor_id: string; url: string; summary: string; outcome: string; status: SubmissionStatus; reviewed_by: string | null; reviewed_at: string | null; feedback: string; created_at: string; updated_at: string };
export type Access = { email: string; user_id: string | null; active: boolean; created_at: string; updated_at: string };
type Table<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };
type ProjectInput = { p_title: string; p_description: string; p_skills: string[]; p_estimated_hours: number | null };
type Rpc<A, R = string> = { Args: A; Returns: R };
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>; projects: Table<Project>; skills: Table<Skill>; user_skills: Table<UserSkill>;
      project_skills: Table<ProjectSkill>; project_members: Table<Member>; project_requests: Table<Request>;
      project_deliverables: Table<Deliverable>; approved_emails: Table<Access>;
      user_roles: Table<{ user_id: string; role: Role; updated_at: string }>;
      user_availability: Table<{ user_id: string; available_hours: number | null; updated_at: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      workspace_active: Rpc<Record<string, never>, boolean>;
      workspace_admin: Rpc<Record<string, never>, boolean>;
      project_visible: Rpc<{ p_project_id: string }, boolean>;
      project_member: Rpc<{ p_project_id: string }, boolean>;
      save_profile: Rpc<{ p_display_name: string; p_bio: string; p_existing_skills: string[]; p_learning_skills: string[]; p_available_hours: number | null }>;
      set_directory_visibility: Rpc<{ p_hidden: boolean }>;
      save_interest: Rpc<{ p_interest: string }>;
      create_project: Rpc<ProjectInput>;
      edit_project: Rpc<ProjectInput & { p_project_id: string }>;
      request_publication: Rpc<{ p_project_id: string }>;
      assign_owner: Rpc<{ p_project_id: string; p_owner_id: string }>;
      review_publication: Rpc<{ p_project_id: string; p_approve: boolean }>;
      request_join: Rpc<{ p_project_id: string }>;
      review_join: Rpc<{ p_request_id: string; p_accept: boolean }>;
      submit_deliverable: Rpc<{ p_project_id: string; p_url: string; p_summary: string; p_outcome: string }>;
      review_deliverable: Rpc<{ p_deliverable_id: string; p_accept: boolean; p_feedback: string }>;
      complete_project: Rpc<{ p_project_id: string }>;
      start_project: Rpc<{ p_project_id: string }>;
      manage_access: Rpc<{ p_email: string; p_active: boolean }, string | null>;
      set_user_role: Rpc<{ p_user_id: string; p_role: Role }>;
    };
    Enums: { workspace_role: Role; skill_type: "existing" | "learning"; project_visibility: "private" | "organization"; approval_status: ApprovalStatus; work_status: WorkStatus; deliverable_status: SubmissionStatus };
    CompositeTypes: Record<string, never>;
  };
};
