"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Input } from "@/components/ui/input";

export function NetworkSearchForm({ defaultValue }: { defaultValue?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 flex-1">
      <Input
        name="q"
        placeholder="Search people, enrollment no., email, department, skills…"
        defaultValue={defaultValue}
      />
    </form>
  );
}
