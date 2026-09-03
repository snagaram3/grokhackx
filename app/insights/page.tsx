import type { Metadata } from "next";
import InsightsDesk from "@/components/insights/InsightsDesk";

export const metadata: Metadata = {
  title: "HawkxAI · Insights",
  description: "Trace a particular name to its origin page, family, and oldest dated receipt.",
};

export default function InsightsPage() {
  return <InsightsDesk />;
}
