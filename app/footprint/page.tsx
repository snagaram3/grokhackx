import type { Metadata } from "next";
import AIAgentsDesk from "@/components/ai-agents/AIAgentsDesk";

export const metadata: Metadata = {
  title: "Cost Calculator | HawkxAI Pro",
  description:
    "Editable API cost assumptions for AI agents — visible rates, splits, and overrides.",
};

export default function CalculatorPage() {
  return <AIAgentsDesk initialMode="calculator" />;
}
