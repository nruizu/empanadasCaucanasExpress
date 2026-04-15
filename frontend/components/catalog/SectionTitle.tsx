interface SectionTitleProps {
  title: string;
  subtitle?: string;
}

export default function SectionTitle({ title, subtitle }: SectionTitleProps) {
  return (
    <header className="mb-5">
      <h2 className="text-2xl font-bold text-[var(--cce-green-dark)] md:text-3xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-sm text-[var(--cce-text-muted)]">{subtitle}</p>
      ) : null}
    </header>
  );
}
