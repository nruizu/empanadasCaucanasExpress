export default function TrustSection() {
  const features = [
    {
      title: "Tradición desde 1972",
      description: "Más de 50 años de sabor auténtico.",
      icon: "award",
    },
    {
      title: "Calidad artesanal",
      description: "Recetas tradicionales preparadas al momento.",
      icon: "heart",
    },
    {
      title: "Sede El Retiro",
      description: "Visítanos y disfruta la experiencia completa.",
      icon: "location",
    },
  ] as const;

  return (
    <section className="bg-gradient-to-br from-[color-mix(in_srgb,var(--primary)_5%,white)] to-[color-mix(in_srgb,var(--secondary)_10%,white)] px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold text-[var(--primary)] md:text-3xl">
          ¿Por qué Empanadas Caucanas?
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-xl bg-[var(--card)] p-6 text-center shadow-md transition-shadow hover:shadow-lg">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--secondary)_25%,white)] text-[var(--primary)]">
                {feature.icon === "award" ? "★" : feature.icon === "heart" ? "♥" : "⌖"}
              </div>
              <h3 className="text-lg font-semibold text-[var(--primary)]">{feature.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
