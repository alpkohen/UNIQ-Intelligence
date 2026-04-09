import Link from "next/link";
import { dashboardNav } from "@/lib/dashboard-nav";

export default function HubHomePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-neutral-400">
        Hoş geldiniz. Aşağıdaki modüllere geçebilir veya soldaki menüyü
        kullanabilirsiniz.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {dashboardNav.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-xl border border-white/10 bg-[#141414] p-4 transition-colors hover:border-[#c9a84c]/50 hover:bg-[#1a1a1a]"
            >
              <span className="font-medium text-white">{item.labelTr}</span>
              <span className="mt-1 block text-xs text-neutral-400">
                {item.labelEn}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
