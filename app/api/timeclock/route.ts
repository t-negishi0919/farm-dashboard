import { NextRequest } from "next/server";
import { getTodayEntry, punch, statusFromEntry, type TimeclockAction } from "@/lib/timeclock";
import { isValidUser, TIMECLOCK_USERS } from "@/lib/users";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get("user") ?? "";
  if (!isValidUser(user)) {
    return Response.json(
      { error: "invalid user", users: TIMECLOCK_USERS },
      { status: 400 }
    );
  }
  try {
    const entry = await getTodayEntry(user);
    return Response.json({
      user,
      status: statusFromEntry(entry),
      entry,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { user?: string; action?: TimeclockAction };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const user = body.user ?? "";
  const action = body.action;
  if (!isValidUser(user)) {
    return Response.json({ error: "invalid user" }, { status: 400 });
  }
  if (!action || !["punchIn", "breakStart", "breakEnd", "punchOut"].includes(action)) {
    return Response.json({ error: "invalid action" }, { status: 400 });
  }

  try {
    const result = await punch(user, action);
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 409 });
  }
}
