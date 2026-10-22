import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: { default: "Soverflow — Find work worth doing", template: "%s · Soverflow" }, description: "Find a small project, contribute your skills, and make something useful.", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
