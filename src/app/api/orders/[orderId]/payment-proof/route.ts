import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import { addBankTransferProof } from "@/lib/services/checkout-service";
import {
  removeFileFromSupabaseStorage,
  uploadFileToSupabaseStorage,
} from "@/lib/storage/supabase-storage";

export const runtime = "nodejs";

const maxFileSizeBytes = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const allowedExtensionsByMime: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};
const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const paymentProofBucket =
  process.env.SUPABASE_STORAGE_BUCKET_PAYMENTS?.trim() || "deal-bazaar-payment-proofs";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

function hasAllowedFileExtension(fileName: string, mimeType: string) {
  const allowedExtensions = allowedExtensionsByMime[mimeType];
  if (!allowedExtensions || allowedExtensions.length === 0) return false;

  const normalizedName = fileName.trim().toLowerCase();
  return allowedExtensions.some((extension) => normalizedName.endsWith(extension));
}

export async function POST(request: Request, context: RouteContext) {
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  let uploadedStorageFile: { bucket: string; objectPath: string } | null = null;

  try {
    const { orderId } = await context.params;
    const session = await getCurrentSession();
    const rateLimitError = enforceRateLimit(request, {
      scope: "checkout:payment-proof-upload",
      limit: 20,
      windowMs: 10 * 60 * 1000,
      keyPart: `${session?.sub ?? "guest"}:${orderId}`,
    });
    if (rateLimitError) return rateLimitError;

    const formData = await request.formData();
    const file = formData.get("proofFile");

    if (!(file instanceof File)) {
      return fail("Please upload a valid file", 400, "INVALID_PROOF_FILE");
    }

    if (!allowedMimeTypes.has(file.type)) {
      return fail("Only JPG, PNG, WEBP, or PDF files are allowed", 400, "INVALID_PROOF_TYPE");
    }

    if (!hasAllowedFileExtension(file.name, file.type)) {
      return fail("File extension does not match file type", 400, "INVALID_PROOF_EXTENSION");
    }

    if (file.size <= 0) {
      return fail("Uploaded file is empty", 400, "EMPTY_PROOF_FILE");
    }

    if (file.size > maxFileSizeBytes) {
      return fail("Payment proof must be smaller than 5MB", 400, "PROOF_FILE_TOO_LARGE");
    }

    const uploadedFile = await uploadFileToSupabaseStorage({
      bucket: paymentProofBucket,
      folder: `payments/proofs/${orderId}`,
      file,
      fileNamePrefix: "payment-proof",
      allowedMimeTypes,
      extensionByMimeType,
      maxBytes: maxFileSizeBytes,
    });
    uploadedStorageFile = {
      bucket: uploadedFile.bucket,
      objectPath: uploadedFile.objectPath,
    };

    const proof = await addBankTransferProof({
      orderId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      fileUrl: uploadedFile.url,
      session,
    });

    if (proof === null) {
      if (uploadedStorageFile) {
        await removeFileFromSupabaseStorage(uploadedStorageFile);
      }
      return fail("Order not found", 404, "ORDER_NOT_FOUND");
    }

    if (proof === "INVALID_PAYMENT_METHOD") {
      if (uploadedStorageFile) {
        await removeFileFromSupabaseStorage(uploadedStorageFile);
      }
      return fail("Payment proof is only allowed for bank transfer orders", 400, "INVALID_METHOD");
    }

    return ok(proof, 201);
  } catch (error) {
    if (uploadedStorageFile) {
      await removeFileFromSupabaseStorage(uploadedStorageFile);
    }
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to upload payment proof", 500, "PAYMENT_PROOF_UPLOAD_FAILED");
  }
}
