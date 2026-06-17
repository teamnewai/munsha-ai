import Link from "next/link";

/**
 * بطاقة "قيد الإنشاء" موحّدة للوحدات التي لم تُبنَ بالكامل بعد.
 * تعرض الوصف من الوثيقة والميزات القادمة، حتى لا يصطدم المستخدم بصفحة فارغة.
 */
export function ModulePlaceholder({
  icon,
  title,
  description,
  features,
}: {
  icon: string;
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-3xl border border-line bg-card p-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gold/10 text-3xl">
          {icon}
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-fg">{title}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-mut">
          {description}
        </p>

        <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold/15 px-4 py-1.5 text-xs font-bold text-gold">
          🚧 قيد الإنشاء — قادم في المراحل القادمة
        </span>

        <div className="mt-8 grid gap-3 text-right sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f}
              className="flex items-start gap-2 rounded-xl border border-line bg-card2 p-3 text-sm text-mut"
            >
              <span className="mt-0.5 text-gold">◆</span>
              {f}
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link
            href="/dashboard"
            className="text-sm font-bold text-gold hover:underline"
          >
            ← العودة للوحة التحكم
          </Link>
        </div>
      </div>
    </div>
  );
}
