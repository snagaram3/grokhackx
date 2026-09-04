import AIAgentsDesk from "@/components/ai-agents/AIAgentsDesk";

export const metadata = {
  title: "Agent Intelligence | HawkxAI",
  description:
    "What's shifting this week in AI agents — independent attention from public discourse, not vendor benchmarks.",
};

export default function AIAgentsPage() {
  return <AIAgentsDesk initialMode="trends" />;
}
