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
    default: "bg-gray-100 text-gray-700 border-gray-200",
    green: "bg-green-50 text-green-700 border-green-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    red: "bg-red-50 text-red-700 border-red-200",
    gray: "bg-gray-50 text-gray-500 border-gray-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${tones[tone]}`}
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
      className="border border-gray-200 rounded-lg bg-white mb-2 open:shadow-sm"
      open={defaultOpen}
    >
      <summary className="cursor-pointer px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-900 hover:bg-gray-50 rounded-lg">
        <span className="flex items-center gap-2">
          <span>{title}</span>
          {subtitle && (
            <span className="text-xs text-gray-500 font-normal">
              {subtitle}
            </span>
          )}
        </span>
        <span className="text-gray-400 text-xs">▾</span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-sm text-gray-700">{children}</div>
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
    <pre className="text-xs leading-relaxed bg-gray-50 border border-gray-200 rounded-md p-3 overflow-auto max-h-96 whitespace-pre-wrap break-words text-gray-800">
      {text}
    </pre>
  );
}

export function CopyButton({
  text,
  label = "copy",
}: {
  text: string;
  label?: string;
}) {
  const onClick = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-0.5 rounded-md border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-400 bg-white"
    >
      {label}
    </button>
  );
}

export function Divider() {
  return <div className="border-t border-gray-200 my-4" />;
}
