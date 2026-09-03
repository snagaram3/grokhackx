"use client";

import type { ReactNode } from "react";
import { ArchitecturePoster } from "@/components/architecture/ArchitecturePoster";
import { MermaidDiagram } from "@/components/architecture/MermaidDiagram";
import { ARCHITECTURE_SECTIONS } from "@/lib/architecture-diagrams";

function ArchitectureFrame({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-8 px-6 py-8">
      {children}
    </main>
  );
}

function ArchitectureHeader() {
  return (
    <header className="flex flex-col gap-3">
      <h1 className="text-2xl font-medium tracking-[-0.03em] text-[var(--ink)]">
        Runtime architecture
      </h1>
      <p className="max-w-2xl text-sm leading-6 text-[var(--mute-strong)]">
        Two Cloud Run services, one phrase plug. The poster is the contest diagram.
        HistGB and the generated handbook live on{" "}
        <a href="/handbook" className="underline-offset-2 hover:underline">
          /handbook
        </a>
        . Static export:{" "}
        <a href="/demo/architecture.html" className="underline-offset-2 hover:underline">
          /demo/architecture.html
        </a>
        .
      </p>
    </header>
  );
}

function ArchitectureSection({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-[var(--ink)]">{title}</h2>
        <p className="text-sm leading-6 text-[var(--mute-strong)]">{caption}</p>
      </div>
      {children}
    </section>
  );
}

export default function ArchitectureDesk() {
  return (
    <ArchitectureFrame>
      <ArchitectureHeader />
      <ArchitecturePoster />
      {ARCHITECTURE_SECTIONS.map((section) => (
        <ArchitectureSection key={section.id} title={section.title} caption={section.caption}>
          <MermaidDiagram chart={section.chart} />
        </ArchitectureSection>
      ))}
    </ArchitectureFrame>
  );
}
