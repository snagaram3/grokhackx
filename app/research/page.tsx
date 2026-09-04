import type { Metadata } from "next";
import AIAgentsDesk from "@/components/ai-agents/AIAgentsDesk";

export const metadata: Metadata = {
  title: "Attention Alerts | HawkxAI Pro",
  description:
    "Trajectory alerts when an agent's public attention rate-of-change or concentration shifts.",
};

export default function ResearchPage() {
  return <AIAgentsDesk initialMode="alerts" />;
}
