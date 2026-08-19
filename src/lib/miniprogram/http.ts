import { NextResponse } from "next/server";

export function apiSuccess<T>(data: T, requestId: string, status = 200) {
  return NextResponse.json(
    { data, requestId },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    },
  );
}

export function apiError(
  code: string,
  message: string,
  requestId: string,
  status: number,
) {
  return NextResponse.json(
    { code, message, requestId },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    },
  );
}
