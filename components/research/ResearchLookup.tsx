"use client";

import DemoWalk from "@/components/desk/DemoWalk";
import EmptyStage from "@/components/shell/EmptyStage";

const SUGGESTIONS = [
  { id: "crispr", label: "CRISPR gene editing ethics" },
  { id: "supply", label: "Semiconductor supply chain 2026" },
  { id: "arctic", label: "Arctic shipping routes" },
  { id: "open", label: "Open-source AI model licensing" },
  { id: "water", label: "Urban water scarcity" },
] as const;

interface ResearchLookupProps {
  onLookup: (topic: string) => void;
  onFocusLookup: () => void;
}

export default function ResearchLookup({ onLookup, onFocusLookup }: ResearchLookupProps) {
  return (
    <EmptyStage
      eyebrow="Research"
      title="Research a topic"
      copy="Dig Wikipedia, PubMed, arXiv, USPTO, the open web, and live discussion. Occurrence fills from the same phrase. Overlay a second name after lookup: two lines, not a shared story. Findings cite sources. Thin evidence stays thin."
      primaryLabel="Focus research"
      onPrimary={onFocusLookup}
      suggestions={[...SUGGESTIONS]}
      onSuggest={onLookup}
    >
      <DemoWalk />
    </EmptyStage>
  );
}
