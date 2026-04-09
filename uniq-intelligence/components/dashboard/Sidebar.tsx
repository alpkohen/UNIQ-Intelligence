"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNav } from "@/lib/dashboard-nav";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-60 flex-col border-r border-white/10 bg-[#111111]">
      <div className="flex h-14 shrink-0 items-center border-b border-white/10 px-5">
        <Link
          href="/"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c9a84c] transition-opacity hover:opacity-90"
        >
          UNIQ
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {dashboardNav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-r-lg border-l-2 py-2.5 pl-[10px] pr-3 text-sm transition-colors ${
                active
                  ? "border-[#c9a84c] bg-[#c9a84c]/10 text-[#c9a84c]"
                  : "border-transparent text-neutral-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="font-medium text-inherit">{item.labelTr}</span>
              <span
                className={`mt-0.5 block text-[11px] font-normal ${
                  active ? "text-[#c9a84c]/75" : "text-neutral-400"
                }`}
              >
                {item.labelEn}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
