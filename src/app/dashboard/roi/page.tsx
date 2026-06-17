import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata: Metadata = { title: "العائد على الاستثمار" };

export default function Page() {
  return (
    <ModulePlaceholder
      icon="💹"
      title="العائد على الاستثمار"
      description="نموذج مالي لقياس العائد على الاستثمار لكل قناة وعقار."
      features={["العائد لكل قناة", "العائد لكل عقار", "تكلفة الاستحواذ", "توقّعات مالية"]}
    />
  );
}
