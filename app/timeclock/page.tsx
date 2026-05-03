"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TIMECLOCK_USERS } from "@/lib/users";
import type { TimeclockEntry, TimeclockStatus, TimeclockAction } from "@/lib/timeclock";

type ApiStatus = { user: string; status: TimeclockStatus; entry: TimeclockEntry | null };

const LS_USER_KEY = "timeclock.user";

/** 設計仕様 (案A) のフロー定義。サーバーの状態 + entry から導出する論理状態。 */
type FlowKey = "idle" | "working" | "onBreak" | "workingAfter" | "finished";

type FlowSpec = {
  label: string;
  sub: string;
  variant: "v-clockin" | "v-break" | "v-resume" | "v-clockout";
  icon: "power" | "coffee" | "play" | "moon";
  next: FlowKey | null;
  action: TimeclockAction | null;
};

const FLOW: Record<FlowKey, FlowSpec> = {
  idle:         { label: "出勤", sub: "PRESS TO PUNCH IN", variant: "v-clockin",  icon: "power",  next: "working",      action: "punchIn" },
  working:      { label: "休憩", sub: "START BREAK",       variant: "v-break",    icon: "coffee", next: "onBreak",      action: "breakStart" },
  onBreak:      { label: "再開", sub: "RESUME WORK",       variant: "v-resume",   icon: "play",   next: "workingAfter", action: "breakEnd" },
  workingAfter: { label: "退勤", sub: "PUNCH OUT",         variant: "v-clockout", icon: "moon",   next: "finished",     action: "punchOut" },
  finished:     { label: "完了", sub: "SHIFT COMPLETE",    variant: "v-clockin",  icon: "power",  next: null,           action: null },
};

const STATUS_LABEL: Record<FlowKey, string> = {
  idle: "未出勤",
  working: "勤務中",
  onBreak: "休憩中",
  workingAfter: "勤務中",
  finished: "退勤済み",
};

