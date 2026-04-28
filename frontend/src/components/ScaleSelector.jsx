const SCALES = [
  { id: "low", label: "Low", description: "Subtle improvement" },
  { id: "medium", label: "Medium", description: "Creative variation" },
  { id: "high", label: "High", description: "Bold transformation" }
];

export default function ScaleSelector({ value, onChange }) {
  return (
    <section>
      <h2 className="section-title mb-3">Variation scale</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {SCALES.map((scale) => (
          <button
            key={scale.id}
            type="button"
            className={`scale-card ${value === scale.id ? "scale-card-active" : ""}`}
            onClick={() => onChange(scale.id)}
          >
            <span className="text-sm font-semibold text-white">{scale.label}</span>
            <span className="mt-1 text-xs text-white/52">{scale.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
