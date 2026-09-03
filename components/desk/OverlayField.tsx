"use client";

import { GhostButton, StatusChip } from "@/components/shell/DeskChrome";

export function OverlayField({
  inputId,
  value,
  onChange,
  onSubmit,
  onClear,
  overlaying,
  compareLabel,
  disabled,
}: {
  inputId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear?: () => void;
  overlaying: boolean;
  compareLabel: string;
  disabled?: boolean;
}) {
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex min-w-0 items-center gap-1.5"
      >
        <label htmlFor={inputId} className="sr-only">
          Overlay a second phrase
        </label>
        <input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="vs another phrase…"
          autoComplete="off"
          className="field-input max-w-[160px]"
        />
        <GhostButton type="submit" disabled={overlaying || disabled || value.trim().length < 2}>
          {overlaying ? "Overlay…" : compareLabel ? "Update" : "Overlay"}
        </GhostButton>
      </form>
      {compareLabel ? (
        <>
          <StatusChip>vs {compareLabel}</StatusChip>
          {onClear ? <GhostButton onClick={onClear}>Clear overlay</GhostButton> : null}
        </>
      ) : null}
    </>
  );
}
