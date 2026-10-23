import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = { title: { default: "IBM — Find work worth doing", template: "%s · IBM" }, description: "Discover a project, connect with people, and put your skills to work.", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: "try{var p=localStorage.getItem('ibm-theme');document.documentElement.dataset.theme=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}" }} /></head><body><ThemeProvider>{children}</ThemeProvider></body></html>;
}
