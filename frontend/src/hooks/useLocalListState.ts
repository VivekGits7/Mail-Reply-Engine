import { useState } from 'react';

export const DEFAULT_PAGE_SIZE = 25;

// Same shape as useUrlState, but backed by local state instead of the URL's
// search params. Every section on the merged single-page dashboard shares one
// URL, so list pages that filter/sort/paginate via the URL would collide with
// each other (e.g. two sections both reading "?search="). Sections rendered on
// the dashboard use this instead; detail routes (their own URL) keep useUrlState.
export function useLocalListState() {
  const [params, setParamsState] = useState<Record<string, string>>({});

  function get(key: string): string | undefined {
    return params[key] || undefined;
  }

  function set(updates: Record<string, string | undefined>, { keepPage = false } = {}) {
    setParamsState((prev) => {
      const next = { ...prev };
      Object.entries(updates).forEach(([key, value]) => {
        if (value) next[key] = value;
        else delete next[key];
      });
      if (!keepPage && !('offset' in updates)) delete next.offset;
      return next;
    });
  }

  const offset = Math.max(0, Number(params.offset ?? 0) || 0);
  const page = { limit: DEFAULT_PAGE_SIZE, offset };

  return { get, set, page };
}
