import { NextRequest } from "next/server";
import { listEntries } from "@/lib/timeclock";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const user = sp.get("user") ?? undefined;
  try {
    const entries = await listEntries({ from, to, user });
    return Response.json({ entries });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
