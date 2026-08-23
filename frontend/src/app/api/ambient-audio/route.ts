import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const ALLOWED = new Set([
  "rain", "nature", "office", "lofi", "ocean", "fire",
  "whitenoise", "deepspace", "heartbeat", "cinematic",
]);

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const url = new URL(req.url);
  const name = url.searchParams.get("name") || "";
  if (!ALLOWED.has(name)) return new NextResponse("Invalid name", { status: 400 });

  const filePath = path.resolve(process.cwd(), "..", "local-video-generator", "public", `${name}.mp3`);
  if (!fs.existsSync(filePath)) return new NextResponse("Not found", { status: 404 });

  const stat = fs.statSync(filePath);
  const range = req.headers.get("range");
  const fileSize = stat.size;

  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
      const chunk = fs.createReadStream(filePath, { start, end });
      return new NextResponse(chunk as any, {
        status: 206,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
        },
      });
    }
  }

  const stream = fs.createReadStream(filePath);
  return new NextResponse(stream as any, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
    },
  });
}
