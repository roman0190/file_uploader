import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing URL parameter", { status: 400 });
  }

  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return new NextResponse(blob, {
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${url.split("/").pop()}"`,
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new NextResponse("Failed to fetch file", { status: 500 });
  }
}
