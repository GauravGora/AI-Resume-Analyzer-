function AnalysisSection({ title, items, color }) {
  const colorStyles = {
    green: {
      border: "border-green-400/20",
      bg: "bg-green-400/10",
      text: "text-green-200",
      heading: "text-green-300",
    },
    yellow: {
      border: "border-yellow-400/20",
      bg: "bg-yellow-400/10",
      text: "text-yellow-200",
      heading: "text-yellow-300",
    },
    blue: {
      border: "border-blue-400/20",
      bg: "bg-blue-400/10",
      text: "text-blue-200",
      heading: "text-blue-300",
    },
  };

  const styles = colorStyles[color];

  const validItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (validItems.length === 0) return null;

  return (
    <div>
      {/* 🔥 IMPROVED HEADING */}
      <div className="mb-4 flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${styles?.bg || "bg-cyan-400"}`}></div>

        <h3
          className={`text-sm font-bold uppercase tracking-[0.2em] ${styles?.heading || "text-cyan-300"}`}
        >
          {title}
        </h3>
      </div>

      {/* LIST */}
      <ul className="space-y-3">
        {validItems.map((item, index) => (
          <li
            key={index}
            className={`rounded-[20px] border p-4 text-sm leading-7 ${styles?.border || "border-white/10"} ${styles?.bg || "bg-white/5"} ${styles?.text || "text-slate-300"}`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AnalysisSection;