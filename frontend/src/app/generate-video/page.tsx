"use client";
import { useState, useEffect } from "react";

export default function GenerateVideoPage() {
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
  const [characterMascot, setCharacterMascot] = useState("none");
  const [customCharacterUrl, setCustomCharacterUrl] = useState("");

  const handleTestVoice = async () => {
    setIsTestingVoice(true);
    try {
      const res = await fetch("/api/test-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice, text: "This is a quick test of the selected voice. Software engineering is changing fast." }),
      });
      if (!res.ok) throw new Error("Failed to generate test voice");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (e) {
      console.error(e);
      alert("Failed to test voice.");
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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setVideoUrl(null);
    setProgress(0);
    setStatusText("Initializing stream connection...");
    setIsMinimized(false);

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, voice, textRevealStyle, backgroundStyle, backgroundAudio, characterMascot, customCharacterUrl }),
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
      setError(err.message || "Failed to generate video");
      setLoading(false);
    }
  };

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
            onChange={(e) => setVoice(e.target.value)}
            className="w-full p-3 bg-background border border-border rounded-lg text-foreground mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <optgroup label="US Casual & Expressive">
              <option value="en-US-AvaNeural">Ava (US Female - Expressive/Friendly)</option>
              <option value="en-US-EmmaNeural">Emma (US Female - Cheerful/Conversational)</option>
              <option value="en-US-BrianNeural">Brian (US Male - Approachable/Casual)</option>
              <option value="en-US-AndrewNeural">Andrew (US Male - Warm/Authentic)</option>
              <option value="en-US-JennyNeural">Jenny (US Female - Friendly/Considerate)</option>
              <option value="en-US-GuyNeural">Guy (US Male - Engaging/Passionate)</option>
              <option value="en-US-RogerNeural">Roger (US Male - Lively)</option>
              <option value="en-US-AnaNeural">Ana (US Female - Cute/Conversational)</option>
            </optgroup>
            
            <optgroup label="Bengali (Bangla)">
              <option value="bn-BD-NabanitaNeural">Nabanita (BD Female)</option>
              <option value="bn-BD-PradeepNeural">Pradeep (BD Male)</option>
              <option value="bn-IN-TanishaaNeural">Tanishaa (IN Female)</option>
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
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ambient Background Sound</label>
              <select 
                value={backgroundAudio}
                onChange={(e) => setBackgroundAudio(e.target.value)}
                className="w-full p-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="none">None (Silence)</option>
                <option value="rain">Soothing Rain</option>
                <option value="nature">Nature & Birds</option>
                <option value="office">Ambient Office Cafe</option>
              </select>
            </div>
          </div>
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
            <div className="mt-4 text-center">
              <a 
                href={videoUrl} 
                download="generated-pulse.mp4"
                className="inline-block text-purple-400 hover:text-purple-300 underline"
              >
                Download MP4
              </a>
            </div>
          </div>
        )}
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
