import type { Metadata } from "next";
import AIAgentsDesk from "@/components/ai-agents/AIAgentsDesk";

export const metadata: Metadata = {
  title: "AI Market Research | HawkxAI",
  description: "Market analysis, adoption trends, and competitive research for AI agents.",
};

export default function ResearchPage() {
  return <AIAgentsDesk />;
}
