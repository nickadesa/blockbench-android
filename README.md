# Blockbench Android

A standalone Android port and native mobile enhancement suite for **Blockbench** (the low-poly 3D model editor).

## Download

Download the latest APK directly from GitHub Releases:
- [Latest Release](https://github.com/nickadesa/blockbench-android/releases/latest)
- File: `blockbench-android.apk`

---

## Key Features

### 1. Full Offline Standalone Bundle
* The complete Blockbench 3D engine, Three.js runtime, Vue components, and shaders are bundled directly within the APK.
* Works 100% offline without requiring internet access or web browser tabs.
* Auto-rotate enabled: supports both landscape and portrait orientations.

### 2. Top-Right Fullscreen Toggle
* Quick-access square button `[ + ]` fixed at the top-right corner.
* Toggles Android Immersive Sticky Mode, completely hiding the Android status bar and navigation gestures for maximum 3D workspace.

### 3. Performance Settings
Access via **Preferences > Settings > Performance** or the Quick Settings gear button:
* **FPS Limiter:** 30 FPS (Battery Saver), 60 FPS (Balanced), 90 FPS (Smooth), 120 FPS (Ultra), or Uncapped.
* **Resolution Scale:** 50%, 75%, or 100% canvas resolution scaling.
* **Anti-Aliasing:** Toggle MSAA on/off.
* **On-Screen FPS Counter:** Displays real-time frame rate metrics in the top-left corner.

### 4. Virtual Mouse & Keyboard Overlay
* **Floating Toolbar:** Draggable anywhere on the screen and collapsible into a floating badge.
* **Mouse Buttons:** Left Click (LMB), Right Click (RMB), Middle Click / Pan (MMB).
* **Zoom Scroll Strip:** Smooth vertical touch strip for precision 3D viewport zooming.
* **Sticky Modifier Keys:** `CTRL`, `ALT`, `SHIFT`, `SPACE` (tap once to latch active without holding).
* **Precision D-Pad:** Stepper arrow buttons for micro-adjustments of cube position, rotation, and size.
* **Dual Touch Modes:**
  * **Direct Touch:** Standard touch interaction for menus and buttons.
  * **Virtual Touchpad:** Uses the screen as a touchpad to steer the virtual pointer.

### 5. Five Cursor Templates
Select your preferred pointer style in Mobile Settings:
1. **Classic White:** High-visibility white pointer with dark outline.
2. **Modern Black:** Crisp black pointer with white outline.
3. **macOS Black:** Apple-style curved black pointer with subtle shadow.
4. **Customizable Color:** Tint your pointer with any custom color using the built-in color picker.
5. **Custom (URL):** Load any `.cur` or `.png` pointer from an external link or local file.
* Adjustable cursor size (16px to 48px) and touch sensitivity speed (0.5x to 2.5x).

### 6. Mobile UX Enhancements
* **Multi-Touch Gestures:**
  * Two-finger tap: Undo.
  * Three-finger tap: Redo.
* **Dynamic UI Scaling:** Zoom UI between 75% and 125% to fit screen size and finger reach.
* **Toggleable Haptic Feedback:** Tactile vibration on clicks, modifier toggles, and grid snapping (can be toggled on/off in settings).
* **Camera Snap Widget:** Fast view switching between ISO, TOP, FRONT, and RIGHT angles.
* **Aggressive Local Auto-Save:** Automatically snapshots project data locally every 2 minutes.

### 7. Custom App Icon
* The official Blockbench chair icon customized with small black "DAVINICK" lettering inside the chair graphic.

---

## Installation Guide

1. Download `blockbench-android.apk` from the [Releases](https://github.com/nickadesa/blockbench-android/releases) page.
2. Open the downloaded file on your Android device.
3. If prompted, allow "Install unknown apps" from your browser or file manager.
4. Tap Install and launch Blockbench from your app drawer.

---

## Building from Source

Requirements:
- Android SDK (API 34)
- JDK 17+

Run:
```bash
./gradlew assembleRelease
```
The output APK will be located at:
`app/build/outputs/apk/release/app-release.apk`

---

## License

Blockbench is open source under the GPL-3.0 License.
Mobile wrapper and controller extensions by DAVINICK.
