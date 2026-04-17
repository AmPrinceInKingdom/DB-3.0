import { NextResponse } from "next/server";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>({ success: true, data }, { status });
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json<ApiResponse<never>>(
    {
      success: false,
      error: message,
      code,
    },
    { status },
  );
}
