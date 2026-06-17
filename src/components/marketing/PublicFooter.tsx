import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold font-extrabold text-golddark">
                مُ
              </span>
              <span className="text-lg font-extrabold text-fg">مُلكي إدراك</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-mut">
              نظام تشغيل الأعمال القائم على نواة عقارية. نُسجّل المعاملات — ولا نحتفظ بأموالك أبداً.
            </p>
            <a
              href="https://wa.me/966565574784"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gold/15 px-3 py-1.5 text-sm font-bold text-gold hover:bg-gold/25"
            >
              💬 واتساب: ‎+966 56 557 4784
            </a>
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
              { label: "من نحن", href: "/#features" },
              { label: "تواصل معنا", href: "https://wa.me/966565574784" },
              { label: "ابدأ مجاناً", href: "/login?mode=signup" },
            ]}
          />
          <FooterCol
            title="قانوني"
            links={[
              { label: "سياسة الخصوصية (PDPL)", href: "/privacy" },
              { label: "الشروط والأحكام", href: "/terms" },
              { label: "الامتثال (ZATCA)", href: "/terms#zatca" },
            ]}
          />
        </div>

        <div className="mt-10 border-t border-line pt-6 text-center text-sm text-mut">
          <p>© {new Date().getFullYear()} مُلكي (MULKI). جميع الحقوق محفوظة.</p>
          <p className="mt-1 text-xs">
            الكيان: مسجّل في الإمارات العربية المتحدة · للتواصل: ‎+966 56 557 4784
          </p>
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
      <h4 className="mb-3 text-sm font-bold text-fg">{title}</h4>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-sm text-mut hover:text-gold">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
