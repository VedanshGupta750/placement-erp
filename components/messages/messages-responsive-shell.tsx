"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MessagesResponsiveShell({
  conversationList,
  children,
}: {
  conversationList: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hasOpenConversation = pathname !== "/messages";

  return (
    <div className="-mx-4 -mt-5 -mb-[calc(5.75rem+env(safe-area-inset-bottom))] flex h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))] min-w-0 overflow-hidden sm:-mx-6 sm:-mt-8 lg:-mb-8 lg:h-[calc(100dvh-3.5rem)]">
      <aside
        className={cn(
          "min-w-0 flex-col bg-background lg:flex lg:w-80 lg:shrink-0 lg:border-r xl:w-[340px]",
          hasOpenConversation ? "hidden" : "flex w-full",
        )}
      >
        {conversationList}
      </aside>

      <section
        className={cn(
          "min-w-0 flex-1 overflow-y-auto overscroll-contain bg-background lg:flex xl:overflow-hidden",
          hasOpenConversation ? "flex" : "hidden",
        )}
      >
        <div className="motion-safe:animate-in motion-safe:fade-in h-auto min-h-full w-full min-w-0 overflow-visible p-3 motion-safe:duration-200 sm:p-4 lg:p-5 xl:h-full xl:min-h-0 xl:overflow-hidden">
          {children}
        </div>
      </section>
    </div>
  );
}
