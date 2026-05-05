import { auth } from "@/auth";

/**
 * 全ページ・全 API を認証必須にする。
 *  - /login と /api/auth/* は除外(NextAuth 自身)
 *  - /favicon, /_next, 画像など静的アセットは matcher で除外
 *
 * 未ログインなら自動的に /login にリダイレクトされる(NextAuth の挙動)。
 */
export default auth((req) => {
  // ローカルテスト用のエスケープハッチ。本番では絶対に設定しない。
  if (process.env.SKIP_AUTH === "1") return;
  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: [
    // 認証ルートと静的アセットを除外したすべてのパス
    "/((?!api/auth|_next/static|_next/image|favicon.ico|favicon|robots.txt|sitemap.xml|login).*)",
  ],
};
