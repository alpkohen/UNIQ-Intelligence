import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-col bg-[#0a0a0a] pl-60">
        <Header />
        <main className="flex-1 overflow-auto bg-[#0a0a0a] p-6 text-neutral-100">
          {children}
        </main>
      </div>
    </div>
  );
}
