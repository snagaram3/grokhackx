"use client";

import EmptyStage from "@/components/shell/EmptyStage";

const SUGGESTIONS = [
  { id: "camry", label: "Camry" },
  { id: "tesla", label: "Tesla" },
  { id: "photosynthesis", label: "photosynthesis" },
  { id: "wwdc", label: "WWDC" },
  { id: "heatwave", label: "#HeatWaveFit" },
] as const;

interface InsightsLookupProps {
  onLookup: (phrase: string) => void;
  onFocusLookup: () => void;
}

export default function InsightsLookup({ onLookup, onFocusLookup }: InsightsLookupProps) {
  return (
    <EmptyStage
      eyebrow="Insights"
      title="What are you trying to find the root of?"
      copy="Not ten blue links. A taproot: the name you plugged, the origin page, the family it sits in, and the oldest dated receipt we can prove. Overlay a second name on occurrence after lookup — two lines, not a shared WHY."
      primaryLabel="Focus lookup"
      onPrimary={onFocusLookup}
      suggestions={[...SUGGESTIONS]}
      onSuggest={onLookup}
    />
  );
}
