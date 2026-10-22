import { requireViewer } from "@/lib/auth";
import { AuthForm } from "@/components/forms";
import { PageTitle } from "@/components/shell";
export default async function ResetPassword() {
  await requireViewer();
  return <div className="max-w-lg mx-auto"><PageTitle title="Choose a new password" description="After saving, sign in again with your new password." /><div className="panel"><AuthForm mode="password" /></div></div>;
}
