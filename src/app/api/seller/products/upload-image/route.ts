import { fail, ok } from "@/lib/api-response";
import { requireSellerSession } from "@/lib/auth/seller-guard";
import { AppError } from "@/lib/errors";
import {
  enforceRateLimit,
  enforceSameOriginMutation,
} from "@/lib/security/request-security";
import { uploadFileToSupabaseStorage } from "@/lib/storage/supabase-storage";

export const runtime = "nodejs";

const maxProductImageSizeBytes = 5 * 1024 * 1024;
const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const allowedExtensionsByMimeType: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};
const extensionByMimeType: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const productImagesBucket =
  process.env.SUPABASE_STORAGE_BUCKET_PRODUCTS?.trim() || "deal-bazaar-products";

function hasAllowedFileExtension(fileName: string, mimeType: string) {
  const allowedExtensions = allowedExtensionsByMimeType[mimeType];
  if (!allowedExtensions || allowedExtensions.length === 0) return false;

  const normalizedName = fileName.trim().toLowerCase();
  return allowedExtensions.some((extension) => normalizedName.endsWith(extension));
}

export async function POST(request: Request) {
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  const rateLimitError = enforceRateLimit(request, {
    scope: "seller:product-image-upload",
    limit: 30,
    windowMs: 10 * 60 * 1000,
    keyPart: auth.session.sub,
  });
  if (rateLimitError) return rateLimitError;

  try {
    const formData = await request.formData();
    const file = formData.get("imageFile");

    if (!(file instanceof File)) {
      return fail("Please select a valid image file", 400, "INVALID_PRODUCT_IMAGE_FILE");
    }

    if (!allowedImageMimeTypes.has(file.type)) {
      return fail("Only PNG, JPG, or WEBP files are allowed", 400, "INVALID_PRODUCT_IMAGE_TYPE");
    }

    if (!hasAllowedFileExtension(file.name, file.type)) {
      return fail("File extension does not match image type", 400, "INVALID_PRODUCT_IMAGE_EXTENSION");
    }

    if (file.size <= 0) {
      return fail("Uploaded image is empty", 400, "EMPTY_PRODUCT_IMAGE");
    }

    if (file.size > maxProductImageSizeBytes) {
      return fail("Image must be smaller than 5MB", 400, "PRODUCT_IMAGE_TOO_LARGE");
    }

    const uploadedFile = await uploadFileToSupabaseStorage({
      bucket: productImagesBucket,
      folder: `products/seller/${auth.session.sub}`,
      file,
      fileNamePrefix: "seller-product",
      allowedMimeTypes: allowedImageMimeTypes,
      extensionByMimeType,
      maxBytes: maxProductImageSizeBytes,
    });

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
    return fail("Unable to upload product image", 500, "PRODUCT_IMAGE_UPLOAD_FAILED");
  }
}
