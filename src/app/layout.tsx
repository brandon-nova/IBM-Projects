import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: { default: "IBM — Find work worth doing", template: "%s · IBM" }, description: "Discover a project, connect with people, and put your skills to work.", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
