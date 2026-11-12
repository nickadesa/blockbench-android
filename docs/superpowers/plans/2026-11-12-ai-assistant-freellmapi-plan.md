# AI 3D Modeling Assistant with FreeLLMAPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native in-app AI Assistant for Blockbench Android capable of automated 3D voxel modeling, pixel texture painting, rigging, and animation generation via Bring-Your-Own-Key (BYOK), supporting up to 5 reference images, slash commands (/plan, /grillme, /model, /texture, /animate), multi-provider routing (FreeLLMAPI, Google Gemini, OpenRouter, Groq, OpenAI), and a client-side MCP-like tool execution engine.

**Architecture:** A lightweight slide-over mobile drawer UI linked to an LLM provider client supporting both OpenAI-compatible endpoints (/v1/chat/completions) for FreeLLMAPI/OpenRouter/Groq and native Google Gemini REST API endpoints. The engine dispatches structured Function Calls (tools) directly into the Blockbench core JavaScript API (Cube, Group, Texture, Animation, Keyframe, Undo) within transactional Undo edits.

**Tech Stack:** JavaScript (ES6+), HTML5 Canvas, Blockbench JavaScript API, Android WebView Fetch API, FreeLLMAPI OpenAI-compatible REST API, Google Gemini REST API.

**Spec:** In-App AI Assistant Spec based on FreeLLMAPI (https://github.com/tashfeenahmed/freellmapi) multi-provider architecture, BYOK local storage, 5-image multimodal processing, slash command routing, and MCP-like function execution.

## Global Constraints

- Strictly NO EMOJIS anywhere (in UI labels, code, commit messages, release notes, or chat messages).
- Strictly do NOT use any third-party app branding anywhere in code, comments, classes, IDs, or text.
- 100% Client-Side BYOK (Bring Your Own Key): All API keys stored exclusively on-device in localStorage.
- Multimodal Vision: Support up to 5 reference images simultaneously (downscaled and Base64 encoded).
- Transactional Safety: Every AI generation action must be wrapped in Undo.initEdit() and Undo.finishEdit() for instant 2-finger tap rollback.

## Review Focus

1. Image payload size: Ensure 5 uploaded images do not exceed Android WebView memory or API payload limits (automatic downscale to max 1024x1024 jpeg/png).
2. Function calling reliability: Models that return malformed JSON or markdown codeblocks instead of structured tool calls must have robust fallback extraction.
3. Coordinate boundary safety: Prevent AI from creating cubes with negative dimensions or inverted coordinate spaces (auto-normalize from/to coordinates).
4. API Key security: Ensure API keys are never leaked to error logs or external telemetry.
5. Concurrent requests: Block duplicate API submissions while a generation stream/tool call cycle is in progress.

---

### Task 1: AI Provider Client Layer (OpenAI-Compatible & Gemini API)

**Files:**
- Create: `app/src/main/assets/ai/ai-provider.js`
- Test: Manual node syntax verification and integration test suite

**Interfaces:**
- Consumes: User API credentials and model configuration from `localStorage`.
- Produces: `AIProvider.sendChat({ messages, images, tools, onChunk, onToolCall }) -> Promise<AIResponse>`

- [ ] **Step 1: Define Provider Schemas & Endpoint Resolvers**
  Implement endpoint resolvers for:
  - FreeLLMAPI / Local Relay: Default `http://localhost:3001/v1/chat/completions` or custom user URL.
  - OpenRouter: `https://openrouter.ai/api/v1/chat/completions`.
  - Groq: `https://api.groq.com/openai/v1/chat/completions`.
  - OpenAI: `https://api.openai.com/v1/chat/completions`.
  - Google Gemini: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}`.

- [ ] **Step 2: Implement Multimodal Payload Formatter (Up to 5 Images)**
  Format up to 5 Base64 images:
  - For OpenAI-compatible endpoints: Append `{ type: "image_url", image_url: { url: "data:image/png;base64,..." } }` to user message content array.
  - For Gemini endpoints: Append `{ inlineData: { mimeType: "image/png", data: "..." } }` to parts array.

- [ ] **Step 3: Implement Tool Definitions for 3D Modeling (MCP Function Declarations)**
  Define JSON schemas for tools:
  - `create_cubes({ cubes: [{ name, from: [x,y,z], to: [x,y,z], color: int, parent: string }] })`
  - `create_groups({ groups: [{ name, origin: [x,y,z], parent: string }] })`
  - `paint_texture({ texture_name, width, height, pixels: [{ x, y, color: hex }] })`
  - `create_animation({ name, length, fps, loop, keyframes: [...] })`
  - `inspect_scene()`: Returns current outliner tree and texture list.
  - `execute_script({ code })`: Fallback for complex procedural generation.

- [ ] **Step 4: Verify syntax and payload generator**
  Run: `node -c app/src/main/assets/ai/ai-provider.js`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add app/src/main/assets/ai/ai-provider.js
  git commit -m "feat(ai): add multi-provider client supporting FreeLLMAPI, Gemini, and tool declarations"
  ```

