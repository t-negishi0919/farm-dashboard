import { type NextRequest } from "next/server";
import { getCombinedData } from "@/lib/googleSheets";

export const revalidate = 600;

export async function GET(request: NextRequest) {
  try {
    const daysParam = request.nextUrl.searchParams.get("days");
    const days =
      daysParam && daysParam !== "all" ? parseInt(daysParam, 10) : undefined;
    const data = await getCombinedData(days);
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
