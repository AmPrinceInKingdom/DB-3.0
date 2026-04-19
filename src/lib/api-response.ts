import { NextResponse } from "next/server";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  requestId?: string;
};

type ResponseOptions = {
  status?: number;
  requestId?: string;
  headers?: HeadersInit;
};

function resolveOptions(options: number | ResponseOptions | undefined, defaultStatus: number) {
  if (typeof options === "number") {
    return {
      status: options,
      requestId: undefined,
      headers: undefined,
    } satisfies ResponseOptions;
  }

  return {
    status: options?.status ?? defaultStatus,
    requestId: options?.requestId,
    headers: options?.headers,
  } satisfies ResponseOptions;
}

function buildHeaders(options: ResponseOptions) {
  const headers = new Headers(options.headers);
  if (options.requestId) {
    headers.set("x-request-id", options.requestId);
  }
  return headers;
}

export function attachRequestId(response: Response, requestId: string) {
  response.headers.set("x-request-id", requestId);
  return response;
}

export function ok<T>(data: T, statusOrOptions: number | ResponseOptions = 200) {
  const options = resolveOptions(statusOrOptions, 200);
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      data,
      requestId: options.requestId,
    },
    { status: options.status, headers: buildHeaders(options) },
  );
}

export function fail(
  message: string,
  statusOrOptions: number | ResponseOptions = 400,
  code?: string,
) {
  const options = resolveOptions(statusOrOptions, 400);
  return NextResponse.json<ApiResponse<never>>(
    {
      success: false,
      error: message,
      code,
      requestId: options.requestId,
    },
    { status: options.status, headers: buildHeaders(options) },
  );
}
