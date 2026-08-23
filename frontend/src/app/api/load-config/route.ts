import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const generatorDir = path.resolve(process.cwd(), "..", "local-video-generator");
    
    // First try ai-coding.json, then fallback to sample-data.json
    const pathsToTry = ["ai-coding.json", "sample-data.json"];
    let data = null;

    for (const p of pathsToTry) {
      try {
        const fullPath = path.join(generatorDir, p);
        const fileContent = await fs.readFile(fullPath, "utf-8");
        data = JSON.parse(fileContent);
        break; // Successfully loaded
      } catch (e) {
        // file doesn't exist, try next
      }
    }

    if (!data) {
      return new NextResponse(JSON.stringify({ error: "No configuration file found." }), { status: 404 });
    }

    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Load Config Error:", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
