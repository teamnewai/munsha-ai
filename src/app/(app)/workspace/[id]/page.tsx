import { getMemberById } from "@/app/actions/access";
import WorkspaceClient from "./WorkspaceClient";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getMemberById(id);

  if (!result.ok || !result.member) {
    return (
      <div className="p-10 text-center text-muted-foreground" dir="rtl">
        لم يُعثر على هذا المكتب في قاعدة البيانات.
      </div>
    );
  }

  return <WorkspaceClient member={result.member} />;
}
