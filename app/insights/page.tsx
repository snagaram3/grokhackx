import type { Metadata } from "next";
import AIAgentsDesk from "@/components/ai-agents/AIAgentsDesk";

export const metadata: Metadata = {
  title: "Weekly Attention Read | HawkxAI Pro",
  description:
    "This week's AI agent attention briefing — generated from the same sourced dashboard data, no unsourced claims.",
};

export default function InsightsPage() {
  return <AIAgentsDesk initialMode="weekly" />;
}
