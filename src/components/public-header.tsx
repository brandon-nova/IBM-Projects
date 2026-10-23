import Link from "next/link";
import { Brand } from "./shell";
import { Button } from "./ui/button";
export function PublicHeader() {
  return <header className="site-header public-header"><Brand /><div className="flex items-center gap-2"><Button asChild variant="ghost" size="sm"><Link href="/login">Sign in</Link></Button><Button asChild size="sm"><Link href="/login?mode=signup">Sign up</Link></Button></div></header>;
}
