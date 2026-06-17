import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-extrabold text-white">
                مُ
              </span>
              <span className="text-lg font-extrabold text-brand-900">مُلكي</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              نظام تشغيل الأعمال القائم على نواة عقارية. نُسجّل المعاملات — ولا نحتفظ بأموالك أبداً.
            </p>
          </div>

          <FooterCol
            title="المنصة"
            links={[
              { label: "المزايا", href: "/#features" },
              { label: "نظام التشغيل", href: "/#os" },
              { label: "الأسعار", href: "/pricing" },
            ]}
          />
          <FooterCol
            title="الشركة"
            links={[
              { label: "من نحن", href: "/#" },
              { label: "تواصل معنا", href: "/#" },
              { label: "الوظائف", href: "/#" },
            ]}
          />
          <FooterCol
            title="قانوني"
            links={[
              { label: "الخصوصية (PDPL)", href: "/#" },
              { label: "الشروط والأحكام", href: "/#" },
              { label: "الامتثال (ZATCA)", href: "/#" },
            ]}
          />
        </div>

        <div className="mt-10 border-t border-slate-100 pt-6 text-center text-sm text-slate-400">
          © {new Date().getFullYear()} مُلكي. جميع الحقوق محفوظة.
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-bold text-slate-800">{title}</h4>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-sm text-slate-500 hover:text-brand-700">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
