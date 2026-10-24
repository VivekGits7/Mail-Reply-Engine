export const QUICK_SEARCH_EVENT = 'hr-desk:quick-search';

export function openQuickSearch() {
  window.dispatchEvent(new Event(QUICK_SEARCH_EVENT));
}
