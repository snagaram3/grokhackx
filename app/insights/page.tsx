import type { Metadata } from "next";
import AIAgentsDesk from "@/components/ai-agents/AIAgentsDesk";

export const metadata: Metadata = {
  title: "AI Agents Insights | HawkxAI",
  description: "Deep insights, trends, and analysis for AI agents and LLM models.",
};

export default function InsightsPage() {
  return <AIAgentsDesk />;
}
