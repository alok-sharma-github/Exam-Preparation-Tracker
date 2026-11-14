import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { logout } from "./actions";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CA Prep Tracker",
  description: "Track what you study for the CA exams and prove you understood it.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <Link href={user ? "/dashboard" : "/"} className="whitespace-nowrap font-semibold tracking-tight">
              CA Prep Tracker
            </Link>
            <div className="ml-auto flex items-center gap-3 text-sm sm:order-last">
              {user ? (
                <>
                  <span className="hidden text-muted sm:inline">{user.name}</span>
                  <form action={logout}>
                    <button className="text-muted hover:text-foreground">Log out</button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="text-muted hover:text-foreground">
                  Log in
                </Link>
              )}
            </div>
            {user?.profile && <NavLinks />}
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
