import { Suspense } from "react";
import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "ログイン — 農場ダッシュボード",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  if (session?.user) {
    redirect(sp.callbackUrl || "/");
  }

  const err = sp.error;
  const errMsg =
    err === "AccessDenied"
      ? "このアカウントは農場ダッシュボードへのアクセスが許可されていません。"
      : err
        ? "ログインに失敗しました。もう一度お試しください。"
        : null;

  return (
    <div className="login-root">
      <Suspense fallback={null}>
        <div className="login-card">
          <div className="login-logo">🥒</div>
          <div className="login-title">農場ダッシュボード</div>
          <div className="login-sub">CUCUMBER ANALYTICS</div>
          <div className="login-desc">
            根岸農場の業務データをまとめた管理画面です。
            <br />許可された Google アカウントでログインしてください。
          </div>

          {errMsg && <div className="login-error">⚠️ {errMsg}</div>}

          <form
            action={async () => {
              "use server";
              await signIn("google", {
                redirectTo: sp.callbackUrl || "/",
              });
            }}
          >
            <button type="submit" className="login-btn">
              <GoogleG />
              <span>Google でログイン</span>
            </button>
          </form>

          <div className="login-hint">
            ログインできない場合は管理者にメールアドレスの登録を依頼してください。
          </div>
        </div>
      </Suspense>

      <style>{`
        .login-root {
          min-height: 100vh;
          width: 100%;
          background:
            radial-gradient(ellipse at 50% 18%, rgba(43,96,40,0.30), transparent 45%),
            radial-gradient(ellipse at 50% 78%, rgba(43,96,40,0.12), transparent 50%),
            linear-gradient(180deg, #07100a 0%, #020604 100%);
          color: #e8f0ea;
          font-family: 'Noto Sans JP', sans-serif;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
        }
        .login-card {
          width: 100%; max-width: 420px;
          padding: 40px 32px 32px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            #0e1612;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.05),
            0 30px 60px rgba(0,0,0,0.55);
          text-align: center;
        }
        .login-logo {
          width: 64px; height: 64px;
          margin: 0 auto 18px;
          border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          font-size: 32px;
          background: linear-gradient(135deg, oklch(0.68 0.18 148), oklch(0.4 0.1 148));
          box-shadow: 0 12px 30px rgba(72,199,116,0.30);
        }
        .login-title {
          font-size: 20px; font-weight: 700;
          letter-spacing: 0.01em;
        }
        .login-sub {
          margin-top: 4px;
          font-size: 10px; letter-spacing: 0.22em;
          color: oklch(0.76 0.22 148);
          font-family: 'Space Grotesk', sans-serif;
          text-transform: uppercase;
        }
        .login-desc {
          margin-top: 18px;
          font-size: 12px; line-height: 1.7;
          color: rgba(232,240,234,0.65);
        }
        .login-error {
          margin-top: 16px;
          padding: 10px 14px;
          background: rgba(220,38,38,0.12);
          border: 1px solid rgba(220,38,38,0.3);
          color: #fca5a5;
          border-radius: 12px;
          font-size: 12px;
          text-align: left;
        }
        .login-btn {
          margin-top: 22px;
          width: 100%;
          padding: 14px 18px;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 12px;
          background: rgba(255,255,255,0.95);
          color: #1f2937;
          font-size: 15px; font-weight: 600;
          cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          transition: transform 0.12s ease, box-shadow 0.2s ease;
          font-family: 'Noto Sans JP', sans-serif;
          box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        }
        .login-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(0,0,0,0.35); }
        .login-btn:active { transform: translateY(0); }
        .login-hint {
          margin-top: 18px;
          font-size: 11px; line-height: 1.6;
          color: rgba(232,240,234,0.4);
        }
      `}</style>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M17.64 9.2c0-.638-.057-1.252-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.708A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.708V4.96H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.04l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
