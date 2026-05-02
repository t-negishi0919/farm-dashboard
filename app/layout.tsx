import type { Metadata } from "next";
import { Noto_Sans_JP, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { NavLink } from "@/components/NavLink";

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

const navItems = [
  { href: "/",          label: "ダッシュボード" },
  { href: "/data",      label: "データ一覧" },
  { href: "/analysis",  label: "相関分析" },
  { href: "/growth",    label: "生育カレンダー" },
  { href: "/shipping",  label: "出荷記録" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${spaceGrotesk.variable} h-full`}>
      <body className="flex h-full antialiased" style={{ background: "var(--bg)", color: "var(--text)", fontFamily: "'Noto Sans JP', sans-serif", overflow: "hidden" }}>

        {/* Sidebar */}
        <aside
          className="flex flex-col shrink-0 relative overflow-hidden"
          style={{ width: 220, minWidth: 220, background: "var(--bg2)", borderRight: "1px solid var(--border-subtle)" }}
        >
          {/* top accent line */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, var(--green-dim), transparent)" }} />

          {/* Logo */}
          <div className="flex items-center gap-2.5" style={{ padding: "24px 20px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div
              className="flex items-center justify-center shrink-0 text-sm"
              style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, var(--green), var(--green-dim))" }}
            >
              🥒
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", letterSpacing: "0.01em", lineHeight: 1.3 }}>
                農場ダッシュボード
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 300, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Cucumber Analytics
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ padding: "16px 12px 8px", flex: 1 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", padding: "0 8px", marginBottom: 6, fontWeight: 500 }}>
              メニュー
            </div>
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>

          {/* Footer badge */}
          <div style={{ padding: 16, borderTop: "1px solid var(--border-subtle)" }}>
            <div
              className="flex items-center gap-2"
              style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "10px 12px" }}
            >
              <div
                className="flex items-center justify-center shrink-0 text-xs font-semibold"
                style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--green-dim)", color: "var(--green-bright)" }}
              >
                農
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>根岸農場</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>きゅうり栽培</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex flex-col flex-1 overflow-hidden" style={{ background: "var(--bg)" }}>
          {children}
        </div>

        <style>{`
          .nav-item:hover {
            background: var(--surface-hover) !important;
            color: var(--text) !important;
          }
          .nav-item-active {
            background: rgba(72,199,116,0.1) !important;
            color: var(--green-bright) !important;
            font-weight: 500 !important;
          }
          .nav-item-active::before {
            content: '';
            position: absolute;
            left: 0; top: 50%; transform: translateY(-50%);
            width: 3px; height: 60%;
            background: var(--green-bright);
            border-radius: 0 2px 2px 0;
          }
        `}</style>
      </body>
    </html>
  );
}
