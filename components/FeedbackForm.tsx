"use client";

import { useRef, useState } from "react";

const CATEGORIES = ["要望", "不具合", "その他"] as const;
type Category = (typeof CATEGORIES)[number];

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

type Preview = { file: File; url: string };

export function FeedbackForm() {
  const [category, setCategory] = useState<Category>("要望");
  const [body, setBody] = useState("");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function addFiles(files: File[]) {
    setStatus({ kind: "idle" });
    const next = [...previews];
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > MAX_IMAGE_BYTES) {
        setStatus({ kind: "error", message: `画像が大きすぎます (${f.name}): 5MB まで` });
        continue;
      }
      if (next.length >= MAX_IMAGES) {
        setStatus({ kind: "error", message: `画像は ${MAX_IMAGES} 枚までです` });
        break;
      }
      next.push({ file: f, url: URL.createObjectURL(f) });
    }
    setPreviews(next);
  }

  function removePreview(idx: number) {
    setPreviews((cur) => {
      const target = cur[idx];
      if (target) URL.revokeObjectURL(target.url);
      return cur.filter((_, i) => i !== idx);
    });
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData.items);
    const files: File[] = [];
    for (const it of items) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f && f.type.startsWith("image/")) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim()) {
      setStatus({ kind: "error", message: "内容を入力してください" });
      return;
    }
    setStatus({ kind: "submitting" });
    const fd = new FormData();
    fd.set("category", category);
    fd.set("body", body.trim());
    for (const p of previews) fd.append("images", p.file, p.file.name);

    try {
      const res = await fetch("/api/feedback", { method: "POST", body: fd });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus({ kind: "error", message: data.error ?? `送信に失敗しました (${res.status})` });
        return;
      }
      setStatus({ kind: "success" });
      setBody("");
      previews.forEach((p) => URL.revokeObjectURL(p.url));
      setPreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setStatus({ kind: "error", message: String(err) });
    }
  }

  const submitting = status.kind === "submitting";

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <div style={fieldStyle}>
        <label style={labelStyle}>種別</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: `1px solid ${category === c ? "var(--green)" : "var(--border-subtle)"}`,
                background: category === c ? "var(--green-dim)" : "transparent",
                color: category === c ? "var(--green-bright)" : "var(--text-muted)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="fb-body">
          内容 <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>（テキスト欄に画像を貼り付けて添付できます）</span>
        </label>
        <textarea
          id="fb-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={handlePaste}
          maxLength={5000}
          rows={8}
          placeholder="どんな状況で / 何が起きたか / どうなると嬉しいか"
          style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>
          スクリーンショット <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>（任意 / 最大 {MAX_IMAGES} 枚 / 各 5MB まで）</span>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            addFiles(files);
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!dragOver) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) addFiles(files);
          }}
          disabled={previews.length >= MAX_IMAGES}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "24px 16px",
            border: `2px dashed ${dragOver ? "var(--green)" : "var(--border-subtle)"}`,
            borderRadius: 12,
            background: dragOver ? "var(--green-dim)" : "var(--bg2)",
            color: "var(--text-muted)",
            cursor: previews.length >= MAX_IMAGES ? "not-allowed" : "pointer",
            opacity: previews.length >= MAX_IMAGES ? 0.5 : 1,
            transition: "background 0.15s, border-color 0.15s",
            textAlign: "center",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
            画像を選択 / ドラッグ&ドロップ
          </div>
          <div style={{ fontSize: 11 }}>
            内容欄にクリップボードから貼り付けでも添付できます
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
            {previews.length} / {MAX_IMAGES} 枚
          </div>
        </button>

        {previews.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
            {previews.map((p, i) => (
              <div
                key={p.url}
                style={{
                  position: "relative",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "var(--bg2)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.file.name}
                  style={{ display: "block", width: 128, height: 128, objectFit: "cover" }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 0, right: 0, bottom: 0,
                    padding: "4px 8px",
                    background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
                    color: "white",
                    fontSize: 10,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={p.file.name}
                >
                  {p.file.name}
                </div>
                <button
                  type="button"
                  onClick={() => removePreview(i)}
                  aria-label={`${p.file.name} を削除`}
                  style={{
                    position: "absolute", top: 6, right: 6,
                    width: 24, height: 24, borderRadius: "50%",
                    background: "rgba(0,0,0,0.7)", color: "white",
                    border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "10px 20px",
            border: "none",
            borderRadius: 8,
            background: submitting ? "var(--green-dim)" : "var(--green)",
            color: "white",
            fontSize: 13,
            fontWeight: 500,
            cursor: submitting ? "default" : "pointer",
            letterSpacing: "0.04em",
          }}
        >
          {submitting ? "送信中..." : "送信"}
        </button>
        {status.kind === "success" && (
          <span style={{ color: "var(--green-bright)", fontSize: 12 }}>送信しました。ありがとうございます！</span>
        )}
        {status.kind === "error" && (
          <span style={{ color: "#f87171", fontSize: 12 }}>{status.message}</span>
        )}
      </div>
    </form>
  );
}

const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" };
const inputStyle: React.CSSProperties = {
  background: "var(--bg2)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
};
