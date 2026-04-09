export type NavItem = {
  href: string;
  labelTr: string;
  labelEn: string;
};

export const dashboardNav: NavItem[] = [
  { href: "/egitimler", labelTr: "Eğitimler", labelEn: "Trainings" },
  { href: "/pipeline", labelTr: "Pipeline", labelEn: "CRM" },
  { href: "/nakit-akisi", labelTr: "Nakit Akışı", labelEn: "Cash Flow" },
  {
    href: "/degerlendirmeler",
    labelTr: "Değerlendirmeler",
    labelEn: "Evaluations",
  },
  { href: "/ai-chat", labelTr: "AI Chat", labelEn: "AI Chat" },
];
