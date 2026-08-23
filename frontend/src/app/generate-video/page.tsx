"use client";
import { useState, useEffect, useRef } from "react";
import { notFound } from "next/navigation";

export default function GenerateVideoPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  const [prompt, setPrompt] = useState("");
  const [voice, setVoice] = useState("en-US-BrianNeural");
  const [textRevealStyle, setTextRevealStyle] = useState("sentence");
  const [backgroundStyle, setBackgroundStyle] = useState("glowing-orb");
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<{ filename: string; url: string; createdAt: number }[]>([]);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [backgroundAudio, setBackgroundAudio] = useState("none");
  const [ambientVolume, setAmbientVolume] = useState(12);
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewingAmbient, setIsPreviewingAmbient] = useState(false);
  const [characterMascot, setCharacterMascot] = useState("none");
  const [customCharacterUrl, setCustomCharacterUrl] = useState("");
  const [scenes, setScenes] = useState<any[]>([]);
  const [enableLipSync, setEnableLipSync] = useState(false);
  const [voiceEngine, setVoiceEngine] = useState<"edge" | "kokoro">("edge");
  const [saveDirectory, setSaveDirectory] = useState("");
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | 'loading'; message: string } | null>(null);

  const handleSaveToDirectory = async () => {
    if (!videoUrl) return;
    const filename = videoUrl.split("/").pop();
    if (!filename) return;

    setSaveStatus({ type: 'loading', message: 'Saving copy...' });
    try {
      const res = await fetch("/api/save-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, targetDir: saveDirectory || "~/Downloads" }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setSaveStatus({ type: 'success', message: data.message });
    } catch (e: any) {
      setSaveStatus({ type: 'error', message: e.message || 'Failed to save copy' });
    }
  };

  const handleTestVoice = async () => {
    setIsTestingVoice(true);
    try {
      const testText = voice.startsWith("bn-")
        ? "এটি আপনার নির্বাচিত ভয়েসের একটি পরীক্ষা। আমাদের ভিডিও জেনারেটর এখন বাংলা ভাষা সমর্থন করে।"
        : "This is a quick test of the selected voice. Software engineering is changing fast.";

      const res = await fetch("/api/test-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice, text: testText }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (e: any) {
      console.error(e);
      alert("Voice test failed: " + (e.message || e));
    } finally {
      setIsTestingVoice(false);
    }
  };

  const fetchGallery = async () => {
    try {
      const res = await fetch("/api/videos");
      if (res.ok) {
        const data = await res.json();
        setGallery(data);
      }
    } catch (e) {
      console.error("Failed to load gallery", e);
    }
  };

  // Load gallery on mount
  useEffect(() => {
    fetchGallery();
  }, []);

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete ${filename}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/videos?filename=${encodeURIComponent(filename)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setGallery(prev => prev.filter(v => v.filename !== filename));
    } catch (e: any) {
      alert(`Failed to delete: ${e.message || e}`);
    }
  };

  const startVideoGenerationStream = async (payload: any) => {
    setLoading(true);
    setError(null);
    setVideoUrl(null);
    setProgress(0);
    setStatusText("Initializing stream connection...");
    setIsMinimized(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("Failed to read progress stream.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.status === "processing") {
                setProgress(data.progress);
                setStatusText(data.message);
              } else if (data.status === "success") {
                setProgress(100);
                setStatusText(data.message);
                setVideoUrl(data.videoUrl);
                if (data.scenes) {
                  setScenes(data.scenes);
                }
                await fetchGallery();
                setLoading(false);
                return;
              } else if (data.status === "error") {
                throw new Error(data.message);
              }
            } catch (e) {
              console.error("Failed to parse SSE payload:", e);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setStatusText("Cancelled by user. Temp files cleaned up.");
        setError(null);
      } else {
        setError(err.message || "Failed to generate video");
      }
      setLoading(false);
    } finally {
      abortRef.current = null;
    }
  };

  const handleCancelGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setLoading(false);
    setStatusText("Cancelled. Cleaning up temp files...");
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    await startVideoGenerationStream({ prompt, voice, textRevealStyle, backgroundStyle, backgroundAudio, ambientVolume, characterMascot, customCharacterUrl, enableLipSync, voiceEngine });
  };

  const handleReRender = async () => {
    if (scenes.length === 0) return;
    await startVideoGenerationStream({ voice, textRevealStyle, backgroundStyle, backgroundAudio, ambientVolume, characterMascot, customCharacterUrl, enableLipSync, voiceEngine, scenes });
  };

  const handleAmbientPreview = () => {
    if (backgroundAudio === "none") return;
    if (isPreviewingAmbient && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setIsPreviewingAmbient(false);
      return;
    }
    const audio = new Audio(`/api/ambient-audio?name=${encodeURIComponent(backgroundAudio)}`);
    audio.volume = ambientVolume / 100;
    audio.loop = true;
    audio.play().catch((e) => { console.error("Ambient preview failed:", e); setIsPreviewingAmbient(false); });
    audio.onended = () => setIsPreviewingAmbient(false);
    previewAudioRef.current = audio;
    setIsPreviewingAmbient(true);
  };

  useEffect(() => {
    if (previewAudioRef.current) previewAudioRef.current.volume = ambientVolume / 100;
  }, [ambientVolume]);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12 font-sans relative">
      {/* Floating Corner Loader */}
      {loading && (
        <div 
          className={`fixed top-4 right-4 z-50 transition-all duration-300 ease-in-out ${
            isMinimized ? "w-14 h-14 rounded-full" : "w-80 rounded-xl"
          } bg-card/90 backdrop-blur-md border border-border/80 shadow-2xl overflow-hidden`}
        >
          {isMinimized ? (
            <button 
              onClick={() => setIsMinimized(false)}
              className="w-full h-full flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition-colors relative group"
              title="Expand progress tracker"
            >
              <svg className="absolute inset-0 w-full h-full transform -rotate-90 p-1" viewBox="0 0 36 36">
                <path
                  className="text-muted-foreground/20"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-primary transition-all duration-300"
                  strokeWidth="3"
                  strokeDasharray={`${progress}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="text-xs font-extrabold text-foreground group-hover:scale-95 transition-transform">
                {progress}%
              </span>
            </button>
          ) : (
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Video Pipeline Active
                  </span>
                </div>
                <button 
                  onClick={() => setIsMinimized(true)}
                  className="text-xs bg-muted hover:bg-muted-foreground/20 px-2.5 py-1 rounded transition-colors text-muted-foreground font-semibold"
                >
                  Minimize
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-foreground truncate max-w-[80%]" title={statusText}>
                    {statusText || "Starting video setup..."}
                  </span>
                  <span className="text-primary font-mono">{progress}%</span>
                </div>
                <div className="w-full bg-background rounded-full h-1.5 overflow-hidden border border-border/50">
                  <div 
                    className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground italic leading-tight">
                Safe to browse. Minimizing keeps a corner status overlay.
              </p>

              <button
                type="button"
                onClick={handleCancelGeneration}
                className="w-full mt-2 px-3 py-2 text-xs font-bold uppercase tracking-wide rounded-md bg-red-600/90 hover:bg-red-600 text-white transition-colors shadow"
              >
                Cancel & Cleanup Temp Files
              </button>
            </div>
          )}
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold mb-3 text-primary tracking-tight">Local Video Generator</h1>
          <p className="text-muted-foreground text-lg">Generate cinematic YouTube shorts completely locally.</p>
        </div>
        
        <form onSubmit={handleGenerate} className="bg-card text-card-foreground p-6 rounded-xl border border-border shadow-xl">
          <div className="flex justify-between items-end mb-2">
            <label className="block text-sm font-medium text-gray-300">
              Voice (Azure Neural)
            </label>
            <button
              type="button"
              onClick={handleTestVoice}
              disabled={isTestingVoice}
              className="text-xs bg-blue-900/50 hover:bg-blue-800 text-blue-300 px-3 py-1 rounded border border-blue-700 transition-colors disabled:opacity-50"
            >
              {isTestingVoice ? "Generating Audio..." : "Test Voice"}
            </button>
          </div>
          <select
            value={voice}
            onChange={(e) => {
              const v = e.target.value;
              setVoice(v);
              if (v.startsWith("am_") || v.startsWith("bm_")) setVoiceEngine("kokoro");
              else if (v.startsWith("cartoon-")) setVoiceEngine("kokoro");
              else setVoiceEngine("edge");
            }}
            className="w-full p-3 bg-background border border-border rounded-lg text-foreground mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <optgroup label="US Casual & Expressive (Edge)">
              <option value="en-US-BrianNeural">Brian (US Male - Approachable/Casual)</option>
              <option value="en-US-AndrewNeural">Andrew (US Male - Warm/Authentic)</option>
              <option value="en-US-GuyNeural">Guy (US Male - Engaging/Passionate)</option>
              <option value="en-US-RogerNeural">Roger (US Male - Lively)</option>
            </optgroup>

            <optgroup label="Kokoro (Open Source, Apache-2.0)">
              <option value="am_michael">Michael (Kokoro Male - Neutral)</option>
              <option value="am_puck">Puck (Kokoro Male - Bright/Youthful)</option>
              <option value="am_fenrir">Fenrir (Kokoro Male - Deep/Gravelly)</option>
              <option value="am_adam">Adam (Kokoro Male - Standard)</option>
            </optgroup>

            <optgroup label="Cartoon FX (Kokoro + Pitch Shift)">
              <option value="cartoon-chipmunk">Chipmunk (High Pitch, Fast)</option>
              <option value="cartoon-gravel">Gravel (Mad Scientist / Low Growl)</option>
              <option value="cartoon-nasal">Nasal (Mid Pitch, Quirky)</option>
            </optgroup>

            <optgroup label="Bengali (Bangla)">
              <option value="bn-BD-PradeepNeural">Pradeep (BD Male)</option>
              <option value="bn-IN-BashkarNeural">Bashkar (IN Male)</option>
            </optgroup>
          </select>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Text Reveal Style</label>
              <select 
                value={textRevealStyle}
                onChange={(e) => setTextRevealStyle(e.target.value)}
                className="w-full p-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="sentence">Sentence by Sentence (Dramatic)</option>
                <option value="word">Word by Word (Kinetic/Fast)</option>
                <option value="typewriter">Typewriter (Char-by-Char)</option>
                <option value="char-pop">Character Pop (Bouncy)</option>
                <option value="slide-left">Slide In From Left</option>
                <option value="karaoke">Karaoke Highlight</option>
                <option value="glitch">Glitch RGB Split</option>
                <option value="blur-in">Blur Focus In</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Background Theme</label>
              <select 
                value={backgroundStyle}
                onChange={(e) => setBackgroundStyle(e.target.value)}
                className="w-full p-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="glowing-orb">Glowing Orb (Cinematic)</option>
                <option value="tech-grid">Tech Grid (Cyberpunk)</option>
                <option value="solid-minimal">Solid Minimal (Clean)</option>
                <option value="starfield">Starfield (Space)</option>
                <option value="aurora">Aurora (Northern Lights)</option>
                <option value="nebula">Nebula (Multi-Orb)</option>
                <option value="gradient-flow">Gradient Flow (Animated Hue)</option>
                <option value="matrix-rain">Matrix Rain (Hacker)</option>
                <option value="sunset-vapor">Sunset Vaporwave</option>
                <option value="game-rpg">Retro RPG / Visual Novel (Default)</option>
                <option value="game-rpg-anime">Retro RPG (Anime Countryside)</option>
                <option value="game-rpg-forest">Retro RPG (Night Forest)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ambient Background Sound</label>
              <div className="flex gap-2">
                <select
                  value={backgroundAudio}
                  onChange={(e) => setBackgroundAudio(e.target.value)}
                  className="flex-1 p-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="none">None (Silence)</option>
                  <option value="rain">Soothing Rain</option>
                  <option value="nature">Nature & Birds</option>
                  <option value="office">Ambient Office Cafe</option>
                  <option value="lofi">Lofi Beats</option>
                  <option value="ocean">Ocean Waves</option>
                  <option value="fire">Crackling Fire</option>
                  <option value="whitenoise">White Noise</option>
                  <option value="deepspace">Deep Space Drone</option>
                  <option value="heartbeat">Heartbeat (Tense)</option>
                  <option value="cinematic">Cinematic Pad</option>
                </select>
                <button
                  type="button"
                  onClick={handleAmbientPreview}
                  disabled={backgroundAudio === "none"}
                  className="px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 text-foreground text-sm font-semibold"
                  title="Preview ambient sound at current volume"
                >
                  {isPreviewingAmbient ? "Stop" : "Play"}
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-16">Volume</span>
                <input
                  type="range"
                  min={0} max={100} step={1}
                  value={ambientVolume}
                  onChange={(e) => setAmbientVolume(parseInt(e.target.value, 10))}
                  className="flex-1 accent-primary"
                />
                <span className="text-[11px] font-mono text-muted-foreground w-10 text-right">{ambientVolume}%</span>
              </div>
            </div>
          </div>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setShowcaseOpen(true)}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-foreground font-semibold"
            >
              Preview Text Reveal Styles & Background Themes
            </button>
          </div>
          {showcaseOpen && <StyleShowcase onClose={() => setShowcaseOpen(false)} currentText={textRevealStyle} currentBg={backgroundStyle} onPickText={setTextRevealStyle} onPickBg={setBackgroundStyle} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Character Mascot Overlay</label>
              <select 
                value={characterMascot}
                onChange={(e) => setCharacterMascot(e.target.value)}
                className="w-full p-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="none">None (Full Center Text)</option>
                <option value="developer">3D Developer Mascot</option>
                <option value="cyberpunk">3D Cyberpunk Mascot</option>
                <option value="pixel-user">8-Bit Pixel Character (You)</option>
                <option value="anime-vtuber">2D Anime VTuber (You)</option>
                <option value="custom">Custom Image Link</option>
              </select>
            </div>
            {characterMascot === "custom" && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Custom Mascot Image URL (.png)</label>
                <input
                  type="url"
                  placeholder="https://example.com/mascot.png"
                  value={customCharacterUrl}
                  onChange={(e) => setCustomCharacterUrl(e.target.value)}
                  className="w-full p-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                />
              </div>
            )}
          </div>

          {/* Lip-Sync Characters */}
          <div className="mb-4 p-4 bg-background/50 border border-border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-foreground">Lip-Sync Animated Characters</span>
                <p className="text-xs text-muted-foreground mt-0.5">SVG characters with frame-accurate mouth animation via Rhubarb. Requires <code className="text-xs bg-muted px-1 rounded">brew install rhubarb-lip-sync</code>.</p>
              </div>
              <button
                type="button"
                onClick={() => setEnableLipSync(!enableLipSync)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enableLipSync ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableLipSync ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            {enableLipSync && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">Voice Engine</label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="voiceEngine" value="edge" checked={voiceEngine === "edge"} onChange={() => setVoiceEngine("edge")} className="accent-primary" />
                    <span>Edge TTS <span className="text-muted-foreground text-xs">(Azure Neural, default)</span></span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="voiceEngine" value="kokoro" checked={voiceEngine === "kokoro"} onChange={() => setVoiceEngine("kokoro")} className="accent-primary" />
                    <span>Kokoro TTS <span className="text-muted-foreground text-xs">(expressive, local model)</span></span>
                  </label>
                </div>
                {voiceEngine === "kokoro" && (
                  <p className="text-xs text-amber-400/80 mt-2 bg-amber-950/30 border border-amber-800/40 rounded px-2 py-1">
                    Requires install: <code className="text-xs">pip install kokoro soundfile && brew install espeak-ng</code>. Falls back to Edge TTS if not installed.
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">LLM auto-assigns characters per scene. Adds ~2s per scene for Rhubarb analysis.</p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-end mb-2">
            <label className="block text-sm font-medium text-gray-300">
              Script / Essay Prompt
            </label>
            <button
              type="button"
              onClick={() => setPrompt("Software engineering is changing faster than many people can emotionally process.\\n\\nNot just technically. Economically. Psychologically. Professionally.\\n\\nThe industry once allowed room for slow growth. Mistakes. Mentorship. Gradual improvement. But now, everything feels compressed. Faster delivery. Faster learning. Faster adaptation.\\n\\nAnd many developers are quietly asking: 'How do you grow naturally in an environment that expects acceleration everywhere?'\\n\\nThe deepest fear is not really about AI itself. It's about becoming economically replaceable. Productivity is increasing. But insecurity is increasing too.")}
              className="text-xs bg-purple-900/50 hover:bg-purple-800 text-purple-300 px-3 py-1 rounded border border-purple-700 transition-colors"
            >
              Load Example Essay
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            className="w-full h-48 p-4 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4 font-mono text-sm leading-relaxed"
            placeholder="Paste your long-form essay, article, or script here. Our local Qwen LLM will automatically chunk it into cinematic scenes..."
          />
          
          {loading ? (
            <div className="w-full space-y-2 mt-4 p-4 bg-muted/30 border border-border rounded-lg">
              <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                <span className="animate-pulse flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  {statusText || "Starting video generation..."}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-background rounded-full h-2 overflow-hidden border border-border">
                <div 
                  className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 h-full transition-all duration-300 ease-out" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold py-3 px-4 rounded-lg transition-colors mt-4"
            >
              Generate Video
            </button>
          )}
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {videoUrl && (
          <div className="bg-card p-8 rounded-xl border border-border shadow-2xl">
            <h2 className="text-xl font-semibold mb-4 text-green-400">Your Video is Ready!</h2>
            <video 
              src={videoUrl} 
              controls 
              className="w-full h-auto max-h-[600px] rounded-lg shadow-lg bg-black object-contain"
            />
            <div className="mt-4 flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-border/60 pb-6">
              <a 
                href={videoUrl} 
                download="generated-pulse.mp4"
                className="w-full sm:w-auto text-center px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors shadow"
              >
                Download MP4 (to Downloads)
              </a>
              <span className="text-muted-foreground text-xs font-semibold">OR</span>
              <span className="text-muted-foreground text-xs">Save dynamically to local path below</span>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Save Copy to Local Folder Path
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="e.g. ~/Desktop or /Users/username/Videos (defaults to ~/Downloads)"
                  value={saveDirectory}
                  onChange={(e) => setSaveDirectory(e.target.value)}
                  className="flex-1 p-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground text-sm"
                />
                <button
                  type="button"
                  onClick={handleSaveToDirectory}
                  disabled={saveStatus?.type === 'loading'}
                  className="px-6 py-3 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-sm transition-colors shadow disabled:opacity-50 whitespace-nowrap"
                >
                  {saveStatus?.type === 'loading' ? 'Saving...' : 'Save to Folder'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Enter an absolute path (or use <code className="bg-muted px-1.5 py-0.5 rounded text-xs">~</code> for your home directory).
              </p>

              {saveStatus && (
                <div 
                  className={`mt-4 p-3 rounded-lg border text-sm ${
                    saveStatus.type === 'success' 
                      ? 'bg-green-950/30 border-green-800 text-green-200' 
                      : saveStatus.type === 'error' 
                      ? 'bg-red-950/30 border-red-800 text-red-200'
                      : 'bg-muted/40 border-border text-muted-foreground animate-pulse'
                  }`}
                >
                  {saveStatus.message}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-card text-card-foreground p-6 rounded-xl border border-border shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-border pb-4 gap-4">
            <div>
              <h2 className="text-xl font-bold text-primary">Cinematic Scene Script Editor</h2>
              <p className="text-xs text-muted-foreground mt-1">Adjust text, speech scripts, timing (in frames), custom images, and tone of individual scenes before re-rendering.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/load-config");
                    if (res.ok) {
                      const data = await res.json();
                      if (data.scenes) setScenes(data.scenes);
                    }
                  } catch (e) {
                    console.error("Failed to load config", e);
                  }
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded-lg transition-all shadow-md text-sm"
              >
                Load ai-coding.json
              </button>
              <button
                type="button"
                onClick={() => {
                  setScenes([...scenes, { text: "", voice: "", duration: 30, emphasis: "", visual: "", imageFile: "", audioFile: "" }]);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-all shadow-md text-sm"
              >
                + Add Empty Scene
              </button>
              <button
                type="button"
                onClick={handleReRender}
                disabled={loading || scenes.length === 0}
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg transition-all shadow-md flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {loading ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : null}
                Save & Re-render Video
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {scenes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground italic border-2 border-dashed border-border rounded-lg">
                No scenes yet. Generate a video from a script above, load a config, or add an empty scene manually.
              </div>
            )}
              {scenes.map((scene, idx) => (
                <div key={idx} className="bg-background border border-border rounded-lg p-4 relative group">
                  <div className="absolute top-4 right-4 flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => {
                        if (idx === 0) return;
                        const nextScenes = [...scenes];
                        const temp = nextScenes[idx];
                        nextScenes[idx] = nextScenes[idx - 1];
                        nextScenes[idx - 1] = temp;
                        setScenes(nextScenes);
                      }}
                      disabled={idx === 0}
                      className="p-1.5 bg-secondary hover:bg-secondary/80 rounded text-xs disabled:opacity-30"
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (idx === scenes.length - 1) return;
                        const nextScenes = [...scenes];
                        const temp = nextScenes[idx];
                        nextScenes[idx] = nextScenes[idx + 1];
                        nextScenes[idx + 1] = temp;
                        setScenes(nextScenes);
                      }}
                      disabled={idx === scenes.length - 1}
                      className="p-1.5 bg-secondary hover:bg-secondary/80 rounded text-xs disabled:opacity-30"
                      title="Move Down"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this scene?")) {
                          const nextScenes = scenes.filter((_, i) => i !== idx);
                          setScenes(nextScenes);
                        }
                      }}
                      className="p-1.5 bg-red-950/40 hover:bg-red-900 border border-red-900/50 rounded text-red-400 text-xs"
                      title="Delete Scene"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="text-xs font-bold text-primary mb-3">Scene #{idx + 1}</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">On-Screen Text (Concise)</label>
                      <textarea
                        value={scene.text}
                        onChange={(e) => {
                          const nextScenes = [...scenes];
                          nextScenes[idx].text = e.target.value;
                          setScenes(nextScenes);
                        }}
                        className="w-full p-2 bg-card border border-border rounded text-sm min-h-[70px] focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Cinematic text shown on screen"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Voice Script (Spoken Narration)</label>
                      <textarea
                        value={scene.voice}
                        onChange={(e) => {
                          const nextScenes = [...scenes];
                          nextScenes[idx].voice = e.target.value;
                          setScenes(nextScenes);
                        }}
                        className="w-full p-2 bg-card border border-border rounded text-sm min-h-[70px] focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Spoken voice narrations"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Duration (Frames, 30fps)</label>
                      <input
                        type="number"
                        value={scene.duration}
                        onChange={(e) => {
                          const nextScenes = [...scenes];
                          nextScenes[idx].duration = parseInt(e.target.value) || 30;
                          setScenes(nextScenes);
                        }}
                        className="w-full p-2 bg-card border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Emphasis / Emotional Tone</label>
                      <input
                        type="text"
                        value={scene.emphasis}
                        onChange={(e) => {
                          const nextScenes = [...scenes];
                          nextScenes[idx].emphasis = e.target.value;
                          setScenes(nextScenes);
                        }}
                        className="w-full p-2 bg-card border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="e.g. tense, curiosity, reflective"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Visual Prompt Direction</label>
                      <input
                        type="text"
                        value={scene.visual}
                        onChange={(e) => {
                          const nextScenes = [...scenes];
                          nextScenes[idx].visual = e.target.value;
                          setScenes(nextScenes);
                        }}
                        className="w-full p-2 bg-card border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Cinematic visual suggestion"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Background Image Override (Optional)</label>
                      <input
                        type="text"
                        value={scene.imageFile || ""}
                        onChange={(e) => {
                          const nextScenes = [...scenes];
                          nextScenes[idx].imageFile = e.target.value;
                          setScenes(nextScenes);
                        }}
                        className="w-full p-2 bg-card border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="e.g. scene_images/scene_13.png"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Custom Audio Override (Optional)</label>
                      <input
                        type="text"
                        value={scene.audioFile || ""}
                        onChange={(e) => {
                          const nextScenes = [...scenes];
                          nextScenes[idx].audioFile = e.target.value;
                          setScenes(nextScenes);
                        }}
                        className="w-full p-2 bg-card border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="e.g. scene_1.mp3 (leaves blank for TTS)"
                      />
                    </div>
                  </div>

                  {enableLipSync && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 pt-3 border-t border-border/50">
                      <div>
                        <label className="block text-xs font-medium text-primary/80 mb-1">Character</label>
                        <select
                          value={scene.characterId ?? "narrator"}
                          onChange={(e) => { const s = [...scenes]; s[idx].characterId = e.target.value; setScenes(s); }}
                          className="w-full p-2 bg-card border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="narrator">Narrator</option>
                          <option value="professor">Professor</option>
                          <option value="hacker">Hacker</option>
                          <option value="analyst">Analyst</option>
                          <option value="creative">Creative</option>
                          <option value="executive">Executive</option>
                          <option value="pixel-user">8-Bit Character (You)</option>
                          <option value="anime-vtuber">2D Anime VTuber (You)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-primary/80 mb-1">Body Pose</label>
                        <select
                          value={scene.bodyPose ?? "neutral"}
                          onChange={(e) => { const s = [...scenes]; s[idx].bodyPose = e.target.value; setScenes(s); }}
                          className="w-full p-2 bg-card border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="neutral">Neutral</option>
                          <option value="thinking">Thinking</option>
                          <option value="excited">Excited</option>
                          <option value="concerned">Concerned</option>
                          <option value="pointing">Pointing</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-primary/80 mb-1">Expression</label>
                        <select
                          value={scene.expression ?? "neutral"}
                          onChange={(e) => { const s = [...scenes]; s[idx].expression = e.target.value; setScenes(s); }}
                          className="w-full p-2 bg-card border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="neutral">Neutral</option>
                          <option value="happy">Happy</option>
                          <option value="serious">Serious</option>
                          <option value="surprised">Surprised</option>
                          <option value="thoughtful">Thoughtful</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => {
                  setScenes([...scenes, {
                    text: "New Scene Text",
                    voice: "New Scene Voice Narration Spoken by TTS",
                    duration: 90,
                    emphasis: "neutral",
                    visual: "Sleek tech backdrop"
                  }]);
                }}
                className="bg-secondary/40 hover:bg-secondary text-foreground font-semibold py-2 px-4 rounded border border-border text-sm transition-all"
              >
                + Add New Scene
              </button>
            </div>
          </div>
        {gallery.length > 0 && (
          <div className="pt-12">
            <h2 className="text-3xl font-bold mb-8 text-primary border-b border-border pb-4">
              Past Videos Gallery
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gallery.map((vid) => (
                <div key={vid.filename} className="bg-card p-4 rounded-xl border border-border shadow-lg">
                  <video 
                    src={vid.url} 
                    controls 
                    className="w-full h-auto max-h-[400px] rounded-lg shadow-sm bg-black object-contain mb-3"
                  />
                  <div className="flex justify-between items-center text-sm text-gray-400">
                    <span className="truncate mr-2" title={vid.filename}>
                      {new Date(vid.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex gap-3 whitespace-nowrap">
                      <a
                        href={vid.url}
                        download={vid.filename}
                        className="text-purple-400 hover:text-purple-300 font-medium"
                      >
                        Download
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(vid.filename)}
                        className="text-red-400 hover:text-red-300 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const TEXT_STYLES: { id: string; label: string }[] = [
  { id: "sentence", label: "Sentence (Dramatic)" },
  { id: "word", label: "Word by Word" },
  { id: "typewriter", label: "Typewriter" },
  { id: "char-pop", label: "Character Pop" },
  { id: "slide-left", label: "Slide From Left" },
  { id: "karaoke", label: "Karaoke Highlight" },
  { id: "glitch", label: "Glitch RGB" },
  { id: "blur-in", label: "Blur Focus In" },
];

const BG_STYLES: { id: string; label: string }[] = [
  { id: "glowing-orb", label: "Glowing Orb" },
  { id: "tech-grid", label: "Tech Grid" },
  { id: "solid-minimal", label: "Solid Minimal" },
  { id: "starfield", label: "Starfield" },
  { id: "aurora", label: "Aurora" },
  { id: "nebula", label: "Nebula" },
  { id: "gradient-flow", label: "Gradient Flow" },
  { id: "matrix-rain", label: "Matrix Rain" },
  { id: "sunset-vapor", label: "Sunset Vaporwave" },
  { id: "game-rpg", label: "Retro RPG (Default)" },
  { id: "game-rpg-anime", label: "Retro RPG (Anime)" },
  { id: "game-rpg-forest", label: "Retro RPG (Forest)" },
];

function useFrameCounter(fps = 30) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = now - last;
      const step = elapsed / (1000 / fps);
      setFrame((f) => (f + step) % 600);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fps]);
  return frame;
}

function TextPreview({ id }: { id: string }) {
  const frame = useFrameCounter();
  const sample = "Cinematic motion typography preview";
  const words = sample.split(" ");
  const chars = Array.from(sample);
  const loopT = (frame % 180) / 180;
  const baseStyle: React.CSSProperties = { color: "#fff", fontWeight: 700, fontFamily: "system-ui, sans-serif" };

  if (id === "typewriter") {
    const n = Math.floor((frame % 180) / 3) % (sample.length + 10);
    const caret = Math.floor(frame / 8) % 2 === 0;
    return <div style={{ ...baseStyle, fontSize: 18 }}>{sample.slice(0, n)}<span style={{ opacity: caret ? 1 : 0 }}>|</span></div>;
  }
  if (id === "char-pop") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        {chars.map((c, i) => {
          const p = Math.max(0, Math.min(1, (loopT * 1.4) - i * 0.025));
          return <span key={i} style={{ ...baseStyle, fontSize: 18, transform: `scale(${0.3 + p * 0.7})`, opacity: p, display: "inline-block" }}>{c === " " ? " " : c}</span>;
        })}
      </div>
    );
  }
  if (id === "slide-left") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {words.map((w, i) => {
          const p = Math.max(0, Math.min(1, loopT * 1.5 - i * 0.12));
          return <span key={i} style={{ ...baseStyle, fontSize: 18, transform: `translateX(${(1 - p) * -60}px)`, opacity: p }}>{w}</span>;
        })}
      </div>
    );
  }
  if (id === "karaoke") {
    const active = Math.floor(loopT * words.length);
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {words.map((w, i) => (
          <span key={i} style={{ ...baseStyle, fontSize: 18, color: i === active ? "#7ee787" : i < active ? "#fff" : "rgba(255,255,255,0.35)", transform: i === active ? "scale(1.15)" : "scale(1)", transition: "all 0.15s" }}>{w}</span>
        ))}
      </div>
    );
  }
  if (id === "glitch") {
    const j = Math.sin(frame * 1.7) * 2;
    return (
      <div style={{ position: "relative" }}>
        <div style={{ ...baseStyle, fontSize: 18 }}>{sample}</div>
        <div style={{ ...baseStyle, fontSize: 18, color: "#ff00ea", position: "absolute", top: j, left: j, mixBlendMode: "screen", opacity: 0.7 }}>{sample}</div>
        <div style={{ ...baseStyle, fontSize: 18, color: "#00eaff", position: "absolute", top: -j, left: -j, mixBlendMode: "screen", opacity: 0.7 }}>{sample}</div>
      </div>
    );
  }
  if (id === "blur-in") {
    const p = Math.min(1, loopT * 1.5);
    return <div style={{ ...baseStyle, fontSize: 20, filter: `blur(${(1 - p) * 12}px)`, transform: `scale(${1 + (1 - p) * 0.2})`, opacity: p }}>{sample}</div>;
  }
  if (id === "word") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {words.map((w, i) => {
          const p = Math.max(0, Math.min(1, loopT * 1.5 - i * 0.1));
          return <span key={i} style={{ ...baseStyle, fontSize: 18, transform: `scale(${0.8 + p * 0.2})`, opacity: p }}>{w}</span>;
        })}
      </div>
    );
  }
  const p = Math.min(1, loopT * 1.3);
  return <div style={{ ...baseStyle, fontSize: 18, transform: `translateY(${(1 - p) * 20}px)`, opacity: p }}>{sample}</div>;
}

function BgPreview({ id }: { id: string }) {
  const frame = useFrameCounter();
  const t = frame;
  const pulse = 0.8 + Math.sin(t / 30) * 0.2;
  const driftX = Math.sin(t / 60) * 30;
  const driftY = Math.cos(t / 50) * 20;
  const common: React.CSSProperties = { position: "absolute", inset: 0, overflow: "hidden", borderRadius: 8 };

  if (id === "solid-minimal") return <div style={{ ...common, background: "radial-gradient(circle at 50% 0%, rgba(138,43,226,0.25) 0%, #0a0a0f 70%)" }} />;
  if (id === "tech-grid") return (
    <div style={{ ...common, background: "#0a0a0f" }}>
      <div style={{ position: "absolute", inset: "-20%", backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "20px 20px", transform: `translateY(${(t * 0.5) % 20}px) perspective(200px) rotateX(45deg)` }} />
    </div>
  );
  if (id === "starfield") {
    const stars = Array.from({ length: 25 }, (_, i) => ({ x: (Math.sin(i * 13.37) * 0.5 + 0.5) * 100, y: (Math.cos(i * 1.7 * 13.37) * 0.5 + 0.5) * 100, s: 1 + (i % 3), tw: 0.4 + Math.sin(t / 20 + i) * 0.4 }));
    return <div style={{ ...common, background: "#02030a" }}>{stars.map((s, i) => <div key={i} style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, borderRadius: "50%", background: "#fff", opacity: s.tw, boxShadow: `0 0 ${s.s * 3}px rgba(255,255,255,${s.tw})` }} />)}</div>;
  }
  if (id === "aurora") return (
    <div style={{ ...common, background: "#05010f" }}>
      <div style={{ position: "absolute", width: "70%", height: "70%", top: "10%", left: `${10 + Math.sin(t / 80) * 20}%`, background: "radial-gradient(circle, rgba(120,0,255,0.6) 0%, transparent 70%)", filter: "blur(30px)" }} />
      <div style={{ position: "absolute", width: "60%", height: "60%", top: "25%", left: `${25 + Math.cos(t / 100) * 25}%`, background: "radial-gradient(circle, rgba(0,200,255,0.55) 0%, transparent 70%)", filter: "blur(35px)" }} />
      <div style={{ position: "absolute", width: "50%", height: "50%", top: "35%", left: `${30 + Math.sin(t / 120) * 18}%`, background: "radial-gradient(circle, rgba(255,0,150,0.45) 0%, transparent 70%)", filter: "blur(35px)" }} />
    </div>
  );
  if (id === "nebula") return (
    <div style={{ ...common, background: "#08010f" }}>
      {[0, 1, 2, 3].map((i) => {
        const a = (t / 200) + i * 1.5;
        const x = 50 + Math.cos(a) * 20;
        const y = 50 + Math.sin(a * 1.3) * 20;
        const colors = ["rgba(180,60,255,0.55)", "rgba(60,180,255,0.5)", "rgba(255,80,180,0.5)", "rgba(80,255,200,0.45)"];
        return <div key={i} style={{ position: "absolute", width: 140, height: 140, borderRadius: "50%", top: `${y}%`, left: `${x}%`, transform: "translate(-50%,-50%)", background: `radial-gradient(circle, ${colors[i]} 0%, transparent 65%)`, filter: "blur(25px)" }} />;
      })}
    </div>
  );
  if (id === "gradient-flow") {
    const hue = (t * 0.8) % 360;
    return <div style={{ ...common, background: `linear-gradient(${t % 360}deg, hsl(${hue},70%,15%), hsl(${(hue + 60) % 360},70%,10%), hsl(${(hue + 180) % 360},70%,18%))` }} />;
  }
  if (id === "matrix-rain") {
    const cols = 12;
    return (
      <div style={{ ...common, background: "#000505" }}>
        {Array.from({ length: cols }).map((_, c) => {
          const speed = 1 + ((c * 7) % 5) * 0.5;
          const offset = (t * speed + c * 30) % 200;
          return <div key={c} style={{ position: "absolute", top: offset - 100, left: `${(c / cols) * 100}%`, color: "#00ff7f", fontFamily: "monospace", fontSize: 10, writingMode: "vertical-rl", textShadow: "0 0 4px #00ff7f", opacity: 0.7 }}>{"010101010101"}</div>;
        })}
      </div>
    );
  }
  if (id === "sunset-vapor") return (
    <div style={{ ...common, background: "linear-gradient(180deg,#2b0a3d 0%,#5a1361 30%,#c2185b 60%,#ff6e40 85%,#ffb74d 100%)" }}>
      <div style={{ position: "absolute", bottom: 0, width: "100%", height: "40%", backgroundImage: "linear-gradient(rgba(255,0,150,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,150,0.5) 1px, transparent 1px)", backgroundSize: "16px 16px", transform: `perspective(100px) rotateX(60deg) translateY(${(t * 0.8) % 16}px)`, transformOrigin: "top" }} />
      <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 60, height: 60, borderRadius: "50%", background: "radial-gradient(circle,#ffd54f 0%,#ff6e40 60%,transparent 75%)", filter: "blur(4px)" }} />
    </div>
  );
  if (id === "game-rpg") return (
    <div style={{ ...common, background: "#0a0a0f" }}>
      <img src="/scene_images/night_forest.png" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} alt="RPG Forest" />
      <div style={{ position: "absolute", bottom: 4, left: 4, right: 4, height: 35, background: "rgba(0,0,0,0.85)", border: "2px solid #fff", borderRadius: 2 }} />
    </div>
  );
  if (id === "game-rpg-anime") return (
    <div style={{ ...common, background: "#0a0a0f" }}>
      <img src="/scene_images/anime_country_road.png" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} alt="RPG Anime" />
      <div style={{ position: "absolute", bottom: 4, left: 4, right: 4, height: 35, background: "rgba(0,0,0,0.85)", border: "2px solid #fff", borderRadius: 2 }} />
    </div>
  );
  if (id === "game-rpg-forest") return (
    <div style={{ ...common, background: "#0a0a0f" }}>
      <img src="/scene_images/night_forest.png" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} alt="RPG Forest" />
      <div style={{ position: "absolute", bottom: 4, left: 4, right: 4, height: 35, background: "rgba(0,0,0,0.85)", border: "2px solid #fff", borderRadius: 2 }} />
    </div>
  );
  // glowing-orb default
  return (
    <div style={{ ...common, background: "#0a0a0f" }}>
      <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(138,43,226,0.6) 0%, transparent 70%)", top: "50%", left: "50%", transform: `translate(-50%,-50%) translate(${driftX}px, ${driftY}px) scale(${pulse})`, filter: "blur(25px)" }} />
    </div>
  );
}

function StyleShowcase({ onClose, currentText, currentBg, onPickText, onPickBg }: { onClose: () => void; currentText: string; currentBg: string; onPickText: (s: string) => void; onPickBg: (s: string) => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-card pt-1 pb-3 border-b border-border z-10">
          <h2 className="text-xl font-bold text-foreground">Style & Theme Showcase</h2>
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded bg-muted hover:bg-muted-foreground/20 text-foreground">Close</button>
        </div>

        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Text Reveal Styles — click to select</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {TEXT_STYLES.map((s) => (
            <button key={s.id} onClick={() => { onPickText(s.id); }} className={`p-3 rounded-lg border text-left transition-all ${currentText === s.id ? "border-primary ring-2 ring-primary/40 bg-primary/10" : "border-border bg-background hover:border-muted-foreground"}`}>
              <div className="h-20 rounded-md mb-2 bg-black/60 flex items-center justify-center px-3 overflow-hidden">
                <TextPreview id={s.id} />
              </div>
              <div className="text-xs font-semibold text-foreground">{s.label}</div>
            </button>
          ))}
        </div>

        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Background Themes — click to select</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {BG_STYLES.map((s) => (
            <button key={s.id} onClick={() => { onPickBg(s.id); }} className={`p-2 rounded-lg border text-left transition-all ${currentBg === s.id ? "border-primary ring-2 ring-primary/40 bg-primary/10" : "border-border bg-background hover:border-muted-foreground"}`}>
              <div className="relative h-32 rounded-md overflow-hidden border border-border">
                <BgPreview id={s.id} />
              </div>
              <div className="text-xs font-semibold text-foreground mt-2 px-1">{s.label}</div>
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted-foreground italic">Previews are approximations. Final video uses the same logic at 1920×1080 30fps.</p>
      </div>
    </div>
  );
}
