import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ExpandableDescription({ text }: { text: string }) {
  const shouldCollapse = text.length > 420;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-4">
      <div className={cn("relative", !expanded && shouldCollapse && "max-h-[28rem] overflow-hidden")}>
        <p className="whitespace-pre-line text-[15px] leading-7 text-[var(--muted-foreground)]">{text}</p>
        {!expanded && shouldCollapse ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.1)_28%,rgba(255,255,255,0.45)_72%,rgba(255,255,255,0.6))]">
            <div className="absolute inset-x-0 bottom-0 h-10 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.55))]" />
          </div>
        ) : null}
      </div>

      {shouldCollapse ? (
        <button
          type="button"
          className="mt-5 inline-flex rounded-full border border-[var(--border)] bg-white/75 px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--primary)]/35 hover:bg-white"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      ) : null}
    </div>
  );
}

export function InfoBlock({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-base font-semibold">{label}</p>
      <p className="mt-1 text-sm leading-7 text-[var(--muted-foreground)]">{value}</p>
    </div>
  );
}
