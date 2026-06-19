import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function CompaniesPage() {
  return (
    <div className="p-6 md:p-8">
      <Card className="mulki-card p-12 text-center">
        <Sparkles className="size-10 text-primary mx-auto mb-4" />
        <h2 className="font-display text-2xl font-semibold mb-2">الشركات</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          هذه الوحدة ستُطلَق في مرحلة قادمة من مُلكي OS. البنية البيانية والصلاحيات جاهزة — وستلحقها واجهة الاستخدام وتنسيق الذكاء الاصطناعي.
        </p>
      </Card>
    </div>
  );
}
