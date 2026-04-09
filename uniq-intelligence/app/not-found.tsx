import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center text-neutral-100">
      <p className="text-sm text-neutral-400">Sayfa bulunamadı</p>
      <Link
        href="/"
        className="mt-4 text-sm font-medium text-[#c9a84c] hover:underline"
      >
        Ana sayfaya dön
      </Link>
    </div>
  );
}
