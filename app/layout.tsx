import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { auth, signOut } from "@/auth";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "農場ダッシュボード",
  description: "きゅうり農場 気象・出荷・生育データ管理",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? null;

  return (
    <html lang="ja" className={`${notoSansJP.variable} ${spaceGrotesk.variable} h-full`}>
      <body className="flex h-full antialiased" style={{ background: "var(--bg)", color: "var(--text)", fontFamily: "'Noto Sans JP', sans-serif", overflow: "hidden" }}>
        <AppShell userEmail={email} signOutAction={signOutAction}>{children}</AppShell>
      </body>
    </html>
  );
}
