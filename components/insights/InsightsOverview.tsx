"use client";

interface InsightsOverviewProps {
  names: string[];
  selected: string | null;
  onSelect: (name: string) => void;
}

export default function InsightsOverview({
  names,
  selected,
  onSelect,
}: InsightsOverviewProps) {
  if (names.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="signal-label text-center">No traces yet · Plug a name to go down</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-3">
      {names.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onSelect(name)}
          className={`rounded-lg border p-3 text-left transition-colors duration-150 ${
            selected === name
              ? "border-white/30 bg-white/[0.08]"
              : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
          }`}
        >
          <p className="truncate font-medium text-white">{name}</p>
          <p className="mt-0.5 text-[11px] text-white/50">Taproot · click to retrace</p>
        </button>
      ))}
    </div>
  );
}
