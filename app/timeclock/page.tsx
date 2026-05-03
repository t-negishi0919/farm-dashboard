"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TIMECLOCK_USERS } from "@/lib/users";
import type { TimeclockEntry, TimeclockStatus, TimeclockAction } from "@/lib/timeclock";

type ApiStatus = { user: string; status: TimeclockStatus; entry: TimeclockEntry | null };

const LS_USER_KEY = "timeclock.user";

const STATUS_LABEL: Record<TimeclockStatus, string> = {
  notStarted: "未出勤",
  working:    "勤務中",
  onBreak:    "休憩中",
  finished:   "退勤済",
};

type ButtonSpec = {
  action: TimeclockAction;
  label: string;
  icon: string;
  hint: string;
  bg: string;
  glow: string;
};

const BUTTON_BY_STATUS: Record<TimeclockStatus, ButtonSpec | null> = {
  notStarted: {
    action: "punchIn", label: "出 勤", icon: "🌅",
    hint: "タップで打刻",
    bg: "linear-gradient(140deg, oklch(0.68 0.18 148), oklch(0.55 0.16 148))",
    glow: "rgba(72,199,116,0.35)",
  },
  working: {
    action: "breakStart", label: "休憩開始", icon: "☕",
    hint: "勤務中",
    bg: "linear-gradient(140deg, oklch(0.74 0.16 68), oklch(0.62 0.14 68))",
    glow: "rgba(244,177,84,0.35)",
  },
  onBreak: {
    action: "breakEnd", label: "休憩終了", icon: "▶︎",
    hint: "休憩中",
    bg: "linear-gradient(140deg, oklch(0.72 0.12 215), oklch(0.58 0.12 215))",
    glow: "rgba(110,177,222,0.35)",
  },
  finished: null,
};

export default function TimeclockPageWrapper() {
  return (
    <Suspense fallback={null}>
      <TimeclockPage />
    </Suspense>
  );
}

