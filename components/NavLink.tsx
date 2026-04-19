"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`nav-item flex items-center gap-2.5 ${isActive ? "nav-item-active" : ""}`}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, fontSize: 13, color: "var(--text-muted)", fontWeight: 400, letterSpacing: "0.03em", marginBottom: 1, textDecoration: "none", transition: "all 0.15s", position: "relative" }}
    >
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", opacity: 0.5, flexShrink: 0 }} />
      {label}
    </Link>
  );
}
