import type { Metadata } from "next";
import HandbookDesk from "@/components/handbook/HandbookDesk";

export const metadata: Metadata = {
  title: "HawkxAI · Handbook",
  description: "Generated fleet handbook, HistGB model card, and AutoLineage — facts only.",
};

export default function HandbookPage() {
  return <HandbookDesk />;
}
