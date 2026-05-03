"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/NavLink";

const navItems = [
  { href: "/",                label: "ダッシュボード" },
  { href: "/data",            label: "気象データ一覧" },
  { href: "/analysis",        label: "収量と天気" },
  { href: "/growth",          label: "生育カレンダー" },
  { href: "/shipping",        label: "出荷記録" },
  { href: "/timeclock",       label: "勤怠" },
  { href: "/timeclock/list",  label: "勤怠一覧" },
];

export function AppShell({
  children,
  userEmail,
  signOutAction,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
  signOutAction?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // ルート遷移時にドロワーを閉じる
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        aria-label="メニュー"
        onClick={() => setOpen((v) => !v)}
        className="app-shell-hamburger"
        style={{
          position: "fixed", top: 14, left: 14, zIndex: 50,
          width: 36, height: 36, borderRadius: 8,
          background: "var(--bg2)", border: "1px solid var(--border-subtle)",
          color: "var(--text)", cursor: "pointer",
          display: "none", alignItems: "center", justifyContent: "center",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {open ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="app-shell-backdrop"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 30 }}
        />
      )}

      {/* Sidebar */}
      <aside
        className="app-shell-sidebar flex flex-col shrink-0 relative overflow-hidden"
        data-open={open ? "true" : "false"}
        style={{ width: 220, minWidth: 220, background: "var(--bg2)", borderRight: "1px solid var(--border-subtle)" }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, var(--green-dim), transparent)" }} />

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

        <nav style={{ padding: "16px 12px 8px", flex: 1 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", padding: "0 8px", marginBottom: 6, fontWeight: 500 }}>
            メニュー
          </div>
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

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
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>根岸農場</div>
              <div
                style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={userEmail ?? undefined}
              >
                {userEmail ?? "きゅうり栽培"}
              </div>
            </div>
          </div>
          {signOutAction && (
            <form action={signOutAction}>
              <button
                type="submit"
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "7px 10px",
                  fontSize: 11,
                  border: "1px solid var(--border-subtle)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  borderRadius: 8,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-subtle)";
                }}
              >
                ログアウト
              </button>
            </form>
          )}
        </div>
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden app-shell-main" style={{ background: "var(--bg)", minWidth: 0 }}>
        {children}
      </div>
    </>
  );
}
