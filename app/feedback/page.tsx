import { FeedbackForm } from "@/components/FeedbackForm";

export const metadata = { title: "ご要望・ご意見 | 農場ダッシュボード" };

export default function FeedbackPage() {
  return (
    <main style={{ padding: "32px 28px", overflowY: "auto" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "0.01em", marginBottom: 6 }}>
          ご要望・ご意見
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
          機能のご要望・不具合のご報告はこちらから。スクリーンショットを添付できます。<br />
          送信内容はスプレッドシートに記録され、順次対応します。
        </p>
      </header>
      <FeedbackForm />
    </main>
  );
}
