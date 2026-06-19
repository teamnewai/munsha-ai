import { ExecutiveDashboard } from "@/components/os-app/ExecutiveDashboard";
import { getOsData } from "@/lib/os-live";

export const metadata = { title: "مركز القيادة التنفيذي — مُلكي OS" };
export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const data = await getOsData();
  return <ExecutiveDashboard data={data} />;
}
