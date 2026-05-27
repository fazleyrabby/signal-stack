import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const publicVideosDir = path.resolve(process.cwd(), "public", "videos");

    // Check if out directory exists
    try {
      await fs.access(publicVideosDir);
    } catch {
      return NextResponse.json([]); // Return empty array if no videos yet
    }

    const files = await fs.readdir(publicVideosDir);
    const mp4Files = files.filter(f => f.endsWith(".mp4"));

    // Get stats to sort by newest first
    const videoStats = await Promise.all(
      mp4Files.map(async (file) => {
        const stats = await fs.stat(path.join(publicVideosDir, file));
        return {
          filename: file,
          url: `/videos/${file}`,
          createdAt: stats.mtimeMs,
          size: stats.size
        };
      })
    );

    // Sort newest first
    videoStats.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json(videoStats);
  } catch (error: any) {
    console.error("Failed to list videos:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const url = new URL(req.url);
    const filename = url.searchParams.get("filename");
    
    if (!filename || !filename.endsWith(".mp4") || filename.includes("/") || filename.includes("..")) {
      return new NextResponse("Invalid filename", { status: 400 });
    }
    
    const publicVideosDir = path.resolve(process.cwd(), "public", "videos");
    await fs.unlink(path.join(publicVideosDir, filename));
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return new NextResponse("File not found", { status: 404 });
    }
    console.error("Failed to delete video:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