---

### Task 2: Blockbench MCP-like Tool Execution Engine

**Files:**
- Create: `app/src/main/assets/ai/ai-tools.js`
- Test: In-browser / WebView execution against live Blockbench objects

**Interfaces:**
- Consumes: Tool calls returned by the AI provider.
- Produces: `AITools.execute(toolName, args) -> { success: boolean, result: any, error?: string }`

- [ ] **Step 1: Implement `create_cubes` & `create_groups` Executor**
  - Open `Undo.initEdit({ outliner: true, elements: [] })`.
  - Validate and normalize coordinate bounds: `from = [min(x1,x2), min(y1,y2), min(z1,z2)]`, `to = [max(x1,x2), max(y1,y2), max(z1,z2)]`.
  - Instantiate `new Cube(...)` and assign to specified parent group or root.
  - Call `Canvas.updateView({ elements: createdCubes })`.
  - Finish edit: `Undo.finishEdit('AI Create 3D Cubes')`.

- [ ] **Step 2: Implement `paint_texture` Executor**
  - Locate active texture or create new `new Texture({ name: texture_name, width, height })`.
  - Access 2D canvas context: `ctx = texture.img.getContext('2d')`.
  - Apply pixel modifications: `ctx.fillStyle = pixel.color; ctx.fillRect(pixel.x, pixel.y, 1, 1)`.
  - Call `texture.updateSource()` and `Canvas.updateAllFaces()`.
  - Finish edit: `Undo.finishEdit('AI Texture Paint')`.

- [ ] **Step 3: Implement `create_animation` Executor**
  - Create `new Animation({ name, length, looping: loop ? 'loop' : 'once' })`.
  - For each bone/group keyframe: create keyframe at timestamp with rotation/position Euler vectors.
  - Add to `Project.animations`.
  - Finish edit: `Undo.finishEdit('AI Generate Animation')`.

- [ ] **Step 4: Implement `inspect_scene` Helper**
  - Extract list of all cubes, groups, origins, and texture resolution in compact JSON format.
  - Return as tool output so AI can incrementally refine models.

- [ ] **Step 5: Verify syntax**
  Run: `node -c app/src/main/assets/ai/ai-tools.js`
  Expected: PASS

- [ ] **Step 6: Commit**
  ```bash
  git add app/src/main/assets/ai/ai-tools.js
  git commit -m "feat(ai): implement Blockbench MCP tool execution engine with Undo support"
  ```

---

### Task 3: Slash Command Router & System Prompt Orchestrator

**Files:**
- Create: `app/src/main/assets/ai/ai-commands.js`
- Test: Command parsing unit tests

**Interfaces:**
- Consumes: Raw user input string and optional image attachments.
- Produces: `AICommands.parseAndExecute(input, images) -> Promise<void>`

