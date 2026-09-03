import type { Metadata } from "next";
import ArchitectureDesk from "@/components/architecture/ArchitectureDesk";

export const metadata: Metadata = {
  title: "HawkxAI · Architecture",
  description: "Cloud Run desk and ADK fleet: Gemini 3.5, GCS snapshots, Cloud SQL lineage. Receipts only.",
};

export default function ArchitecturePage() {
  return <ArchitectureDesk />;
}
