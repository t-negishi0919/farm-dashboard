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

type Palette = {
  /** ボタン本体グラデ(濃い→暗い) */
  faceTop: string;
  faceMid: string;
  faceBot: string;
  /** 沈んだ見た目で出る底面リム色(基本グラデの濃い色) */
  rim: string;
  /** 周囲の柔らかい光 */
  glow: string;
};

type ButtonSpec = {
  action: TimeclockAction;
  label: string;
  hint: string;
  icon: "power" | "coffee" | "play" | "check";
  palette: Palette;
};

const PALETTE_GREEN: Palette = {
  faceTop: "#35d86d", faceMid: "#08a943", faceBot: "#058833",
  rim: "#05712d",
  glow: "rgba(0,180,80,0.28)",
};
const PALETTE_AMBER: Palette = {
  faceTop: "#f7c66b", faceMid: "#dd9521", faceBot: "#b27410",
  rim: "#7d4f08",
  glow: "rgba(232,160,40,0.28)",
};
const PALETTE_BLUE: Palette = {
  faceTop: "#7ec5ef", faceMid: "#3a92cf", faceBot: "#1e6fa6",
  rim: "#114e76",
  glow: "rgba(70,150,220,0.28)",
};

const PALETTE_DUSK: Palette = {
  faceTop: "#7d8fd0", faceMid: "#4a5da3", faceBot: "#2d3a78",
  rim: "#1c2552",
  glow: "rgba(74,93,163,0.30)",
};

const BUTTON_PUNCH_IN: ButtonSpec = {
  action: "punchIn", label: "出勤", hint: "押して打刻",
  icon: "power", palette: PALETTE_GREEN,
};
const BUTTON_BREAK_START: ButtonSpec = {
  action: "breakStart", label: "休憩開始", hint: "押して打刻",
  icon: "coffee", palette: PALETTE_AMBER,
};
const BUTTON_BREAK_END: ButtonSpec = {
  action: "breakEnd", label: "休憩終了", hint: "押して打刻",
  icon: "play", palette: PALETTE_BLUE,
};
const BUTTON_PUNCH_OUT: ButtonSpec = {
  action: "punchOut", label: "退勤", hint: "押して打刻",
  icon: "check", palette: PALETTE_DUSK,
};

