import { auth } from "@/auth";
import { uploadFeedbackImage } from "@/lib/cloudinary";
import { appendFeedback, type FeedbackCategory } from "@/lib/feedback";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BODY_LEN = 5000;
const ALLOWED_CATEGORIES: FeedbackCategory[] = ["要望", "不具合", "その他"];

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "invalid form data" }, { status: 400 });
  }

  const category = String(formData.get("category") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!ALLOWED_CATEGORIES.includes(category as FeedbackCategory)) {
    return Response.json({ error: "invalid category" }, { status: 400 });
  }
  if (!body || body.length > MAX_BODY_LEN) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const files = formData
    .getAll("images")
    .filter((v): v is File => v instanceof File && v.size > 0);

  if (files.length > MAX_IMAGES) {
    return Response.json(
      { error: `images exceed limit (${MAX_IMAGES})` },
      { status: 400 },
    );
  }
  for (const f of files) {
    if (f.size > MAX_IMAGE_BYTES) {
      return Response.json(
        { error: `image too large: ${f.name}` },
        { status: 400 },
      );
    }
    if (!f.type.startsWith("image/")) {
      return Response.json(
        { error: `not an image: ${f.name}` },
        { status: 400 },
      );
    }
  }

  try {
    const imageUrls: string[] = [];
    for (const f of files) {
      const buf = Buffer.from(await f.arrayBuffer());
      const url = await uploadFeedbackImage(buf, f.name || "screenshot");
      imageUrls.push(url);
    }

    await appendFeedback({
      email,
      category: category as FeedbackCategory,
      body,
      imageUrls,
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error("feedback submit failed", e);
    return Response.json(
      { error: "internal", detail: String(e) },
      { status: 500 },
    );
  }
}
