const CATEGORIES = [
  {
    id: "enhance_self",
    icon: "👤",
    title: "Enhance Self",
    description: "Portrait polish, realistic lighting, natural refinement."
  },
  {
    id: "style_fashion",
    icon: "👗",
    title: "Style & Fashion",
    description: "Editorial outfits, accessories, and premium styling."
  },
  {
    id: "travel_scene",
    icon: "✈️",
    title: "Travel Scene",
    description: "Cinematic destinations with believable perspective."
  },
  {
    id: "food_aesthetic",
    icon: "🍔",
    title: "Food Aesthetic",
    description: "Restaurant-quality plating, color, and appetizing detail."
  },
  {
    id: "fitness_look",
    icon: "💪",
    title: "Fitness Look",
    description: "Athletic styling, motivational lighting, confident mood."
  }
];

export default function CategorySelector({ value, onChange }) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="section-title">Intent</h2>
        <span className="text-xs text-white/45">5 modes</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`category-card ${value === category.id ? "category-card-active" : ""}`}
            onClick={() => onChange(category.id)}
          >
            <span className="text-3xl" aria-hidden="true">
              {category.icon}
            </span>
            <span className="mt-3 text-left text-base font-semibold text-white">{category.title}</span>
            <span className="mt-2 text-left text-xs leading-5 text-white/55">{category.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
