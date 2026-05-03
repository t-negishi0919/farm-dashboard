"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TIMECLOCK_USERS } from "@/lib/users";
import type { TimeclockEntry, TimeclockStatus, TimeclockAction } from "@/lib/timeclock";

type ApiStatus = { user: string; status: TimeclockStatus; entry: TimeclockEntry | null };

const LS_USER_KEY = "timeclock.user";
const MAX_BREAKS = 3;

const STATUS_LABEL: Record<TimeclockStatus, string> = {
  notStarted: "未出勤",
  working:    "勤務中",
  onBreak:    "休憩中",
  finished:   "退勤済み",
};

function jstDateString(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

type IconKind = "power" | "coffee" | "play" | "moon";
type Variant = "v-clockin" | "v-break" | "v-resume" | "v-clockout";

type ButtonSpec = {
  label: string;
  sub: string;
  variant: Variant;
  icon: IconKind;
  action: TimeclockAction | null;
  disabled: boolean;
};

/** メイン(出勤 / 退勤)ボタン: 出勤前は出勤、出勤後は退勤、退勤済は disabled */
function mainButtonSpec(status: TimeclockStatus): ButtonSpec {
  if (status === "notStarted") {
    return {
      label: "出勤", sub: "PRESS TO PUNCH IN",
      variant: "v-clockin", icon: "power",
      action: "punchIn", disabled: false,
    };
  }
  if (status === "finished") {
    return {
      label: "退勤済み", sub: "SHIFT COMPLETE",
      variant: "v-clockin", icon: "power",
      action: null, disabled: true,
    };
  }
  // working / onBreak: 退勤
  return {
    label: "退勤", sub: "PUNCH OUT",
    variant: "v-clockout", icon: "moon",
    action: "punchOut", disabled: false,
  };
}

/** 休憩トグルボタン: working→開始、onBreak→終了、それ以外は disabled */
function breakButtonSpec(status: TimeclockStatus, breaksUsed: number): ButtonSpec | null {
  if (status === "notStarted" || status === "finished") {
    return {
      label: "休憩", sub: "ON CLOCK ONLY",
      variant: "v-break", icon: "coffee",
      action: null, disabled: true,
    };
  }
  if (status === "onBreak") {
    return {
      label: "休憩終了", sub: "RESUME WORK",
      variant: "v-resume", icon: "play",
      action: "breakEnd", disabled: false,
    };
  }
  // working
  const noMore = breaksUsed >= MAX_BREAKS;
  return {
    label: noMore ? "休憩終了済" : "休憩開始",
    sub: noMore ? `MAX ${MAX_BREAKS} BREAKS` : "START BREAK",
    variant: "v-break", icon: "coffee",
    action: noMore ? null : "breakStart",
    disabled: noMore,
  };
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
    if (queryUser && (TIMECLOCK_USERS as readonly string[]).includes(queryUser)) return queryUser;
    return TIMECLOCK_USERS[0];
  });

  useEffect(() => {
    if (lockUser) return;
    const stored = window.localStorage.getItem(LS_USER_KEY);
    if (stored && (TIMECLOCK_USERS as readonly string[]).includes(stored) && stored !== user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [data, setData] = useState<ApiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<TimeclockAction | null>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; key: string }[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    if (!user || lockUser) return;
    if (typeof window !== "undefined") window.localStorage.setItem(LS_USER_KEY, user);
  }, [user, lockUser]);

  useEffect(() => {
    const initial = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(initial);
    let lastJstDate = jstDateString(initial);
    const t = setInterval(() => {
      const next = new Date();
      setNow(next);
      const jst = jstDateString(next);
      if (jst !== lastJstDate) {
        lastJstDate = jst;
        setDataVersion((v) => v + 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    const ac = new AbortController();
    fetch(`/api/timeclock?user=${encodeURIComponent(user)}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d: ApiStatus & { error?: string }) => {
        if (ac.signal.aborted) return;
        if (d.error) { setError(d.error); return; }
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
  }, [user, dataVersion]);

  const loading = !data || data.user !== user;
  const status: TimeclockStatus = loading ? "notStarted" : data.status;
  const entry = loading ? null : data.entry;
  const breaks = entry?.breaks ?? [];
  const breaksUsed = breaks.filter((b) => b.start).length;

  const main = mainButtonSpec(status);
  const brk = breakButtonSpec(status, breaksUsed);
  const isActive = status === "working" || status === "onBreak";

  const submit = async (action: TimeclockAction, btnKey: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (pending) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX || 0) - rect.left || rect.width / 2;
    const y = (event.clientY || 0) - rect.top || rect.height / 2;
    const id = Date.now();
    setRipples((r) => [...r, { id, x, y, key: btnKey }]);
    window.setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 800);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(20);
    }

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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      window.setTimeout(() => setError(null), 5000);
    } finally {
      setPending(null);
    }
  };

  const dateStr = useMemo(() => {
    if (!now) return "—";
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 (${days[now.getDay()]})`;
  }, [now]);

  const hh = now ? String(now.getHours()).padStart(2, "0") : "--";
  const mm = now ? String(now.getMinutes()).padStart(2, "0") : "--";

  // ログ: 出勤 / 休憩(N回 → N行)/ 退勤
  type LogItem = { key: string; icon: string; label: string; time: string | null };
  const logItems: LogItem[] = [
    { key: "in", icon: "🌅", label: "出勤", time: entry?.punchIn ?? null },
    ...breaks.map((b, i) => ({
      key: `break-${i}`,
      icon: i === 0 ? "☕" : i === 1 ? "🍵" : "🥤",
      label: `休憩${i + 1}`,
      time: b.start ? (b.end ? `${b.start}〜${b.end}` : `${b.start}〜 (進行中)`) : null,
    })),
    { key: "out", icon: "🌙", label: "退勤", time: entry?.punchOut ?? null },
  ];

  return (
    <div className="tc-root">
      <div className="tc-app">
        {!lockUser && (
          <div className="tc-userpicker" role="radiogroup" aria-label="ユーザー選択">
            {TIMECLOCK_USERS.map((u) => (
              <button
                key={u}
                role="radio"
                aria-checked={u === user}
                className={`tc-userpicker-btn${u === user ? " active" : ""}`}
                onClick={() => setUser(u)}
                disabled={pending !== null}
              >
                {u}
              </button>
            ))}
          </div>
        )}
        <div className="tc-name">{user} <span>さん</span></div>
        <div className="tc-date">{dateStr}</div>
        <div className="tc-clock">{hh}:{mm}</div>
        <div className={`tc-status-pill${isActive ? " active" : ""}`}>
          <div className="tc-status-dot" />
          {STATUS_LABEL[status]}
        </div>

        {error && <div className="tc-error">⚠️ {error}</div>}

        {/* メインボタン(出勤 or 退勤) */}
        <div className="tc-button-area">
          <div className={`tc-btn-frame ${main.variant}`}>
            <button
              className={`tc-btn ${main.variant}`}
              onClick={(e) => main.action && submit(main.action, "main", e)}
              disabled={main.disabled || pending !== null || loading}
              aria-label={main.label}
            >
              <ButtonIcon kind={main.icon} />
              <div className="tc-btn-label">{main.label}</div>
              <div className="tc-btn-sub">
                {pending === main.action ? "SENDING…" : main.sub}
              </div>
              {ripples.filter((r) => r.key === "main").map((r) => (
                <span
                  key={r.id}
                  className="tc-ripple"
                  style={{ left: r.x - 50, top: r.y - 50, width: 100, height: 100 }}
                />
              ))}
            </button>
          </div>
        </div>

        {/* 休憩トグルボタン(横長中サイズ) */}
        {brk && (
          <div className="tc-break-row">
            <button
              className={`tc-break-btn ${brk.variant}`}
              onClick={(e) => brk.action && submit(brk.action, "break", e)}
              disabled={brk.disabled || pending !== null || loading}
              aria-label={brk.label}
            >
              <ButtonIcon kind={brk.icon} small />
              <div className="tc-break-label">
                <div className="tc-break-main">
                  {pending === brk.action ? "送信中…" : brk.label}
                </div>
                <div className="tc-break-sub">{brk.sub}</div>
              </div>
              <div className="tc-break-meter">
                {Array.from({ length: MAX_BREAKS }).map((_, i) => {
                  const used = i < breaksUsed;
                  const active = status === "onBreak" && i === breaksUsed - 1;
                  return (
                    <span
                      key={i}
                      className={`tc-break-dot${used ? " used" : ""}${active ? " active" : ""}`}
                    />
                  );
                })}
              </div>
              {ripples.filter((r) => r.key === "break").map((r) => (
                <span
                  key={r.id}
                  className="tc-ripple"
                  style={{ left: r.x - 50, top: r.y - 50, width: 100, height: 100 }}
                />
              ))}
            </button>
          </div>
        )}

        <div className="tc-log-section">
          <div className="tc-log-header">
            <div>
              <div className="tc-log-title">本日の記録</div>
              <div className="tc-log-subtitle">休憩は最大 {MAX_BREAKS} 回まで</div>
            </div>
            <div className={`tc-log-badge ${status}`}>{STATUS_LABEL[status]}</div>
          </div>
          {logItems.map((x) => (
            <div key={x.key} className={`tc-log-row${x.time ? " done" : ""}`}>
              <div className="tc-log-icon">{x.icon}</div>
              <div className="tc-log-text">{x.label}</div>
              <div className="tc-log-time">{x.time ?? "未記録"}</div>
            </div>
          ))}
          {(entry?.workedHours != null || entry?.breakHours != null) && (
            <div className="tc-log-summary">
              <span>実働 <strong>{fmtH(entry.workedHours)}</strong></span>
              <span style={{ opacity: 0.4 }}>/</span>
              <span>休憩 <strong>{fmtH(entry.breakHours)}</strong></span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .tc-root {
          position: relative;
          height: 100vh;
          width: 100%;
          background:
            radial-gradient(ellipse at 50% 18%, rgba(43,96,40,0.22), transparent 42%),
            radial-gradient(ellipse at 50% 72%, rgba(43,96,40,0.10), transparent 44%),
            linear-gradient(180deg, #07100a 0%, #020604 100%);
          color: #e8f0ea;
          padding: 0;
          overflow-y: auto;
        }
        .tc-app {
          max-width: 480px;
          margin: 0 auto;
          padding: 20px 18px max(22px, env(safe-area-inset-bottom));
          min-height: 100%;
          display: flex; flex-direction: column;
          align-items: center;
        }
        @media (max-width: 480px) {
          .tc-app { padding: 10px 14px max(18px, env(safe-area-inset-bottom)); gap: 0; }
        }

        .tc-userpicker {
          display: inline-flex; gap: 6px; padding: 4px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          margin-bottom: 14px;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.4);
        }
        .tc-userpicker-btn {
          appearance: none; background: transparent; border: none;
          color: rgba(255,255,255,0.55);
          padding: 8px 18px; font-size: 14px; font-weight: 600;
          letter-spacing: 0.04em; border-radius: 999px;
          cursor: pointer; transition: all 0.18s ease;
          font-family: 'Noto Sans JP', sans-serif; min-width: 64px;
        }
        .tc-userpicker-btn:hover:not(.active):not(:disabled) {
          color: #e8f0ea; background: rgba(255,255,255,0.05);
        }
        .tc-userpicker-btn.active {
          background: linear-gradient(180deg, #3a9c2c 0%, #1f6e15 100%);
          color: #fff;
          box-shadow: 0 4px 0 #0a3805, 0 8px 14px rgba(0,180,80,0.28), inset 0 1px 0 rgba(255,255,255,0.3);
          transform: translateY(-1px);
        }
        .tc-userpicker-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .tc-name { font-size: 17px; font-weight: 700; letter-spacing: 0.02em; }
        .tc-name span { font-weight: 400; opacity: 0.7; font-size: 14px; margin-left: 4px; }
        .tc-date { font-size: 12px; opacity: 0.55; margin-top: 4px; }
        .tc-clock {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 42px; font-weight: 600;
          letter-spacing: -0.02em; margin-top: 4px;
          font-variant-numeric: tabular-nums;
        }
        @media (max-width: 480px) {
          .tc-clock { font-size: clamp(36px, 11vw, 42px); margin-top: 2px; }
        }

        .tc-status-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 999px;
          font-size: 12px; color: rgba(255,255,255,0.7);
          margin-top: 10px; transition: all 0.3s ease;
        }
        @media (max-width: 480px) { .tc-status-pill { margin-top: 8px; } }
        .tc-status-pill.active {
          background: rgba(53,129,40,0.15);
          border-color: rgba(94,194,80,0.4);
          color: #9be388;
        }
        .tc-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #888; transition: all 0.3s ease; }
        .tc-status-pill.active .tc-status-dot {
          background: #5fc24f; box-shadow: 0 0 8px #5fc24f;
          animation: tcLivePulse 1.6s ease-in-out infinite;
        }
        @keyframes tcLivePulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

        .tc-error {
          margin-top: 12px;
          background: rgba(220,38,38,0.12);
          border: 1px solid rgba(220,38,38,0.3);
          color: #fca5a5;
          padding: 8px 14px; border-radius: 12px;
          font-size: 12px; max-width: 360px; text-align: center;
        }

        .tc-button-area {
          display: flex; align-items: center; justify-content: center;
          width: 100%;
          padding: 16px 0 8px;
        }
        .tc-btn-frame {
          width: min(64vw, 240px); height: min(64vw, 240px);
          border-radius: 50%;
          background: radial-gradient(circle at 50% 40%, #1a201d 0%, #0a0d0b 70%, #050605 100%);
          box-shadow:
            inset 0 4px 8px rgba(0,0,0,0.8),
            inset 0 -2px 4px rgba(255,255,255,0.04),
            0 30px 60px rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          position: relative;
        }
        .tc-btn-frame::before {
          content: ''; position: absolute; inset: 12px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.04);
          background: conic-gradient(from 0deg,
            var(--glow-c, rgba(53,129,40,0)) 0deg,
            var(--glow-c2, rgba(53,129,40,0.15)) 90deg,
            var(--glow-c3, rgba(53,129,40,0.4)) 180deg,
            var(--glow-c2, rgba(53,129,40,0.15)) 270deg,
            var(--glow-c, rgba(53,129,40,0)) 360deg);
          filter: blur(6px);
          animation: tcRotateGlow 8s linear infinite;
          pointer-events: none;
        }
        @keyframes tcRotateGlow { to { transform: rotate(360deg); } }

        .tc-btn {
          width: calc(100% - 50px); height: calc(100% - 50px);
          border-radius: 50%; border: none; cursor: pointer;
          background: var(--btn-bg);
          position: relative;
          box-shadow:
            0 14px 0 var(--btn-shadow1),
            0 16px 0 var(--btn-shadow2),
            0 22px 28px rgba(0,0,0,0.7),
            inset 0 6px 12px rgba(255,255,255,0.4),
            inset 0 -10px 20px rgba(0,0,0,0.4);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 8px;
          transition: all 0.08s ease-out;
          color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.4);
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          overflow: hidden;
        }
        .tc-btn::before {
          content: ''; position: absolute; top: 12px; left: 30px;
          width: 78px; height: 28px;
          background: radial-gradient(ellipse, rgba(255,255,255,0.5), transparent 70%);
          border-radius: 50%; pointer-events: none;
        }
        .tc-btn::after {
          content: ''; position: absolute; inset: 9px;
          border-radius: 50%; border: 2px solid rgba(255,255,255,0.15);
          pointer-events: none;
        }
        .tc-btn:active:not(:disabled) {
          transform: translateY(12px);
          box-shadow:
            0 2px 0 var(--btn-shadow1),
            0 4px 0 var(--btn-shadow2),
            0 6px 8px rgba(0,0,0,0.6),
            inset 0 4px 8px rgba(0,0,0,0.3),
            inset 0 -2px 4px rgba(255,255,255,0.2);
        }
        .tc-btn:disabled { cursor: default; filter: saturate(0.6); opacity: 0.85; }
        .tc-btn-label {
          font-size: clamp(26px, 7vw, 30px); font-weight: 900;
          letter-spacing: 0.14em; line-height: 1;
        }
        .tc-btn-sub {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 10px; opacity: 0.85;
          letter-spacing: 0.28em; font-weight: 500;
        }

        .tc-break-row {
          width: 100%; max-width: 432px;
          margin-top: 14px;
          display: flex; justify-content: center;
        }
        .tc-break-btn {
          position: relative;
          width: 100%;
          background: var(--btn-bg);
          border: none; cursor: pointer;
          padding: 14px 18px;
          border-radius: 18px;
          color: #fff;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 14px;
          text-align: left;
          box-shadow:
            0 6px 0 var(--btn-shadow1),
            0 10px 18px rgba(0,0,0,0.45),
            inset 0 1px 0 rgba(255,255,255,0.25),
            inset 0 -4px 8px rgba(0,0,0,0.25);
          transition: all 0.08s ease-out;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .tc-break-btn:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow:
            0 2px 0 var(--btn-shadow1),
            0 4px 10px rgba(0,0,0,0.45),
            inset 0 2px 6px rgba(0,0,0,0.25);
        }
        .tc-break-btn:disabled { cursor: default; filter: saturate(0.5); opacity: 0.8; }
        .tc-break-label { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .tc-break-main {
          font-size: 16px; font-weight: 800; letter-spacing: 0.06em;
        }
        .tc-break-sub {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 10px; letter-spacing: 0.18em; opacity: 0.85;
        }
        .tc-break-meter { display: inline-flex; gap: 6px; }
        .tc-break-dot {
          width: 9px; height: 9px; border-radius: 50%;
          background: rgba(255,255,255,0.18);
          border: 1px solid rgba(255,255,255,0.25);
        }
        .tc-break-dot.used {
          background: rgba(255,255,255,0.85);
          border-color: rgba(255,255,255,0.95);
        }
        .tc-break-dot.active {
          background: #fff;
          box-shadow: 0 0 8px rgba(255,255,255,0.7);
          animation: tcLivePulse 1.6s ease-in-out infinite;
        }

        .v-clockin {
          --btn-bg: radial-gradient(circle at 35% 30%, #5fc24f 0%, #3a9c2c 35%, #1f6e15 75%, #0e4a07 100%);
          --btn-shadow1: #0a3805; --btn-shadow2: #051f02;
          --glow-c: rgba(53,129,40,0); --glow-c2: rgba(53,129,40,0.15); --glow-c3: rgba(53,129,40,0.5);
        }
        .v-break {
          --btn-bg: radial-gradient(circle at 35% 30%, #f0c455 0%, #d4a128 35%, #966e10 75%, #5e4407 100%);
          --btn-shadow1: #3a2a05; --btn-shadow2: #1f1602;
          --glow-c: rgba(208,160,40,0); --glow-c2: rgba(208,160,40,0.15); --glow-c3: rgba(208,160,40,0.5);
        }
        .v-resume {
          --btn-bg: radial-gradient(circle at 35% 30%, #6dc8d6 0%, #3a9caa 35%, #1f6e7a 75%, #0e4a52 100%);
          --btn-shadow1: #053838; --btn-shadow2: #021f1f;
          --glow-c: rgba(40,160,180,0); --glow-c2: rgba(40,160,180,0.15); --glow-c3: rgba(40,160,180,0.5);
        }
        .v-clockout {
          --btn-bg: radial-gradient(circle at 35% 30%, #d66d6d 0%, #aa3a3a 35%, #7a1f1f 75%, #520e0e 100%);
          --btn-shadow1: #380505; --btn-shadow2: #1f0202;
          --glow-c: rgba(180,40,40,0); --glow-c2: rgba(180,40,40,0.15); --glow-c3: rgba(180,40,40,0.5);
        }

        .tc-log-section {
          width: 100%; margin-top: 14px;
          max-width: 432px; padding: 12px;
          border: 1px solid rgba(255,255,255,0.075);
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.055), 0 16px 34px rgba(0,0,0,0.22);
        }
        .tc-log-header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-bottom: 10px;
        }
        .tc-log-title { font-size: 13px; font-weight: 700; letter-spacing: 0.06em; color: rgba(255,255,255,0.86); }
        .tc-log-subtitle { margin-top: 3px; font-size: 10px; color: rgba(255,255,255,0.38); letter-spacing: 0.04em; }
        .tc-log-badge {
          flex: 0 0 auto; border-radius: 999px;
          padding: 5px 9px; border: 1px solid rgba(255,255,255,0.09);
          background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.66);
          font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
        }
        .tc-log-badge.working,
        .tc-log-badge.onBreak {
          border-color: rgba(94,194,80,0.26);
          background: rgba(53,129,40,0.12);
          color: #9be388;
        }
        .tc-log-row {
          display: flex; align-items: center;
          min-height: 42px;
          padding: 8px 12px;
          border-radius: 12px;
          background: rgba(0,0,0,0.16);
          border: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 5px;
          font-size: 13px;
          transition: all 0.2s ease;
        }
        .tc-log-row:last-child { margin-bottom: 0; }
        .tc-log-row.done {
          background: rgba(53,129,40,0.08);
          border-color: rgba(94,194,80,0.2);
        }
        .tc-log-icon {
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; margin-right: 11px;
          width: 26px; height: 26px;
          border-radius: 9px;
          background: rgba(255,255,255,0.055);
        }
        .tc-log-text { flex: 1; font-weight: 500; }
        .tc-log-time {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 12px; opacity: 0.72;
          font-variant-numeric: tabular-nums;
        }
        .tc-log-row.done .tc-log-time { opacity: 1; color: #9be388; font-weight: 600; }

        .tc-log-summary {
          margin-top: 8px;
          display: flex; justify-content: center; gap: 10px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 12px; color: rgba(255,255,255,0.65);
          padding: 8px 12px;
          background: rgba(0,0,0,0.18);
          border-radius: 10px;
        }
        .tc-log-summary strong { color: #fff; font-weight: 700; margin-left: 2px; }

        .tc-ripple {
          position: absolute; border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.6), transparent 70%);
          pointer-events: none;
          animation: tcRippleOut 0.8s ease-out forwards;
        }
        @keyframes tcRippleOut {
          0%   { transform: scale(0); opacity: 0.7; }
          100% { transform: scale(3); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function fmtH(hours: number | null): string {
  if (hours == null || hours === 0) return "0:00";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function ButtonIcon({ kind, small }: { kind: IconKind; small?: boolean }) {
  const size = small ? 28 : 56;
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: 2.4 as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))", flexShrink: 0 } as React.CSSProperties,
  };
  switch (kind) {
    case "power":
      return (
        <svg {...common}>
          <path d="M12 2v10" />
          <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
        </svg>
      );
    case "coffee":
      return (
        <svg {...common}>
          <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
          <path d="M6 2v3M10 2v3M14 2v3" />
        </svg>
      );
    case "play":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
          style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))", flexShrink: 0 }}>
          <path d="M7 4l14 8-14 8V4z" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      );
  }
}
