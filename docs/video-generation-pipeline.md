# Video Generation Pipeline

A fully local, offline-capable cinematic video generation system built on top of **Remotion**, a local **Qwen LLM**, **Azure Edge TTS / Kokoro TTS**, **FFmpeg**, and **Rhubarb Lip Sync**.

---

## High-Level Flow

```
User Prompt (text essay / script)
        │
        ▼
1. Local Qwen LLM (port 8081)
   └─ Structures prompt into cinematic JSON scenes
        │
        ▼
2. TTS Audio Synthesis (per scene)
   ├─ Edge TTS  → scene_N.mp3
   └─ Kokoro TTS (optional, local model)
        │
        ▼
3. Lip-Sync Analysis (optional)
   └─ Rhubarb → scene_N_visemes.json (mouth cue timecodes)
        │
        ▼
4. Remotion Render
   └─ node render.mjs sample-data.json → out/pulse-<timestamp>.mp4
        │
        ▼
5. Output
   └─ Copied to frontend/public/videos/ → served as /videos/<file>.mp4
```

---

## Components

### 1. API Route — `POST /api/generate-video`

**File:** [`frontend/src/app/api/generate-video/route.ts`](../frontend/src/app/api/generate-video/route.ts)

This is the orchestrator. It:
- Accepts a streaming `POST` request with `application/json` body
- Sends progress events back via **Server-Sent Events (SSE)**
- Coordinates all downstream steps (LLM → TTS → Lip-sync → Render → Copy)

**Request body:**
```json
{
  "prompt": "Your essay or script text...",
  "voice": "en-US-BrianNeural",
  "voiceEngine": "edge",
  "textRevealStyle": "sentence",
  "backgroundStyle": "game-rpg-anime",
  "backgroundAudio": "rain",
  "ambientVolume": 12,
  "characterMascot": "anime-vtuber",
  "enableLipSync": true,
  "scenes": []  // Optional: skip LLM and use pre-edited scenes directly
}
```

**SSE progress events:**
```json
{ "status": "processing", "progress": 25, "message": "Structured 8 scenes." }
{ "status": "success",    "progress": 100, "videoUrl": "/videos/pulse-xxx.mp4", "scenes": [...] }
{ "status": "error",      "message": "Failed to connect to local LLM." }
```

---

### 2. Local LLM — Qwen (port 8081)

**What it does:** Transforms a raw long-form essay/prompt into a structured JSON array of cinematic scenes.

**How to run:**
```bash
# Using mlx-lm or LM Studio — expose on port 8081
mlx_lm.server --model ~/ai/models/mlx/Qwen3.5-4B-OptiQ-4bit --port 8081
```

**The system prompt** instructs the LLM to:
- Split content into short scenes (3–8 seconds each)
- Generate `voice` (full narration for TTS) and `text` (short cinematic on-screen text, ≤3 lines)
- Estimate `duration` in frames (30fps)
- Suggest `visual` direction and `emphasis` emotional tone
- When lip-sync is enabled: assign `characterId`, `bodyPose`, and `expression` per scene

**Scene JSON schema:**
```json
{
  "text": "The fear is economic.",
  "voice": "The deepest fear isn't about AI replacing work — it's about becoming economically replaceable.",
  "duration": 150,
  "visual": "Close-up on anxious developer staring at job board",
  "emphasis": "tense",
  "characterId": "analyst",
  "bodyPose": "concerned",
  "expression": "serious"
}
```

> **Why a local LLM?** Privacy — your script never leaves your machine. Also enables offline use and fast iteration without API costs.

---

### 3. TTS Audio Synthesis

**File:** [`local-video-generator/generate_audio.py`](../local-video-generator/generate_audio.py)

Supports two engines:

| Engine | Voices | Notes |
|--------|--------|-------|
| **Edge TTS** (default) | Azure Neural voices (`en-US-BrianNeural`, `bn-BD-PradeepNeural`, etc.) | Requires internet |
| **Kokoro TTS** | `am_michael`, `am_puck`, `am_fenrir`, `am_adam` | Fully local, Apache-2.0 |
| **Cartoon FX** | `cartoon-chipmunk`, `cartoon-gravel`, `cartoon-nasal` | Kokoro + FFmpeg pitch/tempo shift |

**Bengali support:** When a `bn-` voice is selected, the LLM system prompt is extended to instruct Qwen to generate all `voice` and `text` fields in Bengali script.

