/**
 * Mobile Controls, Performance Tuning & Virtual Mouse Extension for Blockbench
 * Created for Blockbench Android
 * Note: Strictly no emojis as requested.
 */

(function () {
	'use strict';

	// Storage key for settings
	const STORAGE_KEY = 'mb_controls_settings';

	// Default Configuration
	const config = {
		fpsLimit: 60, // 30, 60, 90, 120, 'uncapped'
		resolutionScale: 1.0, // 0.5, 0.75, 1.0
		antiAliasing: true,
		showFps: true,
		haptics: true,
		uiScale: 100, // 75% to 125%
		touchMode: 'direct', // 'direct' or 'touchpad'
		cursorTemplate: 'classic_white', // classic_white, modern_black, macos_black, color_tint, custom
		cursorColor: '#3e90ff',
		customCursorUrl: '',
		cursorSize: 24,
		cursorSpeed: 1.2,
		floatingBarOpacity: 92,
		dpadVisible: false,
		autoSaveMinutes: 2
	};

	// Load stored configuration
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			Object.assign(config, JSON.parse(stored));
		}
	} catch (e) {
		console.warn('Could not load mobile controls settings', e);
	}

	function saveConfig() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
		} catch (e) {}
	}

	// Haptic Feedback Helper
	function triggerHaptic(duration = 14) {
		if (!config.haptics) return;
		try {
			if (window.AndroidBridge && window.AndroidBridge.vibrate) {
				window.AndroidBridge.vibrate(duration);
			} else if (navigator.vibrate) {
				navigator.vibrate(duration);
			}
		} catch (e) {}
	}

	// -------------------------------------------------------------
	// 1. Performance Engine (FPS Throttling & Resolution Scale)
	// -------------------------------------------------------------
	let realFps = 60;
	let frameCount = 0;
	let lastFpsUpdate = performance.now();

	const originalRAF = window.requestAnimationFrame.bind(window);
	let lastFrameTime = performance.now();

	window.requestAnimationFrame = function (callback) {
		if (config.fpsLimit === 'uncapped' || !config.fpsLimit) {
			return originalRAF((timestamp) => {
				updateFpsMetrics(timestamp);
				callback(timestamp);
			});
		}

		const targetInterval = 1000 / Number(config.fpsLimit);
		return originalRAF(function tick(timestamp) {
			const elapsed = timestamp - lastFrameTime;
			if (elapsed >= targetInterval - 1.5) {
				lastFrameTime = timestamp - (elapsed % targetInterval);
				updateFpsMetrics(timestamp);
				callback(timestamp);
			} else {
				originalRAF(tick);
			}
		});
	};

	function updateFpsMetrics(now) {
		frameCount++;
		if (now - lastFpsUpdate >= 1000) {
			realFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
			frameCount = 0;
			lastFpsUpdate = now;
			const fpsEl = document.getElementById('mb-fps-counter');
			if (fpsEl && config.showFps) {
				fpsEl.textContent = `FPS: ${realFps} / ${config.fpsLimit}`;
			}
		}
	}

	function applyResolutionScale() {
		const canvases = document.querySelectorAll('canvas');
		canvases.forEach((canvas) => {
			if (canvas.__renderer) {
				try {
					canvas.__renderer.setPixelRatio(window.devicePixelRatio * config.resolutionScale);
				} catch (e) {}
			}
		});
	}

	// -------------------------------------------------------------
	// 2. Cursor Templates & Virtual Mouse
	// -------------------------------------------------------------
	const cursorSVGs = {
		classic_white: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M0,0 L0,24 L6.5,18 L12,28 L16,26 L10.5,16 L18.5,16 Z" fill="%23ffffff" stroke="%23000000" stroke-width="2" stroke-linejoin="round"/></svg>`,
		modern_black: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M0,0 L0,24 L6.5,18 L12,28 L16,26 L10.5,16 L18.5,16 Z" fill="%231a1a1a" stroke="%23ffffff" stroke-width="2" stroke-linejoin="round"/></svg>`,
		macos_black: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M5,2 L5,23.5 L10.5,18 L16,28 L19,26.5 L13.5,16.5 L21,16.5 Z" fill="%23111111" stroke="%23ffffff" stroke-width="2" stroke-linejoin="round"/></svg>`,
		color_tint: (color) => `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M0,0 L0,24 L6.5,18 L12,28 L16,26 L10.5,16 L18.5,16 Z" fill="${encodeURIComponent(color)}" stroke="%23ffffff" stroke-width="2" stroke-linejoin="round"/></svg>`
	};

	let cursorX = window.innerWidth / 2;
	let cursorY = window.innerHeight / 2;
	const modifiers = { ctrl: false, alt: false, shift: false, space: false };

	function getActiveCursorUrl() {
		if (config.cursorTemplate === 'custom' && config.customCursorUrl) {
			return config.customCursorUrl;
		}
		if (config.cursorTemplate === 'color_tint') {
			return cursorSVGs.color_tint(config.cursorColor || '#3e90ff');
		}
		return cursorSVGs[config.cursorTemplate] || cursorSVGs.classic_white;
	}

	function updateVirtualCursorElement() {
		const cursorEl = document.getElementById('mb-virtual-cursor');
		if (!cursorEl) return;
		cursorEl.style.width = `${config.cursorSize}px`;
		cursorEl.style.height = `${config.cursorSize}px`;
		cursorEl.style.backgroundImage = `url("${getActiveCursorUrl()}")`;
		cursorEl.style.backgroundSize = 'contain';
		cursorEl.style.backgroundRepeat = 'no-repeat';
		cursorEl.style.display = config.touchMode === 'touchpad' ? 'block' : 'none';
	}

	function setCursorPosition(x, y) {
		cursorX = Math.max(0, Math.min(window.innerWidth - 1, x));
		cursorY = Math.max(0, Math.min(window.innerHeight - 1, y));
		const cursorEl = document.getElementById('mb-virtual-cursor');
		if (cursorEl) {
			cursorEl.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
		}
	}

	// Dispatch simulated mouse events to underlying element
	function dispatchMouseEvent(type, button = 0) {
		triggerHaptic(18);
		const target = document.elementFromPoint(cursorX, cursorY) || document.body;
		const event = new MouseEvent(type, {
			view: window,
			bubbles: true,
			cancelable: true,
			clientX: cursorX,
			clientY: cursorY,
			button: button,
			buttons: type === 'mouseup' ? 0 : button === 0 ? 1 : button === 2 ? 2 : 4,
			ctrlKey: modifiers.ctrl,
			altKey: modifiers.alt,
			shiftKey: modifiers.shift
		});
		target.dispatchEvent(event);
	}

	// -------------------------------------------------------------
	// 3. Multi-Touch Gestures (2-finger Undo, 3-finger Redo)
	// -------------------------------------------------------------
	let touchStartCount = 0;
	let touchStartTime = 0;

	window.addEventListener('touchstart', (e) => {
		touchStartCount = e.touches.length;
		touchStartTime = performance.now();
	}, { passive: true });

	window.addEventListener('touchend', (e) => {
		const duration = performance.now() - touchStartTime;
		// Quick tap under 300ms
		if (duration < 300) {
			if (touchStartCount === 2) {
				// 2 Finger Tap = Undo
				triggerHaptic(25);
				if (window.Undo && window.Undo.undo) {
					window.Undo.undo();
				} else {
					document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
				}
			} else if (touchStartCount === 3) {
				// 3 Finger Tap = Redo
				triggerHaptic(25);
				if (window.Undo && window.Undo.redo) {
					window.Undo.redo();
				} else {
					document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }));
				}
			}
		}
		touchStartCount = 0;
	}, { passive: true });

	// -------------------------------------------------------------
	// 4. UI Construction & Event Handlers
	// -------------------------------------------------------------
	function initMobileUI() {
		// Top-Right Fullscreen Toggle Square Button
		const fsBtn = document.createElement('div');
		fsBtn.id = 'fullscreen-toggle-btn';
		fsBtn.title = 'Toggle Fullscreen';
		fsBtn.innerHTML = `[ + ]`;
		fsBtn.addEventListener('click', toggleFullscreen);
		document.body.appendChild(fsBtn);

		// Realtime FPS Counter
		const fpsCounter = document.createElement('div');
		fpsCounter.id = 'mb-fps-counter';
		fpsCounter.textContent = 'FPS: 60';
		if (config.showFps) fpsCounter.style.display = 'block';
		document.body.appendChild(fpsCounter);

		// Camera Snap Widget
		const camWidget = document.createElement('div');
		camWidget.id = 'mb-camera-snap';
		const views = [
			{ id: 'iso', label: 'ISO' },
			{ id: 'top', label: 'TOP' },
			{ id: 'front', label: 'FRT' },
			{ id: 'right', label: 'RGT' }
		];
		views.forEach((v) => {
			const b = document.createElement('div');
			b.className = 'mb-cam-btn';
			b.textContent = v.label;
			b.addEventListener('click', () => {
				triggerHaptic(12);
				snapCamera(v.id);
			});
			camWidget.appendChild(b);
		});
		document.body.appendChild(camWidget);

		// Virtual Cursor Element
		const cursorEl = document.createElement('div');
		cursorEl.id = 'mb-virtual-cursor';
		document.body.appendChild(cursorEl);
		setCursorPosition(cursorX, cursorY);
		updateVirtualCursorElement();

		// Virtual Touchpad Overlay (active in touchpad mode)
		const touchpadOverlay = document.createElement('div');
		touchpadOverlay.id = 'mb-touchpad-overlay';
		let lastTouchX = 0, lastTouchY = 0;
		touchpadOverlay.addEventListener('touchstart', (e) => {
			if (e.touches.length === 1) {
				lastTouchX = e.touches[0].clientX;
				lastTouchY = e.touches[0].clientY;
			}
		}, { passive: true });
		touchpadOverlay.addEventListener('touchmove', (e) => {
			if (e.touches.length === 1) {
				const dx = (e.touches[0].clientX - lastTouchX) * config.cursorSpeed;
				const dy = (e.touches[0].clientY - lastTouchY) * config.cursorSpeed;
				setCursorPosition(cursorX + dx, cursorY + dy);
				lastTouchX = e.touches[0].clientX;
				lastTouchY = e.touches[0].clientY;
			}
		}, { passive: true });
		document.body.appendChild(touchpadOverlay);

		// Floating Toolbar Container
		const bar = document.createElement('div');
		bar.id = 'mb-floating-bar';
		bar.style.background = `rgba(28, 32, 38, ${config.floatingBarOpacity / 100})`;

		// Drag Handle
		const dragHandle = document.createElement('div');
		dragHandle.id = 'mb-drag-handle';
		setupDragging(bar, dragHandle);
		bar.appendChild(dragHandle);

		// Row 1: Mouse Clicks + Mode + Hide
		const row1 = document.createElement('div');
		row1.className = 'mb-bar-row';

		const lmbBtn = createBtn('LMB', () => {
			dispatchMouseEvent('mousedown', 0);
			setTimeout(() => dispatchMouseEvent('mouseup', 0), 60);
			setTimeout(() => dispatchMouseEvent('click', 0), 70);
		});
		const rmbBtn = createBtn('RMB', () => {
			dispatchMouseEvent('mousedown', 2);
			setTimeout(() => dispatchMouseEvent('mouseup', 2), 60);
			setTimeout(() => dispatchMouseEvent('contextmenu', 2), 70);
		});
		const mmbBtn = createBtn('MMB', () => {
			dispatchMouseEvent('mousedown', 1);
			setTimeout(() => dispatchMouseEvent('mouseup', 1), 60);
		});
		const modeBtn = createBtn(config.touchMode === 'touchpad' ? 'PAD' : 'TOUCH', () => {
			config.touchMode = config.touchMode === 'touchpad' ? 'direct' : 'touchpad';
			modeBtn.textContent = config.touchMode === 'touchpad' ? 'PAD' : 'TOUCH';
			updateTouchMode();
			saveConfig();
		});
		const minBtn = createBtn('[ - ]', () => {
			bar.style.display = 'none';
			miniBubble.style.display = 'flex';
		});

		row1.appendChild(lmbBtn);
		row1.appendChild(rmbBtn);
		row1.appendChild(mmbBtn);
		row1.appendChild(modeBtn);
		row1.appendChild(minBtn);
		bar.appendChild(row1);

		// Row 2: Sticky Modifiers + Gear
		const row2 = document.createElement('div');
		row2.className = 'mb-bar-row';

		const ctrlBtn = createStickyBtn('CTRL', 'ctrl');
		const altBtn = createStickyBtn('ALT', 'alt');
		const shiftBtn = createStickyBtn('SHIFT', 'shift');
		const spaceBtn = createStickyBtn('SPACE', 'space');
		const gearBtn = createBtn('[ * ]', openSettingsModal);

		row2.appendChild(ctrlBtn);
		row2.appendChild(altBtn);
		row2.appendChild(shiftBtn);
		row2.appendChild(spaceBtn);
		row2.appendChild(gearBtn);
		bar.appendChild(row2);

		// Row 3: Zoom Scroll Strip & D-Pad Toggle
		const row3 = document.createElement('div');
		row3.className = 'mb-bar-row';

		const scrollStrip = document.createElement('div');
		scrollStrip.id = 'mb-scroll-strip';
		scrollStrip.innerHTML = '<span>+</span><span>ZOOM</span><span>-</span>';
		setupZoomScroll(scrollStrip);
		row3.appendChild(scrollStrip);

		const dpadToggleBtn = createBtn('D-PAD', () => {
			config.dpadVisible = !config.dpadVisible;
			dpadContainer.style.display = config.dpadVisible ? 'grid' : 'none';
			dpadToggleBtn.classList.toggle('active', config.dpadVisible);
			saveConfig();
		});
		row3.appendChild(dpadToggleBtn);

		bar.appendChild(row3);

		// Precision D-Pad Container
		const dpadContainer = document.createElement('div');
		dpadContainer.id = 'mb-dpad-container';
		if (config.dpadVisible) dpadContainer.style.display = 'grid';

		const dpadLayout = [
			{ k: '', l: '' },      { k: 'ArrowUp', l: '^' },    { k: '', l: '' },
			{ k: 'ArrowLeft', l: '<' }, { k: 'Enter', l: 'OK' },     { k: 'ArrowRight', l: '>' },
			{ k: '', l: '' },      { k: 'ArrowDown', l: 'v' },  { k: '', l: '' }
		];

		dpadLayout.forEach((d) => {
			if (d.k) {
				const db = document.createElement('div');
				db.className = 'mb-dpad-btn';
				db.textContent = d.l;
				db.addEventListener('click', () => {
					triggerHaptic(12);
					document.dispatchEvent(new KeyboardEvent('keydown', { key: d.k, bubbles: true }));
				});
				dpadContainer.appendChild(db);
			} else {
				dpadContainer.appendChild(document.createElement('div'));
			}
		});
		bar.appendChild(dpadContainer);

		document.body.appendChild(bar);

		// Collapsed Mini Bubble
		const miniBubble = document.createElement('div');
		miniBubble.id = 'mb-mini-bubble';
		miniBubble.textContent = 'CTRL';
		miniBubble.addEventListener('click', () => {
			triggerHaptic(15);
			miniBubble.style.display = 'none';
			bar.style.display = 'flex';
		});
		setupDragging(miniBubble, miniBubble);
		document.body.appendChild(miniBubble);

		// Quick Settings Modal
		createQuickSettingsModal();

		// Apply initial UI Scale
		applyUiScale();
	}

	function createBtn(text, onClick) {
		const b = document.createElement('div');
		b.className = 'mb-btn';
		b.textContent = text;
		b.addEventListener('click', () => {
			triggerHaptic(12);
			onClick();
		});
		return b;
	}

	function createStickyBtn(text, modifierKey) {
		const b = document.createElement('div');
		b.className = 'mb-btn';
		b.textContent = text;
		b.addEventListener('click', () => {
			modifiers[modifierKey] = !modifiers[modifierKey];
			b.classList.toggle('active', modifiers[modifierKey]);
			triggerHaptic(modifiers[modifierKey] ? 20 : 10);
		});
		return b;
	}

	function setupDragging(target, handle) {
		let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
		handle.addEventListener('touchstart', (e) => {
			if (e.touches.length === 1) {
				startX = e.touches[0].clientX;
				startY = e.touches[0].clientY;
				const rect = target.getBoundingClientRect();
				initialLeft = rect.left;
				initialTop = rect.top;
			}
		}, { passive: true });

		handle.addEventListener('touchmove', (e) => {
			if (e.touches.length === 1) {
				const dx = e.touches[0].clientX - startX;
				const dy = e.touches[0].clientY - startY;
				target.style.left = `${Math.max(4, Math.min(window.innerWidth - 60, initialLeft + dx))}px`;
				target.style.top = `${Math.max(4, Math.min(window.innerHeight - 60, initialTop + dy))}px`;
				target.style.bottom = 'auto';
			}
		}, { passive: true });
	}

	function setupZoomScroll(strip) {
		let startY = 0;
		strip.addEventListener('touchstart', (e) => {
			if (e.touches.length === 1) {
				startY = e.touches[0].clientY;
			}
		}, { passive: true });

		strip.addEventListener('touchmove', (e) => {
			if (e.touches.length === 1) {
				const dy = e.touches[0].clientY - startY;
				if (Math.abs(dy) > 10) {
					const delta = dy < 0 ? -120 : 120; // negative is zoom in
					const target = document.elementFromPoint(cursorX, cursorY) || document.body;
					target.dispatchEvent(new WheelEvent('wheel', {
						deltaY: delta,
						clientX: cursorX,
						clientY: cursorY,
						bubbles: true
					}));
					startY = e.touches[0].clientY;
					triggerHaptic(8);
				}
			}
		}, { passive: true });
	}

	function updateTouchMode() {
		const overlay = document.getElementById('mb-touchpad-overlay');
		const cursor = document.getElementById('mb-virtual-cursor');
		if (config.touchMode === 'touchpad') {
			if (overlay) overlay.style.display = 'block';
			if (cursor) cursor.style.display = 'block';
		} else {
			if (overlay) overlay.style.display = 'none';
			if (cursor) cursor.style.display = 'none';
		}
	}

	function applyUiScale() {
		document.body.style.zoom = `${config.uiScale}%`;
	}

	function snapCamera(viewId) {
		// Use Blockbench camera angles if available
		if (window.main_preview && window.main_preview.setCameraPosition) {
			const dist = 50;
			switch (viewId) {
				case 'top': main_preview.setCameraPosition([0, dist, 0]); break;
				case 'front': main_preview.setCameraPosition([0, 0, dist]); break;
				case 'right': main_preview.setCameraPosition([dist, 0, 0]); break;
				case 'iso': main_preview.setCameraPosition([dist * 0.7, dist * 0.7, dist * 0.7]); break;
			}
		}
	}

	function toggleFullscreen() {
		triggerHaptic(20);
		if (window.AndroidBridge && window.AndroidBridge.toggleFullscreen) {
			window.AndroidBridge.toggleFullscreen();
			return;
		}
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen?.().catch(() => {});
			document.getElementById('fullscreen-toggle-btn').innerHTML = '[ - ]';
		} else {
			document.exitFullscreen?.().catch(() => {});
			document.getElementById('fullscreen-toggle-btn').innerHTML = '[ + ]';
		}
	}

	// -------------------------------------------------------------
	// 5. Quick Settings Modal
	// -------------------------------------------------------------
	function createQuickSettingsModal() {
		const modal = document.createElement('div');
		modal.id = 'mb-settings-modal';
		modal.innerHTML = `
			<div class="mb-modal-header">
				<span>Mobile & Performance Settings</span>
				<button class="mb-modal-close" id="mb-close-modal">X</button>
			</div>
			<div class="mb-setting-row">
				<span class="mb-setting-label">FPS Limit:</span>
				<select id="mb-set-fps">
					<option value="30">30 FPS</option>
					<option value="60">60 FPS</option>
					<option value="90">90 FPS</option>
					<option value="120">120 FPS</option>
					<option value="uncapped">Uncapped</option>
				</select>
			</div>
			<div class="mb-setting-row">
				<span class="mb-setting-label">Show FPS Counter:</span>
				<input type="checkbox" id="mb-set-showfps">
			</div>
			<div class="mb-setting-row">
				<span class="mb-setting-label">Resolution Scale:</span>
				<select id="mb-set-res">
					<option value="0.5">50% (Battery Saver)</option>
					<option value="0.75">75% (Balanced)</option>
					<option value="1.0">100% (High Quality)</option>
				</select>
			</div>
			<div class="mb-setting-row">
				<span class="mb-setting-label">Haptic Feedback:</span>
				<input type="checkbox" id="mb-set-haptics">
			</div>
			<div class="mb-setting-row">
				<span class="mb-setting-label">UI Scale (${config.uiScale}%):</span>
				<input type="range" id="mb-set-uiscale" min="75" max="130" step="5" value="${config.uiScale}">
			</div>
			<div class="mb-setting-row">
				<span class="mb-setting-label">Cursor Template:</span>
				<select id="mb-set-curtemplate">
					<option value="classic_white">Classic White</option>
					<option value="modern_black">Modern Black</option>
					<option value="macos_black">macOS Black</option>
					<option value="color_tint">Customizable Color</option>
					<option value="custom">Custom (URL)</option>
				</select>
			</div>
			<div class="mb-setting-row" id="mb-color-row" style="display:none;">
				<span class="mb-setting-label">Cursor Color:</span>
				<input type="color" id="mb-set-curcolor" value="${config.cursorColor}">
			</div>
			<div class="mb-setting-row" id="mb-url-row" style="display:none;">
				<span class="mb-setting-label">Custom URL (.cur/.png):</span>
				<input type="text" id="mb-set-cururl" value="${config.customCursorUrl}" placeholder="https://...">
			</div>
			<div class="mb-setting-row">
				<span class="mb-setting-label">Cursor Size (${config.cursorSize}px):</span>
				<input type="range" id="mb-set-cursize" min="16" max="48" step="2" value="${config.cursorSize}">
			</div>
			<div class="mb-setting-row">
				<span class="mb-setting-label">Cursor Speed:</span>
				<input type="range" id="mb-set-curspeed" min="0.5" max="2.5" step="0.1" value="${config.cursorSpeed}">
			</div>
		`;

		document.body.appendChild(modal);

		document.getElementById('mb-close-modal').addEventListener('click', () => {
			modal.style.display = 'none';
		});

		// Bind inputs
		const fpsSelect = document.getElementById('mb-set-fps');
		fpsSelect.value = String(config.fpsLimit);
		fpsSelect.addEventListener('change', (e) => {
			config.fpsLimit = e.target.value === 'uncapped' ? 'uncapped' : Number(e.target.value);
			saveConfig();
		});

		const showFpsCb = document.getElementById('mb-set-showfps');
		showFpsCb.checked = config.showFps;
		showFpsCb.addEventListener('change', (e) => {
			config.showFps = e.target.checked;
			document.getElementById('mb-fps-counter').style.display = config.showFps ? 'block' : 'none';
			saveConfig();
		});

		const resSelect = document.getElementById('mb-set-res');
		resSelect.value = String(config.resolutionScale);
		resSelect.addEventListener('change', (e) => {
			config.resolutionScale = Number(e.target.value);
			applyResolutionScale();
			saveConfig();
		});

		const hapticCb = document.getElementById('mb-set-haptics');
		hapticCb.checked = config.haptics;
		hapticCb.addEventListener('change', (e) => {
			config.haptics = e.target.checked;
			saveConfig();
		});

		const uiscaleRange = document.getElementById('mb-set-uiscale');
		uiscaleRange.addEventListener('input', (e) => {
			config.uiScale = Number(e.target.value);
			applyUiScale();
			saveConfig();
		});

		const curTemplate = document.getElementById('mb-set-curtemplate');
		curTemplate.value = config.cursorTemplate;
		const colorRow = document.getElementById('mb-color-row');
		const urlRow = document.getElementById('mb-url-row');

		function updateTemplateVisibility() {
			colorRow.style.display = curTemplate.value === 'color_tint' ? 'flex' : 'none';
			urlRow.style.display = curTemplate.value === 'custom' ? 'flex' : 'none';
		}
		updateTemplateVisibility();

		curTemplate.addEventListener('change', (e) => {
			config.cursorTemplate = e.target.value;
			updateTemplateVisibility();
			updateVirtualCursorElement();
			saveConfig();
		});

		document.getElementById('mb-set-curcolor').addEventListener('input', (e) => {
			config.cursorColor = e.target.value;
			updateVirtualCursorElement();
			saveConfig();
		});

		document.getElementById('mb-set-cururl').addEventListener('change', (e) => {
			config.customCursorUrl = e.target.value;
			updateVirtualCursorElement();
			saveConfig();
		});

		document.getElementById('mb-set-cursize').addEventListener('input', (e) => {
			config.cursorSize = Number(e.target.value);
			updateVirtualCursorElement();
			saveConfig();
		});

		document.getElementById('mb-set-curspeed').addEventListener('input', (e) => {
			config.cursorSpeed = Number(e.target.value);
			saveConfig();
		});
	}

	function openSettingsModal() {
		triggerHaptic(15);
		const modal = document.getElementById('mb-settings-modal');
		if (modal) {
			modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
		}
	}

	// -------------------------------------------------------------
	// 6. Blockbench Native Preferences Integration
	// -------------------------------------------------------------
	function registerBlockbenchSettings() {
		if (typeof Setting === 'undefined') return;

		try {
			new Setting('mobile_fps_limit', {
				name: 'Mobile Target FPS',
				category: 'performance',
				type: 'select',
				value: String(config.fpsLimit),
				options: {
					'30': '30 FPS (Battery Saver)',
					'60': '60 FPS (Balanced)',
					'90': '90 FPS (Smooth)',
					'120': '120 FPS (Ultra)',
					'uncapped': 'Uncapped'
				},
				onChange: (v) => {
					config.fpsLimit = v === 'uncapped' ? 'uncapped' : Number(v);
					saveConfig();
				}
			});

			new Setting('mobile_haptics', {
				name: 'Haptic Feedback',
				category: 'mobile_controls',
				type: 'toggle',
				value: config.haptics,
				onChange: (v) => {
					config.haptics = v;
					saveConfig();
				}
			});

			new Setting('mobile_cursor_template', {
				name: 'Cursor Style',
				category: 'mobile_controls',
				type: 'select',
				value: config.cursorTemplate,
				options: {
					'classic_white': 'Classic White',
					'modern_black': 'Modern Black',
					'macos_black': 'macOS Black',
					'color_tint': 'Custom Color',
					'custom': 'Custom URL'
				},
				onChange: (v) => {
					config.cursorTemplate = v;
					updateVirtualCursorElement();
					saveConfig();
				}
			});
		} catch (e) {
			console.warn('Native settings hook note:', e);
		}
	}

	// -------------------------------------------------------------
	// 7. Auto-Save Backup Daemon
	// -------------------------------------------------------------
	function startAutoSaveDaemon() {
		setInterval(() => {
			if (window.Project && window.ModelProject) {
				try {
					const backupJson = JSON.stringify(window.Project);
					localStorage.setItem('mb_autosave_backup', backupJson);
					localStorage.setItem('mb_autosave_timestamp', String(Date.now()));
				} catch (e) {}
			}
		}, config.autoSaveMinutes * 60 * 1000);
	}

	// Initialize when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			initMobileUI();
			setTimeout(registerBlockbenchSettings, 2000);
			startAutoSaveDaemon();
		});
	} else {
		initMobileUI();
		setTimeout(registerBlockbenchSettings, 2000);
		startAutoSaveDaemon();
	}

	window.MobileControls = {
		config,
		saveConfig,
		triggerHaptic,
		toggleFullscreen
	};
})();