- [ ] **Step 1: Implement Command Parser**
  Recognize:
  - `/plan [prompt]`: Activates Architecture & Planning Mode. AI analyzes images and outputs voxel hierarchy, palette recommendations, and step-by-step assembly strategy.
  - `/grillme [prompt]`: Activates Interactive Interview Mode. AI probes for polycount budget, Minecraft version target (Bedrock/Java), animation rig requirements, and texture resolution before building.
  - `/model [prompt]`: Activates 3D Voxel Generator. Directly executes `create_cubes` and `create_groups`.
  - `/texture [prompt]` or `/pixelart`: Activates Texture Painting. Directly executes `paint_texture`.
  - `/animate [prompt]`: Activates Animation Generator. Directly executes `create_animation`.
  - `/clear`: Clears chat history from memory and UI.
  - `/help`: Displays formatted reference list of all available commands.

- [ ] **Step 2: Build Specialized System Prompts**
  Craft precise system instructions enforcing:
  - Minecraft / Blockbench coordinate conventions (16 units = 1 block, Y is up).
  - Clean parent-child hierarchies (e.g., `body` -> `head`, `arm_left`, `arm_right`, `leg_left`, `leg_right`).
  - Strict tool output schemas.

- [ ] **Step 3: Verify syntax**
  Run: `node -c app/src/main/assets/ai/ai-commands.js`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add app/src/main/assets/ai/ai-commands.js
  git commit -m "feat(ai): add slash command router and specialized prompt orchestrator"
  ```

---

### Task 4: Mobile AI Assistant Drawer UI

**Files:**
- Create: `app/src/main/assets/ai/ai-drawer.css`
- Create: `app/src/main/assets/ai/ai-drawer.js`
- Modify: `app/src/main/assets/index.html`

**Interfaces:**
- Consumes: User interactions, image picker events, and chat submissions.
- Produces: Rendered slide-over drawer, image preview carousel, message log, and tool execution status badges.

- [ ] **Step 1: Design Slide-Over Drawer Container**
  - Create `#ai-assistant-drawer` positioned on the right edge (`width: 360px; max-width: 90vw; height: 100vh;`).
  - Slide in/out transition with backdrop scrim.
  - Add Header button `#btn_native_ai_assistant` in `#native_header_mobile_tools` (clean SVG robot / neural icon).

- [ ] **Step 2: Implement 5-Image Reference Upload Carousel**
  - Add `#ai-image-upload-strip` with button `+ Add Image (Max 5)`.
  - Display thumbnails of uploaded images with individual `[x]` remove buttons.
  - Compress/downscale large images on-device using hidden `<canvas>` to ensure memory safety.

- [ ] **Step 3: Implement Provider & Model Selector Dropdowns**
  - Provider selector: `FreeLLMAPI (Custom / Local)`, `Google Gemini`, `OpenRouter`, `Groq`, `OpenAI`.
  - Model selector: dynamic or custom text input (e.g. `gemini-2.0-flash`, `gpt-4o`, `deepseek-chat`, `claude-3-5-sonnet`).
  - API Key input field (masked password type) stored locally in `localStorage`.

- [ ] **Step 4: Implement Chat Timeline & Quick Command Pills**
  - Message bubble list supporting user prompts, AI text responses, and tool execution progress chips (e.g. `[Created 14 Cubes]`, `[Painted 64 Pixels]`).
  - Command quick-tap chips above input field: `[/plan]`, `[/grillme]`, `[/model]`, `[/texture]`, `[/animate]`.

- [ ] **Step 5: Verify syntax and integration**
  Run: `node -c app/src/main/assets/ai/ai-drawer.js`
  Expected: PASS

- [ ] **Step 6: Commit**
  ```bash
  git add app/src/main/assets/ai/
  git commit -m "feat(ai): implement slide-over AI assistant drawer UI with 5-image upload carousel"
  ```

---

### Task 5: End-to-End Integration & APK Release

**Files:**
- Modify: `app/build.gradle` (bump versionCode and versionName)
- Test: Full APK build and verification via GitHub Actions

- [ ] **Step 1: Link all AI script assets in `index.html`**
- [ ] **Step 2: Bump version in `app/build.gradle`**
- [ ] **Step 3: Verify syntax across all modified files**
- [ ] **Step 4: Commit and push tag to trigger GitHub Actions build**
- [ ] **Step 5: Verify APK build in release assets**