**Output:** `local-video-generator/public/scene_N.mp3` (one per scene)

---

### 4. Lip-Sync Analysis (Optional)

**File:** [`local-video-generator/generate_lipsync.py`](../local-video-generator/generate_lipsync.py)

Uses **Rhubarb Lip Sync** to analyze each scene's audio and output frame-accurate mouth cue data.

**Pipeline per scene:**
```
scene_N.mp3 → (ffmpeg) → scene_N.wav → (rhubarb) → scene_N_visemes.json
```

**Viseme JSON format (Rhubarb output):**
```json
{
  "metadata": { "soundFile": "scene_0.wav", "duration": 4.32 },
  "mouthCues": [
    { "start": 0.00, "end": 0.12, "value": "X" },
    { "start": 0.12, "end": 0.28, "value": "B" },
    ...
  ]
}
```

Mouth cue values map to 9 phoneme shapes (A–H, X=silence). If Rhubarb is not installed or fails, a silence-only fallback viseme file is written automatically.

**Install Rhubarb:**
```bash
brew install rhubarb-lip-sync
```

---

### 5. Remotion Renderer

**File:** [`local-video-generator/render.mjs`](../local-video-generator/render.mjs)

Loads `sample-data.json`, bundles the React/Remotion project, and renders the `PulseVideo` composition to an MP4.

```bash
node render.mjs sample-data.json
# Output: local-video-generator/out/pulse-<timestamp>.mp4
```

**`sample-data.json` shape:**
```json
{
  "scenes": [...],
  "textRevealStyle": "sentence",
  "backgroundStyle": "game-rpg-anime",
  "backgroundAudio": "rain",
  "ambientVolume": 12,
  "characterMascot": "anime-vtuber",
  "enableLipSync": true
}
```

---

## Remotion Composition — `PulseVideo`

**File:** [`local-video-generator/src/PulseVideo.tsx`](../local-video-generator/src/PulseVideo.tsx)

Each scene is rendered as a `<Sequence>` with:

- **`DynamicBackground`** — animated background (glowing orb, starfield, aurora, RPG scene image, etc.)
- **`renderContent()`** — animated text reveal (sentence, word, typewriter, karaoke, glitch, etc.)
- **`PixelCharacter`** — sprite-based animated character (pixel-user or anime-vtuber)
- **`LipSyncCharacter`** — SVG character with frame-accurate mouth animation driven by viseme data
- **`GameDialogBox`** — pixel-art styled RPG dialog box (shown in `game-rpg-*` backgrounds)
- **`Audio`** — plays the scene's TTS audio file

### Background Themes

| ID | Style |
|----|-------|
| `glowing-orb` | Floating pulsing orb (default) |
| `tech-grid` | Perspective scrolling grid |
| `starfield` | Twinkling star field |
| `aurora` | Northern lights blobs |
| `nebula` | Orbiting color blobs |
| `gradient-flow` | Animated hue gradient |
| `matrix-rain` | Falling katakana/binary |
| `sunset-vapor` | Vaporwave sunset grid |
| `game-rpg` | RPG visual novel + night forest bg |
| `game-rpg-anime` | RPG visual novel + anime countryside bg |
| `game-rpg-forest` | RPG visual novel + night forest bg |

### Text Reveal Styles

| ID | Effect |
|----|--------|
| `sentence` | Lines fade/slide up one by one |
| `word` | Words pop in with scale |
| `typewriter` | Char-by-char with caret |
| `char-pop` | Each character springs in with rotation |
| `slide-left` | Words slide in from left |
| `karaoke` | Active word highlighted, rest dimmed |
| `glitch` | RGB chromatic aberration split |
| `blur-in` | Blur-to-sharp focus reveal |

---

## Characters

**File:** [`local-video-generator/src/characters.ts`](../local-video-generator/src/characters.ts)

| ID | Type | Description |
|----|------|-------------|
| `narrator` | SVG | Calm, authoritative storyteller |
| `professor` | SVG | Intellectual, explanatory |
| `hacker` | SVG | Fast, cyberpunk energetic |
| `analyst` | SVG | Data-driven, precise |
| `creative` | SVG | Enthusiastic, warm |
| `executive` | SVG | Confident, business |
| `pixel-user` | Sprite | 8-bit retro pixel art (you) |
| `anime-vtuber` | Sprite | 2D anime VTuber, Demon Slayer style |

