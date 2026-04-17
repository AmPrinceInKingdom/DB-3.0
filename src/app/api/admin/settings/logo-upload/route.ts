import { revalidateTag } from "next/cache";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { PUBLIC_SETTINGS_CACHE_TAG } from "@/lib/services/public-settings-service";
import { uploadFileToSupabaseStorage } from "@/lib/storage/supabase-storage";

export const runtime = "nodejs";

const maxLogoFileSize = 3 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

const extensionByMimeType: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const allowedExtensionsByMimeType: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/svg+xml": [".svg"],
};
const brandingBucket =
  process.env.SUPABASE_STORAGE_BUCKET_BRANDING?.trim() || "deal-bazaar-branding";

function hasAllowedFileExtension(fileName: string, mimeType: string) {
  const allowedExtensions = allowedExtensionsByMimeType[mimeType];
  if (!allowedExtensions || allowedExtensions.length === 0) return false;

  const normalizedName = fileName.trim().toLowerCase();
  return allowedExtensions.some((extension) => normalizedName.endsWith(extension));
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("logoFile");

    if (!(file instanceof File)) {
      return fail("Please select a valid image file", 400, "INVALID_LOGO_FILE");
    }

    if (!allowedMimeTypes.has(file.type)) {
      return fail("Only PNG, JPG, WEBP, or SVG images are allowed", 400, "INVALID_LOGO_TYPE");
    }

    if (!hasAllowedFileExtension(file.name, file.type)) {
      return fail("File extension does not match logo file type", 400, "INVALID_LOGO_EXTENSION");
    }

    if (file.size > maxLogoFileSize) {
      return fail("Logo image must be smaller than 3MB", 400, "LOGO_FILE_TOO_LARGE");
    }

    const uploadedFile = await uploadFileToSupabaseStorage({
      bucket: brandingBucket,
      folder: "branding/logos",
      file,
      fileNamePrefix: "logo",
      allowedMimeTypes,
      extensionByMimeType,
      maxBytes: maxLogoFileSize,
    });

    await db.siteSetting.upsert({
      where: { settingKey: "logo_url" },
      update: {
        settingGroup: "general",
        settingValue: uploadedFile.url,
        isPublic: true,
        description: "Brand logo URL",
        updatedBy: auth.session.sub,
      },
      create: {
        settingGroup: "general",
        settingKey: "logo_url",
        settingValue: uploadedFile.url,
        isPublic: true,
        description: "Brand logo URL",
        updatedBy: auth.session.sub,
      },
    });

    revalidateTag(PUBLIC_SETTINGS_CACHE_TAG, "max");

    return ok(
      {
        url: uploadedFile.url,
        fileName: uploadedFile.fileName,
        sizeBytes: uploadedFile.sizeBytes,
        mimeType: uploadedFile.mimeType,
      },
      201,
    );
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to upload logo image", 500, "LOGO_UPLOAD_FAILED");
  }
}