function buttonFor(status: TimeclockStatus, entry: TimeclockEntry | null): ButtonSpec | null {
  switch (status) {
    case "notStarted": return BUTTON_PUNCH_IN;
    case "onBreak":    return BUTTON_BREAK_END;
    case "working":
      // 休憩を既に取り終えていたら次は退勤
      return entry?.breakEnd ? BUTTON_PUNCH_OUT : BUTTON_BREAK_START;
    case "finished":   return null;
  }
}

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

  const [user, setUser] = useState<string>(() => {
    if (queryUser && (TIMECLOCK_USERS as readonly string[]).includes(queryUser)) {
      return queryUser;
    }
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(LS_USER_KEY);
      if (stored && (TIMECLOCK_USERS as readonly string[]).includes(stored)) {
        return stored;
      }
    }
    return TIMECLOCK_USERS[0];
  });
  const [data, setData] = useState<ApiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<TimeclockAction | null>(null);
  const [successAction, setSuccessAction] = useState<TimeclockAction | null>(null);
  const [now, setNow] = useState(new Date());

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

  // 状態取得(ユーザー切替時の stale response 対策に AbortController)
  useEffect(() => {
    if (!user) return;
    const ac = new AbortController();
    fetch(`/api/timeclock?user=${encodeURIComponent(user)}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d: ApiStatus & { error?: string }) => {
        if (ac.signal.aborted) return;
        if (d.error) {
          setError(d.error);
          return;
        }
        // 念のため: レスポンスのユーザーが現在のユーザーと一致するもののみ反映
        if (d.user === user) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError(String(e));
      });
    return () => ac.abort();
  }, [user]);

  // data が null、または現在のユーザーのものではない場合は読み込み中
  const loading = !data || data.user !== user;
  const status: TimeclockStatus = loading ? "notStarted" : data.status;
  const button = loading ? null : buttonFor(status, data.entry);
  // 既にボタンが退勤になっているとき、ゴーストの「退勤する」は重複なので非表示
  const showGhostPunchOut = !loading && (
    (status === "working" && !data.entry?.breakEnd) || status === "onBreak"
  );

  const submit = async (action: TimeclockAction) => {
    if (pending || successAction) return; // 連打防止
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
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(30);
      }
      setData({ user, status: json.status, entry: json.entry });
      setSuccessAction(action);
      window.setTimeout(() => setSuccessAction(null), 1200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      window.setTimeout(() => setError(null), 5000);
    } finally {
      setPending(null);
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

        {!loading && <StatusChip status={status} />}

        {loading ? (
          <LoadingCard />
        ) : button ? (
          <BigButton
            spec={button}
            disabled={pending !== null || successAction !== null}
            pending={pending === button.action}
            success={successAction === button.action}
            onTap={() => submit(button.action)}
          />
        ) : (
          <FinishedCard entry={data?.entry ?? null} />
        )}

        {showGhostPunchOut && (
          <button
            onClick={() => submit("punchOut")}
            disabled={pending !== null || successAction !== null}
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

function ButtonIcon({ kind, size = 56 }: { kind: ButtonSpec["icon"]; size?: number }) {
  const s = size;
  const stroke = "rgba(255,255,255,0.95)";
  switch (kind) {
    case "power":
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
          <path d="M22 15 A20 20 0 1 0 42 15" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
          <line x1="32" y1="8" x2="32" y2="32" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      );
    case "coffee":
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
          <path d="M14 24 H44 V42 A10 10 0 0 1 34 52 H24 A10 10 0 0 1 14 42 Z"
                stroke={stroke} strokeWidth="4" strokeLinejoin="round" />
          <path d="M44 28 H50 A6 6 0 0 1 50 40 H44" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
          <path d="M22 12 C22 16 26 16 26 20 M30 12 C30 16 34 16 34 20"
                stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      );
    case "play":
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
          <path d="M22 14 L48 32 L22 50 Z" fill={stroke} />
        </svg>
      );
    case "check":
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
          <path d="M14 33 L27 46 L50 19" stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

const SUCCESS_LABEL: Record<TimeclockAction, string> = {
  punchIn:    "出勤しました",
  breakStart: "休憩に入りました",
  breakEnd:   "休憩終了",
  punchOut:   "退勤しました",
};

function BigButton({ spec, disabled, pending, success, onTap }: {
  spec: ButtonSpec; disabled: boolean; pending: boolean; success: boolean; onTap: () => void;
}) {
  const p = spec.palette;
  return (
    <div
      style={{
        alignSelf: "stretch",
        padding: 10,
        borderRadius: 36,
        background: `
          radial-gradient(circle at 50% 20%, rgba(255,255,255,0.08), transparent 36%),
          linear-gradient(180deg, #07100b, #020604)
        `,
        boxShadow: `
          inset 0 8px 18px rgba(255,255,255,0.04),
          inset 0 -14px 28px rgba(0,0,0,0.7),
          0 24px 60px rgba(0,0,0,0.55)
        `,
      }}
    >
      <button
        onClick={onTap}
        disabled={disabled}
        className={`tc-big-btn ${success ? "tc-big-btn--success" : ""}`}
        style={{
          position: "relative",
          width: "100%",
          height: 260,
          border: 0,
          borderRadius: 30,
          color: "#fff",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled && !pending && !success ? 0.85 : 1,
          background: `
            linear-gradient(180deg, rgba(255,255,255,0.20), transparent 38%),
            linear-gradient(145deg, ${p.faceTop}, ${p.faceMid} 70%, ${p.faceBot})
          `,
          boxShadow: success
            ? `0 4px 0 ${p.rim}, 0 12px 24px ${p.glow}, inset 0 4px 16px rgba(0,0,0,0.24)`
            : `0 12px 0 ${p.rim}, 0 26px 46px ${p.glow}, inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -10px 20px rgba(0,0,0,0.22)`,
          transform: success ? "translateY(8px)" : "translateY(0)",
          filter: success ? "brightness(0.96)" : undefined,
          transition: "transform .12s ease, box-shadow .12s ease, filter .15s ease",
          overflow: "hidden",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 14,
        }}
        aria-live="polite"
      >
        <ButtonIcon kind={success ? "check" : spec.icon} />
        <div style={{
          fontSize: 36, fontWeight: 800, letterSpacing: "0.08em",
          textShadow: "0 2px 4px rgba(0,0,0,0.25)",
        }}>
          {success ? SUCCESS_LABEL[spec.action] : pending ? "送信中…" : spec.label}
        </div>
        <div style={{ fontSize: 12, letterSpacing: "0.18em", opacity: 0.85 }}>
          {success ? "記録しました" : spec.hint}
        </div>
        {pending && (
          <span className="tc-ripple" style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.5), transparent 60%)",
            opacity: 0,
          }} />
        )}
        {success && (
          <span style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            borderRadius: 30,
            background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.55), transparent 60%)",
            animation: "tc-flash 0.6s ease-out forwards",
          }} />
        )}
      </button>
      <style>{`
        .tc-big-btn:active:not(:disabled) {
          transform: translateY(8px);
          box-shadow:
            0 4px 0 ${p.rim},
            0 12px 24px ${p.glow},
            inset 0 4px 16px rgba(0,0,0,0.24) !important;
          filter: brightness(0.96);
        }
        .tc-big-btn:active::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 30px;
          background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.45), transparent 55%);
          animation: tc-flash 0.4s ease-out forwards;
          pointer-events: none;
        }
        @keyframes tc-flash {
          0% { opacity: 0; transform: scale(0.6); }
          40% { opacity: 1; }
          100% { opacity: 0; transform: scale(1.1); }
        }
        .tc-ripple {
          animation: tc-ripple-pulse 1.2s ease-out infinite;
        }
        @keyframes tc-ripple-pulse {
          0% { opacity: 0; transform: scale(0.7); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

function LoadingCard() {
  return (
    <div style={{
      alignSelf: "stretch",
      padding: 10,
      borderRadius: 36,
      background: `
        radial-gradient(circle at 50% 20%, rgba(255,255,255,0.06), transparent 36%),
        linear-gradient(180deg, #07100b, #020604)
      `,
      boxShadow: `
        inset 0 8px 18px rgba(255,255,255,0.04),
        inset 0 -14px 28px rgba(0,0,0,0.7),
        0 24px 60px rgba(0,0,0,0.55)
      `,
    }}>
      <div style={{
        width: "100%", height: 260, borderRadius: 30,
        background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "tc-loading 1.6s ease-in-out infinite",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.08)",
          borderTopColor: "rgba(255,255,255,0.4)",
          animation: "spin 0.9s linear infinite",
        }} />
      </div>
      <style>{`
        @keyframes tc-loading { 0%,100% { opacity: 0.6 } 50% { opacity: 1 } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}

function FinishedCard({ entry }: { entry: TimeclockEntry | null }) {
  const worked = entry?.workedHours ?? 0;
  const breakH = entry?.breakHours ?? 0;
  return (
    <div style={{
      alignSelf: "stretch",
      padding: 10,
      borderRadius: 36,
      background: `
        radial-gradient(circle at 50% 20%, rgba(255,255,255,0.06), transparent 36%),
        linear-gradient(180deg, #07100b, #020604)
      `,
      boxShadow: `
        inset 0 8px 18px rgba(255,255,255,0.04),
        inset 0 -14px 28px rgba(0,0,0,0.7),
        0 24px 60px rgba(0,0,0,0.55)
      `,
    }}>
      <div style={{
        position: "relative",
        width: "100%",
        height: 260,
        borderRadius: 30,
        background: `
          linear-gradient(180deg, rgba(255,255,255,0.10), transparent 38%),
          linear-gradient(145deg, #2a3a32, #1d2a24 70%, #15201b)
        `,
        boxShadow: `
          0 4px 0 #0c1612,
          inset 0 1px 0 rgba(255,255,255,0.12),
          inset 0 -10px 20px rgba(0,0,0,0.4)
        `,
        color: "rgba(232,240,234,0.9)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 12, textAlign: "center",
      }}>
        <ButtonIcon kind="check" size={56} />
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "0.08em" }}>退勤済み</div>
        <div style={{ fontSize: 12, letterSpacing: "0.18em", opacity: 0.7 }}>おつかれさまでした</div>
        <div style={{
          marginTop: 4, padding: "8px 16px",
          background: "rgba(0,0,0,0.25)", borderRadius: 999,
          fontFamily: "'Space Grotesk', sans-serif", fontSize: 13,
        }}>
          実働 <span style={{ color: "var(--green-bright)", fontWeight: 700 }}>{fmtHM(worked)}</span>
          <span style={{ opacity: 0.4, margin: "0 8px" }}>/</span>
          休憩 <span style={{ color: "oklch(0.86 0.16 68)", fontWeight: 700 }}>{fmtHM(breakH)}</span>
        </div>
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

