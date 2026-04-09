type ModulePlaceholderProps = {
  title: string;
  subtitle?: string;
};

export function ModulePlaceholder({ title, subtitle }: ModulePlaceholderProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#141414] p-8">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {subtitle ? (
        <p className="mt-2 text-sm text-neutral-400">{subtitle}</p>
      ) : null}
      <div className="mt-8 flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-[#c9a84c]/35 bg-[#0a0a0a]">
        <p className="text-sm text-neutral-400">
          İçerik alanı — bu modül yakında doldurulacak.
        </p>
      </div>
    </div>
  );
}
