import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "alfred_ — Execution Decision Layer",
  description:
    "Given a proposed action and conversation context, decide whether to execute silently, execute and notify, confirm, clarify, or refuse.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
