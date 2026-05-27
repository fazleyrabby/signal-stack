import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs/promises";
import util from "util";

const execAsync = util.promisify(exec);

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const { voice, text } = await req.json();

    if (!voice || !text) {
      return new NextResponse("Voice and text are required", { status: 400 });
    }

    const generatorDir = path.resolve(process.cwd(), ["..", "local-video-generator"].join("/"));
    const pythonScript = path.join(generatorDir, "generate_audio.py");
    const pythonExe = path.join(generatorDir, "venv", "bin", "python");
    
    // Unique temp files to avoid collisions if clicked fast
    const timestamp = Date.now();
    const textFile = path.join(generatorDir, "temp_" + timestamp + ".txt");
    const audioFile = path.join(generatorDir, "temp_" + timestamp + ".mp3");

    await fs.writeFile(textFile, text);

    const safeVoice = voice.replace(/[^a-zA-Z\-]/g, "");

    // Generate audio
    await execAsync('"' + pythonExe + '" "' + pythonScript + '" "' + safeVoice + '" "' + textFile + '" "' + audioFile + '"');

    // Read generated audio
    const audioBuffer = await fs.readFile(audioFile);

    // Cleanup
    await fs.unlink(textFile).catch(() => {});
    await fs.unlink(audioFile).catch(() => {});

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error: any) {
    console.error("Voice Test Error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
