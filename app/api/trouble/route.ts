import { getTroubleData } from "@/lib/googleSheets";

export const revalidate = 600;

export async function GET() {
  try {
    const data = await getTroubleData();
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
