import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error("CLOUDINARY_* env vars are not set");
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  configured = true;
}

export async function uploadFeedbackImage(
  buffer: Buffer,
  filenameHint: string,
): Promise<string> {
  ensureConfigured();
  const safeHint = filenameHint.replace(/[^\w.-]/g, "_").slice(0, 80);
  const publicId = `feedback/${Date.now()}_${safeHint}`;

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: "image", overwrite: false },
      (err, result) => {
        if (err || !result) {
          reject(err ?? new Error("Cloudinary upload returned empty result"));
          return;
        }
        resolve((result as UploadApiResponse).secure_url);
      },
    );
    stream.end(buffer);
  });
}
