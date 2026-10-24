import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router';
import { exitListQuery } from '@/components/exits/Exitsapi';
import { joinerListQuery } from '@/components/joiners/Joinersapi';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Avatar } from '@/components/visual/Avatar';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { QUICK_SEARCH_EVENT } from '@/utils/quickSearch';

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 5;
const CLOSED_WIDTH = 44;
const MAX_WIDTH = 520;
const MIN_FREE_WIDTH = 280;
const EDGE_GAP = 12;

interface Result {
  caseId: string;
  name: string;
  kind: 'Joiner' | 'Exit';
  stage: string;
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

function openWidth(anchor: HTMLElement) {
  const header = anchor.closest('header');
  const box = anchor.getBoundingClientRect();
  if (!header) return MAX_WIDTH;
  const edge = header.getBoundingClientRect().left + EDGE_GAP;
  const lastTab = [...header.querySelectorAll('nav li:last-child')]
    .map((element) => element.getBoundingClientRect())
    .find((rect) => rect.width > 0 && rect.top < box.bottom && rect.bottom > box.top);
  const free = lastTab ? box.right - lastTab.right - EDGE_GAP : 0;
  return Math.min(MAX_WIDTH, free >= MIN_FREE_WIDTH ? free : box.right - edge);
}

export function QuickSearch() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(MAX_WIDTH);
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [cursor, setCursor] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const expand = useCallback(() => {
    if (wrapRef.current) setWidth(openWidth(wrapRef.current));
    setOpen(true);
    inputRef.current?.focus();
  }, []);

  const collapse = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
    setText('');
    setTerm('');
    setCursor(0);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const shortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (shortcut || (event.key === '/' && !isTypingTarget(event.target))) {
        event.preventDefault();
        expand();
      }
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener(QUICK_SEARCH_EVENT, expand);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(QUICK_SEARCH_EVENT, expand);
      clearTimeout(timer.current);
    };
  }, [expand]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!wrapRef.current?.contains(target) && !contentRef.current?.contains(target)) collapse();
    }
    function onResize() {
      if (wrapRef.current) setWidth(openWidth(wrapRef.current));
    }
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open, collapse]);

  const enabled = term.length >= 2;
  const joiners = useQuery({ ...joinerListQuery({ search: term, limit: RESULT_LIMIT, offset: 0 }), enabled });
  const exits = useQuery({ ...exitListQuery({ search: term, limit: RESULT_LIMIT, offset: 0 }), enabled });
  const results: Result[] = [
    ...(joiners.data?.data ?? []).map((item) => ({
      caseId: item.case_id,
      name: item.full_name,
      kind: 'Joiner' as const,
      stage: item.stage,
    })),
    ...(exits.data?.data ?? []).map((item) => ({
      caseId: item.case_id,
      name: item.full_name,
      kind: 'Exit' as const,
      stage: item.stage,
    })),
  ];
  const loading = enabled && (joiners.isFetching || exits.isFetching) && !results.length;
  const showResults = open && text.trim().length > 0;

  function go(result?: Result) {
    if (!result) return;
    collapse();
    inputRef.current?.blur();
    navigate(`/cases/${result.caseId}`);
  }

  return (
    <div ref={wrapRef} className="relative size-11 shrink-0">
      <Popover open={showResults} onOpenChange={(next) => !next && collapse()}>
        <PopoverAnchor asChild>
          <motion.div
            className={cn(
              'absolute top-0 right-0 z-20 flex h-11 items-center overflow-hidden pill rounded-full transition-shadow',
              open && 'ring-3 ring-ring/30',
            )}
            initial={false}
            animate={{ width: open ? width : CLOSED_WIDTH }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
          >
            <button
              type="button"
              tabIndex={open ? -1 : 0}
              onClick={expand}
              aria-label="Search people"
              aria-keyshortcuts="Meta+K Control+K /"
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground/80 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Search className="size-4.5" aria-hidden="true" />
            </button>
            <input
              ref={inputRef}
              value={text}
              tabIndex={open ? 0 : -1}
              aria-hidden={!open}
              role="combobox"
              aria-label="Find a joiner or exit by name"
              aria-expanded={showResults}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={showResults && results[cursor] ? `${listId}-${cursor}` : undefined}
              placeholder="Find a joiner or exit…"
              className="h-full min-w-0 flex-1 bg-transparent pr-2 text-sm outline-none placeholder:text-muted-foreground"
              onChange={(event) => {
                const next = event.target.value;
                setText(next);
                setCursor(0);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => setTerm(next.trim()), DEBOUNCE_MS);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setCursor((value) => Math.min(value + 1, Math.max(results.length - 1, 0)));
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setCursor((value) => Math.max(value - 1, 0));
                } else if (event.key === 'Enter') {
                  event.preventDefault();
                  go(results[cursor]);
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  collapse();
                  event.currentTarget.blur();
                }
              }}
            />
            {open && (
              <button
                type="button"
                onClick={collapse}
                aria-label="Close search"
                className="mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </motion.div>
        </PopoverAnchor>
        <PopoverContent
          ref={contentRef}
          align="end"
          sideOffset={8}
          className="w-[max(var(--radix-popover-trigger-width),min(24rem,calc(100vw_-_1.5rem)))] p-2"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (wrapRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
        >
          <div className="max-h-80 overflow-y-auto" aria-live="polite">
            {!enabled ? (
              <p className="px-3 py-5 text-center text-sm text-muted-foreground">
                Type at least two letters of a name.
              </p>
            ) : loading ? (
              <div className="space-y-2 p-1">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : results.length === 0 ? (
              <p className="px-3 py-5 text-center text-sm text-muted-foreground">Nobody matches “{term}”.</p>
            ) : (
              <ul id={listId} role="listbox" aria-label="Matching people" className="flex flex-col gap-1">
                {results.map((result, index) => (
                  <li
                    key={result.caseId}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === cursor}
                  >
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => go(result)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                        index === cursor ? 'bg-muted' : 'hover:bg-muted/60',
                      )}
                    >
                      <Avatar name={result.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{result.name}</span>
                        <span className="text-xs text-muted-foreground">{result.kind}</span>
                      </span>
                      <StatusBadge value={result.stage} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
