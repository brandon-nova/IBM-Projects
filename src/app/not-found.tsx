import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() { return <main className="max-w-md mx-auto px-6 py-24 text-center stack"><h1>Page unavailable.</h1><p className="muted">This page may not exist, or you may not have access.</p><Button asChild variant="outline"><Link href="/projects">Browse projects</Link></Button></main>; }
