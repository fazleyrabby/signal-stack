import { NextResponse } from "next/server";
import { exec, spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import util from "util";

const execAsync = util.promisify(exec);

const SYSTEM_PROMPT = `You are building an automated cinematic AI video generation pipeline using React, Remotion, Azure TTS, and FFmpeg.

Your task is to transform long-form narration, articles, essays, or prompts into short cinematic scenes optimized for motion typography videos.

CRITICAL GOAL:
Do NOT dump full paragraphs onto the screen.

The generated video must feel like:
- modern documentary videos
- cinematic AI explainers
- minimalist motion graphics
- short-form YouTube essays
- Apple-style presentation pacing
- emotionally paced typography videos

==================================================
OUTPUT REQUIREMENTS
==================================================

Generate structured JSON scenes.

Each scene MUST contain:
- voice: full narration spoken by TTS
- text: SHORT cinematic on-screen text only (Max 3 lines)
- duration: estimated duration in frames (assume 30fps)
- visual: suggested visual direction
- emphasis: emotional tone

==================================================
IMPORTANT RULES
==================================================
1. NEVER put full narration on screen.
2. Voice narration can be long.
3. Keep text cinematic (e.g. "The fear is economic.")
4. Split scenes aggressively (3 to 8 seconds).
5. Visual suggestions should be cinematic.
6. Emotional pacing matters.
7. Avoid generic AI slop phrasing.

Return ONLY valid JSON array.`;

export async function POST(req: Request) {
  try {
    const { prompt, voice, textRevealStyle, backgroundStyle, backgroundAudio, characterMascot, customCharacterUrl, scenes: preDefinedScenes } = await (req.json() as Promise<{ prompt?: string; voice: string; textRevealStyle?: string; backgroundStyle?: string; backgroundAudio?: string; characterMascot?: string; customCharacterUrl?: string; scenes?: any[] }>);

    if (!prompt && !preDefinedScenes) {
      return new NextResponse("Prompt or predefined scenes are required", { status: 400 });
    }

    const generatorDir = path.resolve(process.cwd(), ["..", "local-video-generator"].join("/"));
    const publicDir = path.join(generatorDir, "public");
    const dataFile = path.join(generatorDir, "sample-data.json");

    const responseStream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendEvent({ status: "processing", progress: 2, message: "Initializing video generator..." });

          // 1. Ensure public directory exists and clear old audio
          sendEvent({ status: "processing", progress: 5, message: "Clearing old audio assets..." });
          await fs.mkdir(publicDir, { recursive: true });
          const oldFiles = await fs.readdir(publicDir);
          for (const file of oldFiles) {
            if (file.endsWith(".mp3") && (file.startsWith("scene_") || file.startsWith("temp_"))) {
              await fs.unlink(path.join(publicDir, file));
            }
          }

          let scenes: any[] = [];
          if (preDefinedScenes && preDefinedScenes.length > 0) {
            scenes = preDefinedScenes;
            console.log("Using " + scenes.length + " predefined scenes directly.");
            sendEvent({ status: "processing", progress: 20, message: `Using ${scenes.length} predefined edited scenes...` });
          } else {
            // 2. Call local Qwen LLM
            sendEvent({ status: "processing", progress: 8, message: "Drafting script and scenes with local Qwen LLM..." });
            console.log("Calling local LLM (Qwen) on port 8081...");
            
            let activeModelId = "~/ai/models/mlx/Qwen3.5-4B-OptiQ-4bit";
            try {
              const modelsRes = await fetch("http://127.0.0.1:8081/v1/models");
              if (modelsRes.ok) {
                const modelsData = await modelsRes.json();
                if (modelsData.data && modelsData.data.length > 0) {
                  const localModel = modelsData.data.find((m: any) => m.id.startsWith("/"));
                  activeModelId = localModel ? localModel.id : modelsData.data[0].id;
                }
              }
            } catch (e) {
              console.warn("Could not fetch /v1/models, falling back to default.");
            }

            let systemPrompt = SYSTEM_PROMPT;
            if (voice.startsWith("bn-")) {
              systemPrompt += "\n\nCRITICAL: The selected narration voice is Bengali (Bangla). You MUST generate the JSON 'voice' (narration script) and 'text' (on-screen text) content entirely in Bengali (Bangla) script. Translate the concept beautifully into fluent, natural, and poetic/cinematic Bengali. Do not use English text in 'voice' or 'text' fields.";
            }

            const llmRes = await fetch("http://127.0.0.1:8081/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: activeModelId, 
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: prompt }
                ],
                temperature: 0.7
              })
            });

            if (!llmRes.ok) {
              const errorText = await llmRes.text().catch(() => "");
              throw new Error("Failed to connect to local LLM. Status: " + llmRes.status + " | Response: " + errorText);
            }

            const llmData = await llmRes.json();
            let jsonContent = llmData.choices[0].message.content.trim();
            
            const firstBracket = jsonContent.indexOf('[');
            const lastBracket = jsonContent.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
              jsonContent = jsonContent.substring(firstBracket, lastBracket + 1);
            }
            
            scenes = JSON.parse(jsonContent);
            console.log("Successfully generated " + scenes.length + " scenes.");
            sendEvent({ status: "processing", progress: 25, message: `Successfully structured ${scenes.length} scenes.` });
          }

          // 3. Generate Audio for EACH scene
          const safeVoice = voice.replace(/[^a-zA-Z\-]/g, "");
          const pythonScript = path.join(generatorDir, "generate_audio.py");
          const pythonExe = path.join(generatorDir, "venv", "bin", "python");

          for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const audioProgress = 25 + Math.round((i / scenes.length) * 35);
            sendEvent({ 
              status: "processing", 
              progress: audioProgress, 
              message: `Synthesizing audio for scene ${i + 1} of ${scenes.length}...` 
            });
            
            const textFile = path.join(generatorDir, "scene_" + i + ".txt");
            await fs.writeFile(textFile, scene.voice);
            
            const audioFile = path.join(publicDir, "scene_" + i + ".mp3");
            await execAsync('"' + pythonExe + '" "' + pythonScript + '" "' + safeVoice + '" "' + textFile + '" "' + audioFile + '"');
            
            await fs.unlink(textFile);
            scene.audioFile = "scene_" + i + ".mp3";
          }

          // 4. Write the scenes array and config to sample-data.json
          sendEvent({ status: "processing", progress: 60, message: "Configuring Remotion render parameters..." });
          const inputProps = { scenes, textRevealStyle, backgroundStyle, backgroundAudio, characterMascot, customCharacterUrl };
          await fs.writeFile(dataFile, JSON.stringify(inputProps, null, 2));

          // 5. Trigger Remotion Render
          sendEvent({ status: "processing", progress: 65, message: "Bundling Remotion project..." });
          
          await new Promise<void>((resolve, reject) => {
            const getScript = () => ["render", "mjs"].join(".");
            const getConfig = () => ["sample-data", "json"].join(".");
            const renderProcess = spawn("node", [getScript(), getConfig()], { cwd: generatorDir });
            let errorOutput = "";

            renderProcess.stdout.on("data", (data) => {
              const chunk = data.toString();
              const match = chunk.match(/Rendering progress:\s*(\d+)%/);
              if (match) {
                const remotionPct = parseInt(match[1], 10);
                const scaledProgress = 65 + Math.round((remotionPct / 100) * 30); // 65% to 95%
                sendEvent({
                  status: "processing",
                  progress: scaledProgress,
                  message: `Rendering video frames (${remotionPct}%)...`
                });
              }
            });

            renderProcess.stderr.on("data", (data) => {
              errorOutput += data.toString();
            });

            renderProcess.on("close", (code) => {
              if (code === 0) {
                resolve();
              } else {
                reject(new Error(`Remotion process exited with code ${code}. Error: ${errorOutput}`));
              }
            });
          });

          // 6. Find the generated mp4
          sendEvent({ status: "processing", progress: 96, message: "Locating generated MP4 asset..." });
          const outDir = path.join(generatorDir, "out");
          const videoFiles = await fs.readdir(outDir);
          const mp4Files = videoFiles.filter(f => f.endsWith(".mp4"));
          
          let newestFile = "";
          let newestTime = 0;
          for (const f of mp4Files) {
            const stats = await fs.stat(path.join(outDir, f));
            if (stats.mtimeMs > newestTime) {
              newestTime = stats.mtimeMs;
              newestFile = f;
            }
          }

          if (!newestFile) {
            throw new Error("Video file was not generated.");
          }

          // Move it to Next.js public directory
          sendEvent({ status: "processing", progress: 98, message: "Saving video to static library..." });
          const publicVideosDir = path.join(process.cwd(), "public", "videos");
          await fs.mkdir(publicVideosDir, { recursive: true }).catch(() => {});
          
          const sourcePath = path.join(outDir, newestFile);
          const targetPath = path.join(publicVideosDir, newestFile);
          await fs.copyFile(sourcePath, targetPath);

          sendEvent({
            status: "success",
            progress: 100,
            message: "Video generated successfully!",
            videoUrl: `/videos/${newestFile}`,
            scenes: scenes
          });
        } catch (error: any) {
          console.error("Video Generation Error:", error);
          sendEvent({
            status: "error",
            message: error.message || "Failed to generate video"
          });
        } finally {
          controller.close();
        }
      }
    });

    return new NextResponse(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      }
    });
  } catch (error: any) {
    console.error("Video Generation Error:", error);
    return new NextResponse(error.message, { status: 500 });
  }
}
