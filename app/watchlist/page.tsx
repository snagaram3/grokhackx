import type { Metadata } from "next";
import AIAgentsDesk from "@/components/ai-agents/AIAgentsDesk";

export const metadata: Metadata = {
  title: "Compare Agents | HawkxAI Pro",
  description:
    "Side-by-side attention and capability comparison for AI agents — rate of change first, sources linked.",
};

export default function ComparePage() {
  return <AIAgentsDesk initialMode="compare" />;
}
