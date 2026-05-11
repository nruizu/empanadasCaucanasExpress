interface SectionTitleProps {
  title: string;
  subtitle?: string;
}

export default function SectionTitle({ title, subtitle }: SectionTitleProps) {
  return (
    <header className="mb-6">
      <h2 className="text-2xl font-bold text-[var(--primary)] md:text-3xl">{title}</h2>
      {subtitle ? <p className="mt-2 text-sm text-[var(--muted-foreground)] md:text-base">{subtitle}</p> : null}
    </header>
  );
}
