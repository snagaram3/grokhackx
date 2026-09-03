import type { Metadata } from "next";
import AIAgentsDesk from "@/components/ai-agents/AIAgentsDesk";

export const metadata: Metadata = {
  title: "Cost Calculator | HawkxAI",
  description: "Calculate API costs for AI agents and LLM models based on token usage.",
};

export default function CalculatorPage() {
  return <AIAgentsDesk />;
}