### Sprite Files (in `local-video-generator/public/`)

| File | Pose |
|------|------|
| `pixel_user_spritesheet.png` | Pixel user — neutral + talking |
| `pixel_user_spritesheet_pointing.png` | Pixel user — pointing |
| `pixel_user_spritesheet_thinking.png` | Pixel user — thinking |
| `pixel_user_spritesheet_excited.png` | Pixel user — excited |
| `anime_user_spritesheet.png` | Anime VTuber — neutral + talking |
| `anime_user_spritesheet_pointing.png` | Anime VTuber — pointing |
| `anime_user_spritesheet_thinking.png` | Anime VTuber — thinking |
| `anime_user_spritesheet_excited.png` | Anime VTuber — excited |

Each spritesheet is a **2×1 grid**: left cell = idle, right cell = talking. The renderer toggles between left/right every 8 frames when audio volume exceeds threshold.

### VTuber Layout (RPG mode)
The anime-vtuber renders as a **480×480px framed portrait** anchored at the **bottom-left**, above the dialog box. The speaker name tag appears on the **right side** to avoid overlap.

---

## Scene Editor (UI)

After generation, the frontend displays a **Cinematic Scene Script Editor** where you can:
- Edit on-screen text, voice narration, duration, emphasis, and visual direction per scene
- Reorder scenes (▲ ▼) or delete scenes
- When lip-sync is enabled: change per-scene `characterId`, `bodyPose`, `expression`
- Click **Save & Re-render** to regenerate the video from the edited scenes (skips the LLM step)

---

## Directory Structure

```
SignalStack/
├── frontend/
│   ├── src/app/
│   │   ├── generate-video/page.tsx      # Main UI
│   │   └── api/
│   │       ├── generate-video/route.ts  # Pipeline orchestrator
│   │       ├── test-voice/route.ts      # Voice preview
│   │       ├── ambient-audio/route.ts   # Ambient audio preview
│   │       ├── save-video/route.ts      # Copy to local folder
│   │       └── videos/route.ts          # Gallery listing
│   └── public/videos/                   # Generated MP4s served statically
│
└── local-video-generator/
    ├── src/
    │   ├── PulseVideo.tsx               # Main Remotion composition
    │   ├── LipSyncCharacter.tsx         # SVG character + lip sync
    │   ├── PixelCharacter.tsx           # Sprite-based character
    │   ├── GameDialogBox.tsx            # RPG dialog box UI
    │   ├── characters.ts                # Character definitions
    │   ├── useVisemeData.ts             # Viseme data hook
    │   └── viseme-shapes.ts             # Mouth shape SVG paths
    ├── generate_audio.py                # TTS synthesis (Edge/Kokoro)
    ├── generate_lipsync.py              # Rhubarb lip-sync wrapper
    ├── render.mjs                       # Remotion render script
    ├── public/                          # Static assets (audio, sprites, backgrounds)
    │   ├── scene_N.mp3                  # Generated per-scene audio (temp)
    │   ├── scene_N_visemes.json         # Rhubarb output (temp)
    │   ├── scene_images/                # RPG background images
    │   └── *.png                        # Character sprite sheets
    └── out/                             # Remotion render output MP4s
```

---

## Prerequisites

```bash
# Node / pnpm
node >= 18
pnpm install

# Python venv (in local-video-generator/)
python3 -m venv venv
source venv/bin/activate
pip install edge-tts

# Kokoro TTS (optional)
# Install into ~/miniconda3/envs/kokoro/
pip install kokoro soundfile
brew install espeak-ng

# Rhubarb Lip Sync (optional)
brew install rhubarb-lip-sync

# Local LLM server (required)
# Any OpenAI-compatible server on port 8081
# Recommended: mlx-lm with Qwen3.5-4B
pip install mlx-lm
mlx_lm.server --model ~/ai/models/mlx/Qwen3.5-4B-OptiQ-4bit --port 8081

# FFmpeg (required for lip-sync mp3→wav conversion)
brew install ffmpeg
```

---

## Running

```bash
# Start the frontend (includes the video generation API)
cd frontend
pnpm dev

# Access the generator at:
http://localhost:3000/generate-video
```

> **Note:** The `/api/generate-video` endpoint is disabled in production (`NODE_ENV === "production"`). It is development-only.
