# Blockbench Mod Mobile (blockbenchmod)

<p align="center">
  <img src="app/src/main/assets/icon.png" width="108" height="108" alt="Blockbench Mod Mobile Icon" />
</p>

<p align="center">
  <strong>High-performance, standalone mobile port and touch enhancement suite for low-poly 3D modeling</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/nickadesa/blockbench-android/releases/tag/v1.2.2"><img src="https://img.shields.io/badge/Release-v1.2.2-brightgreen.svg" alt="Release v1.2.2" /></a>
  <a href="#platform-support"><img src="https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20(Source)-orange.svg" alt="Platform" /></a>
  <a href="#performance--display-synchronization"><img src="https://img.shields.io/badge/Display-120Hz%20Synchronized-blueviolet.svg" alt="120Hz Display" /></a>
  <a href="#offline-standalone-architecture"><img src="https://img.shields.io/badge/Offline-100%25%20On--Device-success.svg" alt="Offline" /></a>
</p>

---

## Overview

**Blockbench Mod Mobile** (blockbenchmod) is a specialized, open-source mobile port and controller augmentation designed for creating low-poly 3D models, Minecraft entity textures, and voxel animations on touchscreen devices.

Unlike web versions or basic wrappers, this project delivers a fully standalone, offline native client with hardware-accelerated 120Hz display refresh rate synchronization, a fixed-position floating touch controller with customizable coordinate layouts, deep modifier key synchronization (CTRL, SHIFT, ALT), and an unblocked native interface.

---

## Downloads

Download the latest verified release from the official repository:

* **Android Package (APK):** [blockbench-android.apk (v1.2.2)](https://github.com/nickadesa/blockbench-android/releases/download/v1.2.2/blockbench-android.apk)
* **iOS Project Source:** [BlockbenchModMobile-iOS-Source.zip (v1.2.2)](https://github.com/nickadesa/blockbench-android/releases/download/v1.2.2/BlockbenchModMobile-iOS-Source.zip)
* **Release Page:** [GitHub Release v1.2.2](https://github.com/nickadesa/blockbench-android/releases/tag/v1.2.2)

---

## Core Capabilities and Features

### 1. Offline Standalone Architecture
* **Zero Internet Dependency:** The complete 3D modeling engine, Three.js runtime, Vue framework, shaders, materials, fonts, and language packs are bundled locally on-device.
* **Storage Independence:** Models, textures, and palettes are saved directly to device storage without requiring external servers or remote accounts.
* **Auto-Rotation Support:** Seamless workflow transition between landscape and portrait orientations.

### 2. High Refresh Rate Display Engine (120Hz)
* **Hardware Mode Synchronization:** Matches native Android WindowManager display modes with physical display capabilities (up to 120Hz).
* **Smooth 3D Viewport Interaction:** Eliminates input latency during mesh rotation, vertex manipulation, and bone rigging.
* **Target Frame Rate Control:** Configurable frame rates: 60 FPS (Balanced), 90 FPS (Smooth), 120 FPS (Ultra), or Uncapped.
* **Realtime FPS Counter:** Lightweight top-left HUD monitor displaying active frame rate and rendering performance.

### 3. Precision Floating Touch Controller
* **Fixed Position by Default:** Controller buttons remain strictly anchored in place during modeling, preventing accidental dragging.
* **Custom Layout Editor:** Switch into Edit Layout mode to drag buttons to any position on the screen with permanent local coordinate persistence.
* **Ergonomic Presets:** One-tap presets including Split Hands, Dock Right, Dock Left, and Default Reset.
* **Controller Buttons:**
  * **LMB (Left Mouse Button):** Element selection, mesh manipulation, and paint strokes.
  * **RMB (Right Mouse Button):** 3D rotation and context menus.
  * **MMB (Middle Mouse Button):** Direct 3D camera pan.
  * **Action Keys:** SPACE (pan/play), UNDO, REDO, and DELETE.

### 4. Working Modifier Keys with High-Visibility Indicators
* **Solid Green Active State:** Tapping CTRL, SHIFT, or ALT toggles them into an unmistakable solid green state (#2ecc71) with an explicit [ON] badge indicator.
* **Deep Event Capture Interceptor:** Captures pointer and touch events across the window hierarchy to ensure ctrlKey, shiftKey, altKey, and ctrlOrCmd are active on every 3D interaction.
* **Three.js & OrbitControls Sync:** Enables multi-selection in the outliner tree, uniform transform scaling, 3D panning, and axis-constrained rotation.

### 5. Streamlined Header (Zero Button Overlap)
* **Dedicated Mobile Settings Gear:** Header tools are streamlined to a single compact gear button docked at the far right.
* **Unblocked Native Navigation:** Eliminates header clutter, guaranteeing that all official Blockbench tools (Mode Switcher for Edit/Paint/Animate, Menu, Search, Undo, Redo) are 100% visible and accessible without overlap or clipping.
* **Consolidated Settings Modal:** One-stop configuration for Fullscreen, FPS overlay, Refresh Rate, Button Visibility, Haptic Vibration, and UI Scaling (75% to 130%).

---

## Installation

### Android
1. Download `blockbench-android.apk` from the [Latest Release](https://github.com/nickadesa/blockbench-android/releases/tag/v1.2.2).
2. Open the file on your Android device and allow installation from your browser or file manager if prompted.
3. Launch **Blockbench Mod Mobile** from your application drawer.

### iOS
1. Download `BlockbenchModMobile-iOS-Source.zip`.
2. Extract the archive and open the project in Xcode on macOS.
3. Build and deploy to your iOS device, or install via Safari as a Progressive Web App (PWA) using "Add to Home Screen".

---

## Building from Source

### Prerequisites
* Android SDK (API Level 34)
* Java Development Kit (JDK 17 or higher)

### Build Commands
```bash
# Clone the repository
git clone https://github.com/nickadesa/blockbench-android.git blockbenchmod
cd blockbenchmod

# Build signed release APK
./gradlew assembleRelease
```
The compiled APK will be generated at:
`app/build/outputs/apk/release/app-release.apk`

---

## Legal Disclaimer & Trademark Notice

### 1. Independence and Non-Affiliation
Blockbench Mod Mobile (blockbenchmod) is an independent, community-driven open-source modification and native mobile packaging project created by DAVINICK. This project is **NOT affiliated with, authorized by, sponsored by, or endorsed by Jannis Brinkmann, the official Blockbench development team, Mojang Synergies AB, Microsoft Corporation, or any of their affiliates or subsidiaries**.

### 2. Trademark Attribution
* **Blockbench** is a trademark of Jannis Brinkmann.
* **Minecraft** is a trademark of Mojang Synergies AB and Microsoft Corporation.
* All other trademarks, registered trademarks, product names, and company names or logos mentioned in this repository are the property of their respective owners.
* Reference to any specific commercial products, processes, or services by trade name, trademark, or manufacturer does not constitute or imply endorsement, sponsorship, or recommendation.

### 3. Open-Source Licenses
* Core Blockbench web editor components remain subject to their original upstream open-source license (**GPL-3.0**).
* The custom Android native wrapper, touch controller engine, layout manager, and mobile extensions developed in this repository are licensed under the **MIT License**. See [LICENSE](LICENSE) for full details.

### 4. Warranty Disclaimer
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
