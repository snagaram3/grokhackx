import type { Metadata } from "next";
import AIAgentsDesk from "@/components/ai-agents/AIAgentsDesk";

export const metadata: Metadata = {
  title: "AI Agents Comparison | HawkxAI",
  description: "Compare AI agents and LLM models side-by-side. Capabilities, pricing, and metrics.",
};

export default function ComparePage() {
  return <AIAgentsDesk />;
}
