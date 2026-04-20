import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "alfred_ — Execution Decision Layer",
  description:
    "Given a proposed action and conversation context, decide whether to execute silently, execute and notify, confirm, clarify, or refuse.",
};

// Runs before first paint so we don't flash the wrong theme.
const THEME_INIT = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    var mql = window.matchMedia('(prefers-color-scheme: dark)');
    if (t === 'dark' || (!t && mql.matches)) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
