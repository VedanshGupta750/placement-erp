"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Briefcase, Building2, FileText, MessageSquare, Contact as ContactIcon } from "lucide-react";

type Result = { id: string; label: string; sublabel?: string; href: string };
type Results = {
  students: Result[];
  drives: Result[];
  companies: Result[];
  applications: Result[];
  messages: Result[];
  contacts: Result[];
};

const EMPTY_RESULTS: Results = { students: [], drives: [], companies: [], applications: [], messages: [], contacts: [] };

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults(await res.json());
      setLoading(false);
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const hasResults = Object.values(results).some((group) => group.length > 0);

  function updateQuery(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full min-w-0 flex-1">
      <div className="border-input bg-background flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
        <Search className="text-muted-foreground size-4 shrink-0" />
        <input
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search students, companies, drives…"
          aria-label="Search students, companies, drives, contacts, messages and applications"
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none"
        />
        <kbd className="text-muted-foreground bg-muted hidden shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </div>

      {open && query.trim().length >= 2 && (
        <div className="bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1.5 w-full overflow-hidden rounded-lg border shadow-lg">
          {loading && <div className="text-muted-foreground px-3 py-3 text-sm">Searching…</div>}
          {!loading && !hasResults && <div className="text-muted-foreground px-3 py-3 text-sm">No matches for &ldquo;{query}&rdquo;.</div>}
          {!loading && results.students.length > 0 && (
            <ResultGroup label="Students" icon={Users} items={results.students} onSelect={go} />
          )}
          {!loading && results.drives.length > 0 && (
            <ResultGroup label="Drives" icon={Briefcase} items={results.drives} onSelect={go} />
          )}
          {!loading && results.companies.length > 0 && (
            <ResultGroup label="Companies" icon={Building2} items={results.companies} onSelect={go} />
          )}
          {!loading && results.contacts.length > 0 && (
            <ResultGroup label="Contacts" icon={ContactIcon} items={results.contacts} onSelect={go} />
          )}
          {!loading && results.applications.length > 0 && (
            <ResultGroup label="Applications" icon={FileText} items={results.applications} onSelect={go} />
          )}
          {!loading && results.messages.length > 0 && (
            <ResultGroup label="Messages" icon={MessageSquare} items={results.messages} onSelect={go} />
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  label,
  icon: Icon,
  items,
  onSelect,
}: {
  label: string;
  icon: React.ElementType;
  items: Result[];
  onSelect: (href: string) => void;
}) {
  return (
    <div className="border-b py-1 last:border-b-0">
      <div className="text-muted-foreground px-3 py-1 text-[11px] font-semibold tracking-wide uppercase">{label}</div>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.href)}
          className="hover:bg-accent flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors"
        >
          <Icon className="text-muted-foreground size-3.5 shrink-0" />
          <span className="truncate font-medium">{item.label}</span>
          {item.sublabel && <span className="text-muted-foreground truncate text-xs">{item.sublabel}</span>}
        </button>
      ))}
    </div>
  );
}
