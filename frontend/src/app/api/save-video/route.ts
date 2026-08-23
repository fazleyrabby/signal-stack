import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import os from "os";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const { filename, targetDir } = await (req.json() as Promise<{
      filename: string;
      targetDir: string;
    }>);

    if (!filename || !targetDir) {
      return new NextResponse("Filename and target directory are required", { status: 400 });
    }

    // Resolve paths containing tilde (~) to home directory
    let resolvedDir = targetDir.trim();
    if (resolvedDir.startsWith("~")) {
      resolvedDir = path.join(os.homedir(), resolvedDir.slice(1));
    } else {
      resolvedDir = path.resolve(resolvedDir);
    }

    // Source video file path in Next.js public/videos directory
    const sourcePath = path.join(process.cwd(), "public", "videos", filename);

    // Verify source video file exists
    try {
      await fs.access(sourcePath);
    } catch {
      return new NextResponse(`Source video file ${filename} not found`, { status: 404 });
    }

    // Ensure the target directory exists, create if missing
    await fs.mkdir(resolvedDir, { recursive: true });

    // Destination target path
    const destinationPath = path.join(resolvedDir, filename);

    // Copy the file
    await fs.copyFile(sourcePath, destinationPath);

    return NextResponse.json({
      success: true,
      message: `Successfully saved copy to: ${destinationPath}`,
      path: destinationPath,
    });
  } catch (error: any) {
    console.error("Save Video API Error:", error);
    return new NextResponse(error.message || "Failed to save video copy", { status: 500 });
  }
}