function jstDateString(d: Date): string {
  // JST = UTC+9. ロケールに依らず YYYY-MM-DD を返す。
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function flowKey(status: TimeclockStatus, entry: TimeclockEntry | null): FlowKey {
  if (status === "notStarted") return "idle";
  if (status === "onBreak") return "onBreak";
  if (status === "finished") return "finished";
  // working: 既に休憩終了済なら退勤フェーズへ
  return entry?.breakEnd ? "workingAfter" : "working";
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

  // SSR と CSR で初期値を揃えるため、初期値はクエリ or デフォルト固定。
  // localStorage の値はマウント後の useEffect で反映する(hydration mismatch 防止)。
  const [user, setUser] = useState<string>(() => {
    if (queryUser && (TIMECLOCK_USERS as readonly string[]).includes(queryUser)) {
      return queryUser;
    }
    return TIMECLOCK_USERS[0];
  });

  // マウント後に localStorage から復元
  useEffect(() => {
    if (lockUser) return;
    const stored = window.localStorage.getItem(LS_USER_KEY);
    if (stored && (TIMECLOCK_USERS as readonly string[]).includes(stored) && stored !== user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(stored);
    }
    // 初回マウントだけ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [data, setData] = useState<ApiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<TimeclockAction | null>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  // 時計は SSR と CSR で値が違う → 初期は null、マウント後に開始
  const [now, setNow] = useState<Date | null>(null);
  // 日付が変わったら再フェッチさせるためのバージョン
  const [dataVersion, setDataVersion] = useState(0);

  // 永続化
  useEffect(() => {
    if (!user || lockUser) return;
    if (typeof window !== "undefined") window.localStorage.setItem(LS_USER_KEY, user);
  }, [user, lockUser]);

  // 時計(クライアントマウント後に開始)+ JST 日付が変わったら自動で再フェッチ
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

  // 状態取得 (user 変更 / 日付変更で再実行)
  useEffect(() => {
    if (!user) return;
    const ac = new AbortController();
    fetch(`/api/timeclock?user=${encodeURIComponent(user)}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d: ApiStatus & { error?: string }) => {
        if (ac.signal.aborted) return;
        if (d.error) { setError(d.error); return; }
        if (d.user === user) {
          // 日付変更時は entry を null にリセットしておく(古い完了表示が残らないように)
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
  const fk: FlowKey = loading ? "idle" : flowKey(status, entry);
  const cfg = FLOW[fk];

  const isActive = fk !== "idle" && fk !== "finished";

  const submit = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!cfg.action || !cfg.next || pending) return;

    // ripple from click position
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX || 0) - rect.left || rect.width / 2;
    const y = (event.clientY || 0) - rect.top || rect.height / 2;
    const id = Date.now();
    setRipples((r) => [...r, { id, x, y }]);
    window.setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 800);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(20);
    }

    const action = cfg.action;
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

  const logItems = [
    { key: "in",         icon: "🌅", label: "出勤",     time: entry?.punchIn },
    { key: "breakStart", icon: "☕", label: "休憩開始", time: entry?.breakStart },
    { key: "breakEnd",   icon: "▶",  label: "休憩終了", time: entry?.breakEnd },
    { key: "out",        icon: "🌙", label: "退勤",     time: entry?.punchOut },
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
          {STATUS_LABEL[fk]}
        </div>

        {error && <div className="tc-error">⚠️ {error}</div>}

        <div className="tc-action-copy">
          <span>次の操作</span>
          <strong>{cfg.label}</strong>
        </div>

        <div className="tc-button-area">
          <div className={`tc-btn-frame ${cfg.variant}`}>
            <button
              className={`tc-btn ${cfg.variant}`}
              onClick={submit}
              disabled={!cfg.next || pending !== null || loading}
              aria-label={cfg.label}
            >
              <ButtonIcon kind={cfg.icon} />
              <div className="tc-btn-label">{cfg.label}</div>
              <div className="tc-btn-sub">{pending ? "SENDING…" : cfg.sub}</div>
              {ripples.map((r) => (
                <span
                  key={r.id}
                  className="tc-ripple"
                  style={{ left: r.x - 50, top: r.y - 50, width: 100, height: 100 }}
                />
              ))}
            </button>
          </div>
        </div>

        <div className="tc-log-section">
          <div className="tc-log-header">
            <div>
              <div className="tc-log-title">本日の記録</div>
              <div className="tc-log-subtitle">打刻後にここへ反映されます</div>
            </div>
            <div className={`tc-log-badge ${fk}`}>{STATUS_LABEL[fk]}</div>
          </div>
          {logItems.map((x) => (
            <div key={x.key} className={`tc-log-row${x.time ? " done" : ""}`}>
              <div className="tc-log-icon">{x.icon}</div>
              <div className="tc-log-text">{x.label}</div>
              <div className="tc-log-time">{x.time ?? "未記録"}</div>
            </div>
          ))}
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
        .tc-userpicker {
          display: inline-flex;
          gap: 6px;
          padding: 4px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          margin-bottom: 16px;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.4);
        }
        .tc-userpicker-btn {
          appearance: none;
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.55);
          padding: 8px 18px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.04em;
          border-radius: 999px;
          cursor: pointer;
          transition: all 0.18s ease;
          font-family: 'Noto Sans JP', sans-serif;
          min-width: 64px;
        }
        .tc-userpicker-btn:hover:not(.active):not(:disabled) {
          color: #e8f0ea;
          background: rgba(255,255,255,0.05);
        }
        .tc-userpicker-btn.active {
          background: linear-gradient(180deg, #3a9c2c 0%, #1f6e15 100%);
          color: #fff;
          box-shadow:
            0 4px 0 #0a3805,
            0 8px 14px rgba(0,180,80,0.28),
            inset 0 1px 0 rgba(255,255,255,0.3);
          transform: translateY(-1px);
        }
        .tc-userpicker-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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
        .tc-name {
          font-size: 17px; font-weight: 700;
          letter-spacing: 0.02em;
        }
        .tc-name span {
          font-weight: 400; opacity: 0.7;
          font-size: 14px; margin-left: 4px;
        }
        .tc-date {
          font-size: 12px; opacity: 0.55;
          margin-top: 4px;
        }
        .tc-clock {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 42px; font-weight: 650;
          letter-spacing: -0.02em;
          margin-top: 4px;
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
          font-size: 12px;
          color: rgba(255,255,255,0.7);
          margin-top: 10px;
          transition: all 0.3s ease;
        }
        @media (max-width: 480px) {
          .tc-status-pill { margin-top: 8px; }
        }
        .tc-status-pill.active {
          background: rgba(53,129,40,0.15);
          border-color: rgba(94,194,80,0.4);
          color: #9be388;
        }
        .tc-status-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #888;
          transition: all 0.3s ease;
        }
        .tc-status-pill.active .tc-status-dot {
          background: #5fc24f;
          box-shadow: 0 0 8px #5fc24f;
          animation: tcLivePulse 1.6s ease-in-out infinite;
        }
        @keyframes tcLivePulse {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.5; }
        }

        .tc-error {
          margin-top: 14px;
          background: rgba(220,38,38,0.12);
          border: 1px solid rgba(220,38,38,0.3);
          color: #fca5a5;
          padding: 8px 14px;
          border-radius: 12px;
          font-size: 12px;
          max-width: 360px;
          text-align: center;
        }

        .tc-action-copy {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 14px;
          padding: 7px 12px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          background: rgba(255,255,255,0.045);
          color: rgba(255,255,255,0.62);
          font-size: 11px;
          letter-spacing: 0.08em;
        }
        .tc-action-copy strong {
          color: #e8f0ea;
          font-size: 13px;
          letter-spacing: 0.1em;
        }

        .tc-button-area {
          display: flex; align-items: center; justify-content: center;
          width: 100%;
          padding: 18px 0 14px;
        }
        @media (max-width: 480px) {
          .tc-button-area { padding: 14px 0 10px; }
        }
        .tc-btn-frame {
          width: min(72vw, 280px); height: min(72vw, 280px);
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
          content: '';
          position: absolute;
          inset: 14px;
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
          transition: opacity 0.4s ease;
          pointer-events: none;
        }
        @keyframes tcRotateGlow { to { transform: rotate(360deg); } }

        @media (max-width: 480px) {
          .tc-btn-frame { width: min(70vw, 264px); height: min(70vw, 264px); }
        }
        .tc-btn {
          width: calc(100% - 58px); height: calc(100% - 58px);
          border-radius: 50%;
          border: none;
          cursor: pointer;
          background: var(--btn-bg);
          position: relative;
          box-shadow:
            0 16px 0 var(--btn-shadow1),
            0 18px 0 var(--btn-shadow2),
            0 24px 30px rgba(0,0,0,0.7),
            inset 0 6px 12px rgba(255,255,255,0.4),
            inset 0 -10px 20px rgba(0,0,0,0.4);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 9px;
          transition: all 0.08s ease-out;
          color: #fff;
          text-shadow: 0 2px 4px rgba(0,0,0,0.4);
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          overflow: hidden;
        }
        .tc-btn::before {
          content: '';
          position: absolute;
          top: 14px; left: 36px;
          width: 90px; height: 32px;
          background: radial-gradient(ellipse, rgba(255,255,255,0.5), transparent 70%);
          border-radius: 50%;
          pointer-events: none;
        }
        .tc-btn::after {
          content: '';
          position: absolute;
          inset: 10px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.15);
          pointer-events: none;
        }
        .tc-btn:active:not(:disabled),
        .tc-btn.pressed {
          transform: translateY(14px);
          box-shadow:
            0 2px 0 var(--btn-shadow1),
            0 4px 0 var(--btn-shadow2),
            0 6px 8px rgba(0,0,0,0.6),
            inset 0 4px 8px rgba(0,0,0,0.3),
            inset 0 -2px 4px rgba(255,255,255,0.2);
        }
        .tc-btn:disabled { cursor: default; }
        .tc-btn-label {
          font-size: clamp(29px, 8vw, 34px); font-weight: 900;
          letter-spacing: 0.15em;
          line-height: 1;
        }
        .tc-btn-sub {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 11px; opacity: 0.85;
          letter-spacing: 0.3em;
          font-weight: 500;
        }
        @media (max-width: 480px) {
          .tc-btn { width: calc(100% - 54px); height: calc(100% - 54px); }
          .tc-btn-label { letter-spacing: 0.12em; }
          .tc-btn-sub { font-size: 10px; letter-spacing: 0.24em; }
        }

        .v-clockin {
          --btn-bg: radial-gradient(circle at 35% 30%, #5fc24f 0%, #3a9c2c 35%, #1f6e15 75%, #0e4a07 100%);
          --btn-shadow1: #0a3805;
          --btn-shadow2: #051f02;
          --glow-c:  rgba(53,129,40,0);
          --glow-c2: rgba(53,129,40,0.15);
          --glow-c3: rgba(53,129,40,0.5);
        }
        .v-break {
          --btn-bg: radial-gradient(circle at 35% 30%, #f0c455 0%, #d4a128 35%, #966e10 75%, #5e4407 100%);
          --btn-shadow1: #3a2a05;
          --btn-shadow2: #1f1602;
          --glow-c:  rgba(208,160,40,0);
          --glow-c2: rgba(208,160,40,0.15);
          --glow-c3: rgba(208,160,40,0.5);
        }
        .v-resume {
          --btn-bg: radial-gradient(circle at 35% 30%, #6dc8d6 0%, #3a9caa 35%, #1f6e7a 75%, #0e4a52 100%);
          --btn-shadow1: #053838;
          --btn-shadow2: #021f1f;
          --glow-c:  rgba(40,160,180,0);
          --glow-c2: rgba(40,160,180,0.15);
          --glow-c3: rgba(40,160,180,0.5);
        }
        .v-clockout {
          --btn-bg: radial-gradient(circle at 35% 30%, #d66d6d 0%, #aa3a3a 35%, #7a1f1f 75%, #520e0e 100%);
          --btn-shadow1: #380505;
          --btn-shadow2: #1f0202;
          --glow-c:  rgba(180,40,40,0);
          --glow-c2: rgba(180,40,40,0.15);
          --glow-c3: rgba(180,40,40,0.5);
        }

        .tc-log-section {
          width: 100%;
          margin-top: 2px;
          max-width: 432px;
          padding: 12px;
          border: 1px solid rgba(255,255,255,0.075);
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.055),
            0 16px 34px rgba(0,0,0,0.22);
        }
        .tc-log-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }
        .tc-log-title {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: rgba(255,255,255,0.86);
        }
        .tc-log-subtitle {
          margin-top: 3px;
          font-size: 10px;
          color: rgba(255,255,255,0.38);
          letter-spacing: 0.04em;
        }
        .tc-log-badge {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 5px 9px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.66);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }
        .tc-log-badge.working,
        .tc-log-badge.workingAfter,
        .tc-log-badge.onBreak {
          border-color: rgba(94,194,80,0.26);
          background: rgba(53,129,40,0.12);
          color: #9be388;
        }
        .tc-log-row {
          display: flex; align-items: center;
          min-height: 46px;
          padding: 9px 12px;
          border-radius: 12px;
          background: rgba(0,0,0,0.16);
          border: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 6px;
          font-size: 13px;
          transition: all 0.2s ease;
        }
        .tc-log-row:last-child { margin-bottom: 0; }
        .tc-log-row.done {
          background: rgba(53,129,40,0.08);
          border-color: rgba(94,194,80,0.2);
        }
        .tc-log-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          margin-right: 11px;
          width: 28px;
          height: 28px;
          border-radius: 10px;
          background: rgba(255,255,255,0.055);
          text-align: center;
        }
        .tc-log-text { flex: 1; font-weight: 500; }
        .tc-log-time {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 12px;
          opacity: 0.72;
          font-variant-numeric: tabular-nums;
        }
        .tc-log-row.done .tc-log-time { opacity: 1; color: #9be388; font-weight: 600; }

        .tc-ripple {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.6), transparent 70%);
          pointer-events: none;
          animation: tcRippleOut 0.8s ease-out forwards;
        }
        @keyframes tcRippleOut {
          0%   { transform: scale(0);   opacity: 0.7; }
          100% { transform: scale(3);   opacity: 0;   }
        }
      `}</style>
    </div>
  );
}

function ButtonIcon({ kind }: { kind: FlowSpec["icon"] }) {
  const common = {
    width: 56, height: 56, viewBox: "0 0 24 24", fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: 2.4 as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "power":
      return (
        <svg {...common} style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))" }}>
          <path d="M12 2v10" />
          <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
        </svg>
      );
    case "coffee":
      return (
        <svg {...common} style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))" }}>
          <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
          <path d="M6 2v3M10 2v3M14 2v3" />
        </svg>
      );
    case "play":
      return (
        <svg width={56} height={56} viewBox="0 0 24 24" fill="currentColor"
          style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))" }}>
          <path d="M7 4l14 8-14 8V4z" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common} style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))" }}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      );
  }
}
