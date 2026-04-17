import "server-only";

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";

const segmentSanitizePattern = /[^a-zA-Z0-9_-]/g;

let cachedSupabaseStorageClient: SupabaseClient | null = null;

type UploadFileToSupabaseStorageInput = {
  bucket: string;
  folder: string;
  file: File;
  fileNamePrefix: string;
  allowedMimeTypes: Set<string>;
  extensionByMimeType: Record<string, string>;
  maxBytes: number;
  cacheControl?: string;
};

type UploadedSupabaseStorageFile = {
  bucket: string;
  objectPath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};

function sanitizeSegment(value: string, fallback: string) {
  const normalized = value.trim().replace(segmentSanitizePattern, "-").replace(/-+/g, "-");
  const trimmed = normalized.replace(/^-+|-+$/g, "");
  return trimmed.length > 0 ? trimmed : fallback;
}

function splitAndSanitizeFolder(folder: string) {
  const parts = folder
    .split("/")
    .map((segment) => sanitizeSegment(segment, "file"))
    .filter(Boolean);

  if (parts.length === 0) return "uploads";
  return parts.join("/");
}

function getSupabaseStorageClient() {
  if (cachedSupabaseStorageClient) return cachedSupabaseStorageClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new AppError(
      "Supabase URL is missing. Set NEXT_PUBLIC_SUPABASE_URL in your environment.",
      500,
      "SUPABASE_URL_MISSING",
    );
  }

  if (!serviceRoleKey) {
    throw new AppError(
      "Supabase service role key is missing. Set SUPABASE_SERVICE_ROLE_KEY in your environment.",
      500,
      "SUPABASE_SERVICE_KEY_MISSING",
    );
  }

  cachedSupabaseStorageClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedSupabaseStorageClient;
}

function validateUploadInput(input: UploadFileToSupabaseStorageInput) {
  const normalizedBucket = sanitizeSegment(input.bucket, "");
  if (!normalizedBucket) {
    throw new AppError("Storage bucket is not configured.", 500, "STORAGE_BUCKET_MISSING");
  }

  if (!(input.file instanceof File)) {
    throw new AppError("Please select a valid file.", 400, "INVALID_UPLOAD_FILE");
  }

  if (input.file.size <= 0) {
    throw new AppError("Uploaded file is empty.", 400, "EMPTY_UPLOAD_FILE");
  }

  if (input.file.size > input.maxBytes) {
    throw new AppError("Uploaded file exceeds allowed size.", 400, "UPLOAD_FILE_TOO_LARGE");
  }

  if (!input.allowedMimeTypes.has(input.file.type)) {
    throw new AppError("Uploaded file type is not allowed.", 400, "UPLOAD_FILE_TYPE_NOT_ALLOWED");
  }

  const extension = input.extensionByMimeType[input.file.type];
  if (!extension) {
    throw new AppError("Unable to resolve file extension for upload.", 400, "UPLOAD_EXTENSION_UNKNOWN");
  }
}

export async function uploadFileToSupabaseStorage(
  input: UploadFileToSupabaseStorageInput,
): Promise<UploadedSupabaseStorageFile> {
  validateUploadInput(input);

  const client = getSupabaseStorageClient();
  const bucket = sanitizeSegment(input.bucket, "");
  const folder = splitAndSanitizeFolder(input.folder);
  const prefix = sanitizeSegment(input.fileNamePrefix, "file");
  const extension = input.extensionByMimeType[input.file.type];

  const fileName = `${prefix}-${Date.now()}-${randomUUID()}.${extension}`;
  const objectPath = `${folder}/${fileName}`;
  const bytes = Buffer.from(await input.file.arrayBuffer());

  const { error } = await client.storage.from(bucket).upload(objectPath, bytes, {
    contentType: input.file.type,
    cacheControl: input.cacheControl ?? "31536000",
    upsert: false,
  });

  if (error) {
    throw new AppError(`Unable to upload file: ${error.message}`, 500, "STORAGE_UPLOAD_FAILED");
  }

  const { data } = client.storage.from(bucket).getPublicUrl(objectPath);
  const publicUrl = data.publicUrl?.trim();

  if (!publicUrl) {
    throw new AppError("Unable to resolve uploaded file URL.", 500, "STORAGE_PUBLIC_URL_FAILED");
  }

  return {
    bucket,
    objectPath,
    fileName,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
    url: publicUrl,
  };
}

export async function removeFileFromSupabaseStorage(input: { bucket: string; objectPath: string }) {
  try {
    const client = getSupabaseStorageClient();
    const bucket = sanitizeSegment(input.bucket, "");
    const objectPath = input.objectPath.trim().replace(/^\/+/, "");

    if (!bucket || !objectPath) return false;

    const { error } = await client.storage.from(bucket).remove([objectPath]);
    return !error;
  } catch {
    return false;
  }
}
