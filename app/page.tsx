import AIAgentsDesk from "@/components/ai-agents/AIAgentsDesk";

export const metadata = {
  title: "Agent Intelligence | HawkxAI",
  description:
    "What's shifting this week in AI agents — independent attention from public discourse, not vendor benchmarks. For engineering leaders choosing a build target.",
};

export default function Home() {
  return <AIAgentsDesk initialMode="trends" />;
}
