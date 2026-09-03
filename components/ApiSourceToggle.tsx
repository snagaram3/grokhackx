"use client";

import { useEffect, useState, useCallback } from "react";
import {
  API_SOURCE_CATEGORIES,
  loadApiSourceSelection,
  toggleApiSource,
  toggleCategory,
  enableAllSources,
  disableAllSources,
  type ApiSourceSelection,
} from "@/lib/api-source-selection";

export function ApiSourceToggle() {
  const [isOpen, setIsOpen] = useState(false);
  const [selection, setSelection] = useState<ApiSourceSelection | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSelection(loadApiSourceSelection());
  }, []);

  const updateCookie = useCallback((enabled: string[]) => {
    // Set cookie for 30 days
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    document.cookie = `hawkxai-api-sources=${encodeURIComponent(JSON.stringify(enabled))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  }, []);

  const handleToggleSource = useCallback((source: string) => {
    const updated = toggleApiSource(source);
    setSelection(updated);
    updateCookie(updated.enabled);
    window.dispatchEvent(new CustomEvent("api-sources-changed", { detail: updated }));
  }, [updateCookie]);

  const handleToggleCategory = useCallback((category: string, enable: boolean) => {
    const updated = toggleCategory(category, enable);
    setSelection(updated);
    updateCookie(updated.enabled);
    window.dispatchEvent(new CustomEvent("api-sources-changed", { detail: updated }));
  }, [updateCookie]);

  const handleEnableAll = useCallback(() => {
    const updated = enableAllSources();
    setSelection(updated);
    updateCookie(updated.enabled);
    window.dispatchEvent(new CustomEvent("api-sources-changed", { detail: updated }));
  }, [updateCookie]);

  const handleDisableAll = useCallback(() => {
    const updated = disableAllSources();
    setSelection(updated);
    updateCookie(updated.enabled);
    window.dispatchEvent(new CustomEvent("api-sources-changed", { detail: updated }));
  }, [updateCookie]);

  if (!mounted || !selection) {
    return null;
  }

  const enabledCount = selection.enabled.length;
  const totalCount = API_SOURCE_CATEGORIES.reduce((sum, cat) => sum + cat.sources.length, 0);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-white/15 bg-[#0a0e17] px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur-sm transition-all hover:border-white/25 hover:bg-[#0d1119]"
        aria-label="Toggle API source selection"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          />
        </svg>
        API Sources
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
          {enabledCount}/{totalCount}
        </span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-x-4 bottom-20 top-4 z-50 overflow-hidden rounded-xl border border-white/15 bg-[#0a0e17] shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[600px]">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">API Source Selection</h2>
                  <p className="mt-0.5 text-sm text-white/60">
                    Choose which sources to use for data collection
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="flex gap-2 border-b border-white/10 px-6 py-3">
                <button
                  onClick={handleEnableAll}
                  className="rounded border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
                >
                  Enable All
                </button>
                <button
                  onClick={handleDisableAll}
                  className="rounded border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
                >
                  Disable All
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-6">
                  {API_SOURCE_CATEGORIES.map((category) => {
                    const allEnabled = category.sources.every((s) =>
                      selection.enabled.includes(s)
                    );
                    const someEnabled = category.sources.some((s) =>
                      selection.enabled.includes(s)
                    );
                    const enabledInCategory = category.sources.filter((s) =>
                      selection.enabled.includes(s)
                    ).length;

                    return (
                      <div key={category.name} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleCategory(category.name, !allEnabled)}
                              className={`relative h-5 w-5 flex-shrink-0 rounded border transition-all ${
                                allEnabled
                                  ? "border-blue-500 bg-blue-500"
                                  : someEnabled
                                    ? "border-blue-500 bg-blue-500/50"
                                    : "border-white/30 bg-transparent"
                              }`}
                              aria-label={`Toggle ${category.name} category`}
                            >
                              {allEnabled && (
                                <svg
                                  className="absolute inset-0 h-full w-full p-0.5 text-white"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                              {!allEnabled && someEnabled && (
                                <div className="absolute inset-1 rounded-sm bg-white" />
                              )}
                            </button>
                            <div>
                              <h3 className="font-medium text-white">{category.name}</h3>
                              <p className="text-xs text-white/50">{category.description}</p>
                            </div>
                          </div>
                          <span className="text-xs text-white/60">
                            {enabledInCategory}/{category.sources.length}
                          </span>
                        </div>

                        <div className="ml-8 flex flex-wrap gap-2">
                          {category.sources.map((source) => {
                            const isEnabled = selection.enabled.includes(source);
                            return (
                              <button
                                key={source}
                                onClick={() => handleToggleSource(source)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                                  isEnabled
                                    ? "border-blue-500/50 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                                    : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
                                }`}
                              >
                                {source}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/10 px-6 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">
                    {enabledCount} of {totalCount} sources enabled
                  </span>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg border border-white/15 bg-blue-500 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-600"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