function TimeclockPage() {
  const sp = useSearchParams();
  const queryUser = sp.get("u");
  const lockUser = !!queryUser;

  const [user, setUser] = useState<string>("");
  const [data, setData] = useState<ApiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<TimeclockAction | null>(null);
  const [confirm, setConfirm] = useState<TimeclockAction | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  // 初期ユーザー確定
  useEffect(() => {
    if (queryUser && (TIMECLOCK_USERS as readonly string[]).includes(queryUser)) {
      setUser(queryUser);
      return;
    }
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(LS_USER_KEY) : null;
    if (stored && (TIMECLOCK_USERS as readonly string[]).includes(stored)) {
      setUser(stored);
    } else {
      setUser(TIMECLOCK_USERS[0]);
    }
  }, [queryUser]);

  // ユーザー保存
  useEffect(() => {
    if (!user || lockUser) return;
    if (typeof window !== "undefined") window.localStorage.setItem(LS_USER_KEY, user);
  }, [user, lockUser]);

  // 時計
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // 状態取得
  useEffect(() => {
    if (!user) return;
    setError(null);
    fetch(`/api/timeclock?user=${encodeURIComponent(user)}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); })
      .catch((e) => setError(String(e)));
  }, [user]);

  const status: TimeclockStatus = data?.status ?? "notStarted";
  const button = BUTTON_BY_STATUS[status];

  const submit = async (action: TimeclockAction) => {
    setPending(action);
    setError(null);
    try {
      const res = await fetch("/api/timeclock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "打刻に失敗しました");
      setData({ user, status: json.status, entry: json.entry });
      setToast(toastMessage(action, json.entry));
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(20);
      }
      setTimeout(() => setToast(null), 4000);
    } catch (e) {
      setError(String(e));
    } finally {
      setPending(null);
      setConfirm(null);
    }
  };

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 10) return "おはようございます";
    if (h < 17) return "こんにちは";
    return "おつかれさまです";
  }, [now]);

  const dateLabel = useMemo(() => {
    const d = new Date(now.getTime());
    const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${wd})`;
  }, [now]);

  const timeLabel = useMemo(() => {
    const d = now;
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }, [now]);

  return (
    <div className="flex flex-col" data-page-shell style={{ height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      {/* Topbar */}
      <div className="flex items-center justify-between shrink-0" data-page-topbar
        style={{ height: 60, padding: "0 28px", background: "var(--bg2)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div data-page-title style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>
          勤怠
        </div>
        {!lockUser && (
          <select
            value={user}
            onChange={(e) => setUser(e.target.value)}
            style={{
              background: "var(--surface-hover)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text)",
              borderRadius: 8,
              padding: "5px 12px",
              fontSize: 13,
              cursor: "pointer", outline: "none",
            }}
          >
            {TIMECLOCK_USERS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        )}
      </div>

      <div data-page-content style={{ flex: 1, overflowY: "auto", padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, maxWidth: 520, width: "100%", margin: "0 auto" }}>
        {error && (
          <div style={{ alignSelf: "stretch", background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#fca5a5" }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ alignSelf: "stretch", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{greeting}</div>
          <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, letterSpacing: "-0.02em" }}>{user || "—"} さん</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, fontFamily: "'Space Grotesk', sans-serif" }}>{dateLabel}</div>
          <div style={{ fontSize: 36, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.04em", marginTop: 2, color: "var(--text)" }}>
            {timeLabel}
          </div>
        </div>

        <StatusChip status={status} />

        {button ? (
          <BigButton
            spec={button}
            disabled={pending !== null}
            pending={pending === button.action}
            onTap={() => setConfirm(button.action)}
          />
        ) : (
          <FinishedCard entry={data?.entry ?? null} />
        )}

        {(status === "working" || status === "onBreak") && (
          <button
            onClick={() => setConfirm("punchOut")}
            disabled={pending !== null}
            style={{
              alignSelf: "stretch",
              background: "transparent",
              border: "1px solid var(--border-strong)",
              color: "var(--text-muted)",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 14, fontWeight: 500,
              cursor: pending ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")}
          >
            退勤する
          </button>
        )}

        <LogList entry={data?.entry ?? null} />
      </div>

      {confirm && (
        <ConfirmSheet
          action={confirm}
          time={`${pad(now.getHours())}:${pad(now.getMinutes())}`}
          pending={pending !== null}
          onConfirm={() => submit(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "rgba(14,22,18,0.96)", border: "1px solid var(--border-strong)",
          color: "var(--text)", padding: "10px 18px", borderRadius: 12,
          fontSize: 13, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          maxWidth: "90vw",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function StatusChip({ status }: { status: TimeclockStatus }) {
  const colors: Record<TimeclockStatus, { dot: string; bg: string; text: string }> = {
    notStarted: { dot: "var(--text-dim)",   bg: "var(--surface-hover)",          text: "var(--text-muted)" },
    working:    { dot: "var(--green-bright)", bg: "rgba(72,199,116,0.10)",        text: "var(--green-bright)" },
    onBreak:    { dot: "oklch(0.74 0.16 68)", bg: "rgba(244,177,84,0.10)",       text: "oklch(0.86 0.16 68)" },
    finished:   { dot: "rgba(110,177,222,0.8)", bg: "rgba(110,177,222,0.10)",    text: "oklch(0.85 0.10 215)" },
  };
  const c = colors[status];
  return (
    <div className="flex items-center" style={{ gap: 8, background: c.bg, padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 500, color: c.text, letterSpacing: "0.04em" }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%", background: c.dot,
        animation: status === "working" || status === "onBreak" ? "pulseDot 2s ease-in-out infinite" : undefined,
      }} />
      {STATUS_LABEL[status]}
      <style>{`@keyframes pulseDot { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </div>
  );
}

function BigButton({ spec, disabled, pending, onTap }: {
  spec: ButtonSpec; disabled: boolean; pending: boolean; onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      disabled={disabled}
      style={{
        position: "relative",
        alignSelf: "stretch",
        width: "100%",
        height: 220,
        background: spec.bg,
        border: "none",
        borderRadius: 28,
        color: "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: `0 12px 36px ${spec.glow}, inset 0 1px 0 rgba(255,255,255,0.18)`,
        opacity: disabled && !pending ? 0.7 : 1,
        transition: "transform 0.12s ease, box-shadow 0.2s ease, opacity 0.15s",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 10,
        overflow: "hidden",
      }}
      onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)"; }}
      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
      onTouchStart={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)"; }}
      onTouchEnd={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
    >
      <div style={{ fontSize: 56, lineHeight: 1 }}>{spec.icon}</div>
      <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "0.06em", textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
        {pending ? "送信中…" : spec.label}
      </div>
      <div style={{ fontSize: 12, opacity: 0.85, letterSpacing: "0.08em" }}>{spec.hint}</div>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 60%)", pointerEvents: "none" }} />
    </button>
  );
}

function FinishedCard({ entry }: { entry: TimeclockEntry | null }) {
  const worked = entry?.workedHours ?? 0;
  const breakH = entry?.breakHours ?? 0;
  return (
    <div style={{
      alignSelf: "stretch",
      background: "linear-gradient(140deg, rgba(110,177,222,0.12), rgba(110,177,222,0.04))",
      border: "1px solid rgba(110,177,222,0.25)",
      borderRadius: 28, padding: "32px 24px", textAlign: "center",
    }}>
      <div style={{ fontSize: 48 }}>🌙</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 8 }}>本日終了</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>おつかれさまでした</div>
      <div style={{ fontSize: 14, marginTop: 16, fontFamily: "'Space Grotesk', sans-serif" }}>
        実働 <span style={{ color: "var(--green-bright)", fontWeight: 600 }}>{fmtHM(worked)}</span>
        <span style={{ color: "var(--text-dim)", margin: "0 8px" }}>/</span>
        休憩 <span style={{ color: "oklch(0.86 0.16 68)", fontWeight: 600 }}>{fmtHM(breakH)}</span>
      </div>
    </div>
  );
}

function LogList({ entry }: { entry: TimeclockEntry | null }) {
  const items = [
    { icon: "🌅", label: "出勤",   value: entry?.punchIn },
    { icon: "☕", label: "休憩開始", value: entry?.breakStart },
    { icon: "▶︎", label: "休憩終了", value: entry?.breakEnd },
    { icon: "🌙", label: "退勤",   value: entry?.punchOut },
  ];
  return (
    <div style={{ alignSelf: "stretch", marginTop: 6 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 10 }}>
        本日のログ
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between"
            style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 14px" }}>
            <div className="flex items-center" style={{ gap: 10 }}>
              <span style={{ fontSize: 16 }}>{it.icon}</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{it.label}</span>
            </div>
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600,
              color: it.value ? "var(--text)" : "var(--text-dim)", letterSpacing: "-0.02em",
            }}>
              {it.value ?? "—"}
            </span>
          </div>
        ))}
        {entry && (
          <div className="flex items-center justify-between"
            style={{ marginTop: 4, padding: "10px 14px", fontSize: 12, color: "var(--text-muted)" }}>
            <span>実働 {fmtHM(entry.workedHours ?? 0)}</span>
            <span>休憩 {fmtHM(entry.breakHours ?? 0)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function fmtHM(hours: number): string {
  if (!hours) return "0:00";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${pad(m)}`;
}

const ACTION_LABEL: Record<TimeclockAction, string> = {
  punchIn:    "出勤",
  breakStart: "休憩開始",
  breakEnd:   "休憩終了",
  punchOut:   "退勤",
};

function ConfirmSheet({ action, time, pending, onConfirm, onCancel }: {
  action: TimeclockAction; time: string; pending: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
        zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg2)", border: "1px solid var(--border-strong)",
          borderRadius: "20px 20px 0 0", padding: "24px 24px 32px",
          width: "100%", maxWidth: 520,
          animation: "slideUp 0.18s ease-out",
        }}
      >
        <style>{`@keyframes slideUp { from { transform: translateY(20%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        <div style={{ width: 40, height: 4, background: "var(--border-strong)", borderRadius: 2, margin: "0 auto 16px" }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>{ACTION_LABEL[action]}します</div>
          <div style={{ fontSize: 48, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.04em", margin: "8px 0" }}>
            {time}
          </div>
        </div>
        <button
          onClick={onConfirm}
          disabled={pending}
          style={{
            width: "100%", marginTop: 8,
            background: "var(--green)", color: "#fff",
            border: "none", borderRadius: 14, padding: "14px",
            fontSize: 15, fontWeight: 600, cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "送信中…" : `この時刻で${ACTION_LABEL[action]}`}
        </button>
        <button
          onClick={onCancel}
          disabled={pending}
          style={{
            width: "100%", marginTop: 8,
            background: "transparent", color: "var(--text-muted)",
            border: "none", padding: "10px",
            fontSize: 13, cursor: "pointer",
          }}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

function toastMessage(action: TimeclockAction, entry: TimeclockEntry): string {
  switch (action) {
    case "punchIn":    return `${entry.punchIn} 出勤しました`;
    case "breakStart": return `${entry.breakStart} 休憩に入りました`;
    case "breakEnd":   return `${entry.breakEnd} 仕事に戻ります`;
    case "punchOut":
      return entry.workedHours
        ? `おつかれさま! 今日は ${fmtHM(entry.workedHours)} はたらきました 🌙`
        : "おつかれさまでした 🌙";
  }
}
