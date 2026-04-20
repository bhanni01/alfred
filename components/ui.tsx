"use client";

import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?:
    | "default"
    | "green"
    | "blue"
    | "amber"
    | "purple"
    | "red"
    | "gray"
    | "indigo";
}) {
  const tones: Record<string, string> = {
    default: "bg-neutral-800 text-neutral-200 border-neutral-700",
    green: "bg-green-900/40 text-green-300 border-green-800",
    blue: "bg-blue-900/40 text-blue-300 border-blue-800",
    amber: "bg-amber-900/40 text-amber-300 border-amber-800",
    purple: "bg-purple-900/40 text-purple-300 border-purple-800",
    red: "bg-red-900/40 text-red-300 border-red-800",
    gray: "bg-neutral-900 text-neutral-400 border-neutral-800",
    indigo: "bg-indigo-900/40 text-indigo-300 border-indigo-800",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Section({
  title,
  children,
  defaultOpen = false,
  subtitle,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  subtitle?: string;
}) {
  return (
    <details
      className="border border-neutral-800 rounded bg-neutral-950/50 mb-2 open:bg-neutral-900/30"
      open={defaultOpen}
    >
      <summary className="cursor-pointer px-3 py-2 flex items-center justify-between text-sm font-medium text-neutral-200 hover:bg-neutral-900 rounded">
        <span className="flex items-center gap-2">
          <span>{title}</span>
          {subtitle && (
            <span className="text-xs text-neutral-500 font-normal">
              {subtitle}
            </span>
          )}
        </span>
        <span className="text-neutral-500 text-xs">▾</span>
      </summary>
      <div className="px-3 pb-3 pt-1 text-sm text-neutral-300">{children}</div>
    </details>
  );
}

export function JSONView({ value }: { value: unknown }) {
  let text: string;
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  return (
    <pre className="text-xs leading-relaxed bg-neutral-950 border border-neutral-800 rounded p-3 overflow-auto max-h-96 whitespace-pre-wrap break-words">
      {text}
    </pre>
  );
}

export function CopyButton({ text, label = "copy" }: { text: string; label?: string }) {
  const onClick = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-0.5 rounded border border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500"
    >
      {label}
    </button>
  );
}

export function Divider() {
  return <div className="border-t border-neutral-800 my-3" />;
}
