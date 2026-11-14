"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/log", label: "Log study" },
  { href: "/syllabus", label: "Syllabus" },
  { href: "/sessions", label: "History" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex w-full gap-1 overflow-x-auto text-sm sm:mx-0 sm:w-auto">
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 ${active ? "bg-accent/10 font-medium text-accent" : "text-muted hover:text-foreground"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
