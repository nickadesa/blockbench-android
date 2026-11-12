/**
 * Mobile Controls, Performance Tuning & Independent Mouse Buttons for Blockbench
 * Created for Blockbench Android
 * Note: Strictly no emojis and no third-party branding as requested.
 */

(function () {
	'use strict';

	const STORAGE_KEY = 'mb_controls_settings';

	// Default Configuration
	const config = {
		fpsLimit: 120, // Default to 120 FPS
		resolutionScale: 1.0,
		antiAliasing: true,
		showFps: true,
		haptics: true,
		uiScale: 100,
		cursorTemplate: 'classic_white', // classic_white, modern_black, macos_black, color_tint, custom
		cursorColor: '#3e90ff',
		customCursorUrl: '',
		cursorSize: 28,
		cursorSpeed: 1.2,
		lmbPos: { x: 24, y: window.innerHeight - 100 },
		rmbPos: { x: window.innerWidth - 80, y: window.innerHeight - 100 },
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

	function syncRefreshRateWithNative() {
		try {
			if (window.AndroidBridge && window.AndroidBridge.setRefreshRate) {
				const target = config.fpsLimit === 'uncapped' ? 120 : Number(config.fpsLimit);
				window.AndroidBridge.setRefreshRate(target);
			}
		} catch (e) {}
	}

	// -------------------------------------------------------------
	// 1. Performance Engine (High Refresh Rate & Resolution Scale)
	// -------------------------------------------------------------
	let realFps = 60;
	let frameCount = 0;
	let lastFpsUpdate = performance.now();
	let lastFrameTime = performance.now();
	const originalRAF = window.requestAnimationFrame.bind(window);

	window.requestAnimationFrame = function (callback) {
		if (config.fpsLimit === 'uncapped' || Number(config.fpsLimit) >= 120 || !config.fpsLimit) {
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

	function toggleFpsDisplay(forceState) {
		if (typeof forceState === 'boolean') {
			config.showFps = forceState;
		} else {
			config.showFps = !config.showFps;
		}
		saveConfig();
		triggerHaptic(14);

		const fpsEl = document.getElementById('mb-fps-counter');
		if (fpsEl) {
			fpsEl.style.display = config.showFps ? 'block' : 'none';
		}
		const fpsCb = document.getElementById('mb-set-showfps');
		if (fpsCb) {
			fpsCb.checked = config.showFps;
		}
		const headerFpsBtn = document.getElementById('btn_native_toggle_fps');
		if (headerFpsBtn) {
			headerFpsBtn.classList.toggle('active', config.showFps);
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
	// 2. High-Visibility DOM Vector Cursor
	// -------------------------------------------------------------
	let cursorX = window.innerWidth / 2;
	let cursorY = window.innerHeight / 2;

	const cursorSVGs = {
		classic_white: `
			<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M2 2 L2 26 L8.5 20 L14.5 30 L18.5 28 L12.5 18 L20.5 18 Z" fill="#ffffff" stroke="#000000" stroke-width="2.2" stroke-linejoin="round"/>
			</svg>`,
		modern_black: `
			<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M2 2 L2 26 L8.5 20 L14.5 30 L18.5 28 L12.5 18 L20.5 18 Z" fill="#14171a" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/>
			</svg>`,
		macos_black: `
			<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M4 2 L4 24.5 L9.5 19 L15 29 L18 27.5 L12.5 17.5 L20 17.5 Z" fill="#111111" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
			</svg>`,
		color_tint: (color) => `
			<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M2 2 L2 26 L8.5 20 L14.5 30 L18.5 28 L12.5 18 L20.5 18 Z" fill="${color}" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/>
			</svg>`
	};

	function updateCursorRender() {
		const cursorContainer = document.getElementById('virtual-cursor-element');
		if (!cursorContainer) return;

		cursorContainer.style.width = `${config.cursorSize}px`;
		cursorContainer.style.height = `${config.cursorSize}px`;

		if (config.cursorTemplate === 'custom' && config.customCursorUrl) {
			cursorContainer.innerHTML = `<img src="${config.customCursorUrl}" style="width:100%;height:100%;object-fit:contain;" alt="cursor">`;
		} else if (config.cursorTemplate === 'color_tint') {
			cursorContainer.innerHTML = cursorSVGs.color_tint(config.cursorColor || '#3e90ff');
		} else {
			cursorContainer.innerHTML = cursorSVGs[config.cursorTemplate] || cursorSVGs.classic_white;
		}
	}

	function setCursorPosition(x, y) {
		cursorX = Math.max(0, Math.min(window.innerWidth - 1, x));
		cursorY = Math.max(0, Math.min(window.innerHeight - 1, y));
		const cursorContainer = document.getElementById('virtual-cursor-element');
		if (cursorContainer) {
			cursorContainer.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
		}
	}

	let isLmbHeld = false;
	let isRmbHeld = false;

	function dispatchMouseEvent(type, button = 0) {
		triggerHaptic(16);
		const target = document.elementFromPoint(cursorX, cursorY) || document.body;
		let buttons = 0;
		if (type !== 'mouseup') {
			if (isLmbHeld && isRmbHeld) buttons = 3;
			else if (isLmbHeld) buttons = 1;
			else if (isRmbHeld) buttons = 2;
			else buttons = button === 2 ? 2 : 1;
		}

		const event = new MouseEvent(type, {
			view: window,
			bubbles: true,
			cancelable: true,
			clientX: cursorX,
			clientY: cursorY,
			button: button,
			buttons: buttons
		});
		target.dispatchEvent(event);
		if (type === 'mouseup' || type === 'mousedown') {
			document.dispatchEvent(event);
		}
	}

	function dispatchMouseMove() {
		const target = document.elementFromPoint(cursorX, cursorY) || document.body;
		let buttons = 0;
		if (isLmbHeld && isRmbHeld) buttons = 3;
		else if (isLmbHeld) buttons = 1;
		else if (isRmbHeld) buttons = 2;

		const event = new MouseEvent('mousemove', {
			view: window,
			bubbles: true,
			cancelable: true,
			clientX: cursorX,
			clientY: cursorY,
			button: isRmbHeld ? 2 : 0,
			buttons: buttons
		});
		target.dispatchEvent(event);
		document.dispatchEvent(event);
	}

	// -------------------------------------------------------------
	// 3. Multi-Touch Gestures (2-finger Undo, 3-finger Redo)
	// -------------------------------------------------------------
	let touchCount = 0;
	let touchStartTimestamp = 0;

	window.addEventListener('touchstart', (e) => {
		touchCount = e.touches.length;
		touchStartTimestamp = performance.now();
	}, { passive: true });

	window.addEventListener('touchend', () => {
		const duration = performance.now() - touchStartTimestamp;
		if (duration < 320) {
			if (touchCount === 2) {
				triggerHaptic(25);
				if (window.Undo && window.Undo.undo) {
					window.Undo.undo();
				}
			} else if (touchCount === 3) {
				triggerHaptic(25);
				if (window.Undo && window.Undo.redo) {
					window.Undo.redo();
				}
			}
		}
		touchCount = 0;
	}, { passive: true });

	// -------------------------------------------------------------
	// 4. File Export & Download Interceptor
	// -------------------------------------------------------------
	function saveBase64ToDevice(filename, base64Data, mimeType) {
		try {
			if (window.AndroidBridge && window.AndroidBridge.saveBase64File) {
				window.AndroidBridge.saveBase64File(filename, base64Data, mimeType);
				return;
			}
		} catch (e) {
			console.warn('AndroidBridge saveBase64File failed', e);
		}

		// Fallback for browser preview
		try {
			const byteCharacters = atob(base64Data);
			const byteNumbers = new Array(byteCharacters.length);
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}
			const byteArray = new Uint8Array(byteNumbers);
			const blob = new Blob([byteArray], { type: mimeType || 'application/octet-stream' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			setTimeout(() => {
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			}, 1000);
		} catch (e) {
			console.error('Fallback save failed', e);
		}
	}

	function handleExportFile(filename, content, mimeType, callback) {
		triggerHaptic(18);
		if (content instanceof Blob) {
			const reader = new FileReader();
			reader.onloadend = function () {
				const dataUrl = reader.result;
				if (typeof dataUrl === 'string') {
					const commaIdx = dataUrl.indexOf(',');
					const base64 = dataUrl.substring(commaIdx + 1);
					const detectedMime = dataUrl.substring(5, commaIdx).split(';')[0] || mimeType;
					saveBase64ToDevice(filename, base64, detectedMime);
					if (typeof callback === 'function') callback(filename);
				}
			};
			reader.readAsDataURL(content);
		} else if (typeof content === 'string') {
			if (content.startsWith('data:')) {
				const commaIdx = content.indexOf(',');
				const base64 = content.substring(commaIdx + 1);
				const detectedMime = content.substring(5, commaIdx).split(';')[0] || mimeType;
				saveBase64ToDevice(filename, base64, detectedMime);
			} else {
				try {
					const base64 = btoa(unescape(encodeURIComponent(content)));
					saveBase64ToDevice(filename, base64, mimeType || 'text/plain;charset=utf-8');
				} catch (e) {
					console.error('Failed to encode string content', e);
				}
			}
			if (typeof callback === 'function') callback(filename);
		} else if (content instanceof ArrayBuffer || ArrayBuffer.isView(content)) {
			const bytes = new Uint8Array(content.buffer || content);
			let binary = '';
			const len = bytes.byteLength;
			for (let i = 0; i < len; i++) {
				binary += String.fromCharCode(bytes[i]);
			}
			const base64 = btoa(binary);
			saveBase64ToDevice(filename, base64, mimeType || 'application/octet-stream');
			if (typeof callback === 'function') callback(filename);
		}
	}

	function setupExportHooks() {
		// Hook window.saveAs
		window.saveAs = function (content, filename) {
			handleExportFile(filename || 'download', content, 'application/octet-stream');
		};

		// Intercept <a> download click
		const originalAnchorClick = HTMLAnchorElement.prototype.click;
		HTMLAnchorElement.prototype.click = function () {
			if (this.hasAttribute('download')) {
				const filename = this.getAttribute('download') || 'download';
				const href = this.getAttribute('href') || this.href;
				if (href && (href.startsWith('blob:') || href.startsWith('data:'))) {
					fetch(href)
						.then((r) => r.blob())
						.then((blob) => {
							handleExportFile(filename, blob, blob.type);
						})
						.catch(() => {
							originalAnchorClick.apply(this, arguments);
						});
					return;
				}
			}
			return originalAnchorClick.apply(this, arguments);
		};

		// Hook Blockbench.exportFile
		function hookBlockbenchExport() {
			if (window.Blockbench && window.Blockbench.exportFile) {
				const origExport = window.Blockbench.exportFile;
				window.Blockbench.exportFile = function (options, callback) {
					if (!options) return origExport.apply(this, arguments);
					let filename = options.name || 'model';
					if (options.extensions && options.extensions[0]) {
						const ext = options.extensions[0];
						if (!filename.toLowerCase().endsWith('.' + ext.toLowerCase())) {
							filename += '.' + ext;
						}
					}
					if (options.content !== undefined && options.content !== null) {
						handleExportFile(filename, options.content, options.type, callback);
						return;
					}
					return origExport.apply(this, arguments);
				};
				window.Blockbench.export = window.Blockbench.exportFile;
				return true;
			}
			return false;
		}

		if (!hookBlockbenchExport()) {
			const interval = setInterval(() => {
				if (hookBlockbenchExport()) clearInterval(interval);
			}, 300);
			setTimeout(() => clearInterval(interval), 15000);
		}
	}

	// -------------------------------------------------------------
	// 5. UI Construction & Event Handlers
	// -------------------------------------------------------------
	function initMobileControls() {
		// Realtime FPS Counter
		const fpsCounter = document.createElement('div');
		fpsCounter.id = 'mb-fps-counter';
		fpsCounter.textContent = 'FPS: 120';
		fpsCounter.title = 'Click to hide FPS';
		if (config.showFps) fpsCounter.style.display = 'block';
		fpsCounter.addEventListener('click', () => toggleFpsDisplay());
		document.body.appendChild(fpsCounter);

		// Virtual Cursor DOM Element (Always Visible)
		const cursorElement = document.createElement('div');
		cursorElement.id = 'virtual-cursor-element';
		document.body.appendChild(cursorElement);
		setCursorPosition(cursorX, cursorY);
		updateCursorRender();

		// Bind Header Native Buttons
		const nativeFpsBtn = document.getElementById('btn_native_toggle_fps');
		if (nativeFpsBtn) {
			nativeFpsBtn.addEventListener('click', () => toggleFpsDisplay());
			if (config.showFps) nativeFpsBtn.classList.add('active');
		}

		const nativeFsBtn = document.getElementById('btn_native_fullscreen');
		if (nativeFsBtn) {
			nativeFsBtn.addEventListener('click', toggleFullscreen);
		}

		const nativeSetBtn = document.getElementById('btn_native_mobile_settings');
		if (nativeSetBtn) {
			nativeSetBtn.addEventListener('click', openSettingsModal);
		}

		// Independent Floating Mouse Buttons (LMB & RMB)
		createIndependentButton('lmb', config.lmbPos, 0);
		createIndependentButton('rmb', config.rmbPos, 2);

		// Multi-touch touchpad steering on viewport
		setupScreenTouchpad();

		// Quick Settings Modal
		createQuickSettingsModal();

		// Apply UI Scale
		applyUiScale();

		// Sync Native High Refresh Rate
		syncRefreshRateWithNative();

		// Setup Export Hooks
		setupExportHooks();
	}

	// SVG Mouse Icons (LMB highlighted vs RMB highlighted)
	const mouseSvgLeft = `
	<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
		<rect x="7" y="3" width="22" height="30" rx="11" stroke="#ffffff" stroke-width="2" fill="#14181f"/>
		<path d="M7 14 C7 7.9 11.9 3 18 3 L18 15 L7 15 Z" fill="#3e90ff"/>
		<line x1="18" y1="3" x2="18" y2="15" stroke="#ffffff" stroke-width="1.5"/>
		<line x1="7" y1="15" x2="29" y2="15" stroke="#ffffff" stroke-width="1.5"/>
		<rect x="16.5" y="7" width="3" height="5.5" rx="1.5" fill="#ffffff"/>
	</svg>`;

	const mouseSvgRight = `
	<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
		<rect x="7" y="3" width="22" height="30" rx="11" stroke="#ffffff" stroke-width="2" fill="#14181f"/>
		<path d="M18 3 C24.1 3 29 7.9 29 14 L18 14 L18 3 Z" fill="#3e90ff"/>
		<line x1="18" y1="3" x2="18" y2="15" stroke="#ffffff" stroke-width="1.5"/>
		<line x1="7" y1="15" x2="29" y2="15" stroke="#ffffff" stroke-width="1.5"/>
		<rect x="16.5" y="7" width="3" height="5.5" rx="1.5" fill="#ffffff"/>
	</svg>`;

	function createIndependentButton(id, pos, mouseButton) {
		const btn = document.createElement('div');
		btn.id = `mb-float-${id}`;
		btn.className = 'floating-mouse-btn';
		btn.title = mouseButton === 0 ? 'Left Mouse Click' : 'Right Mouse Click';
		btn.innerHTML = mouseButton === 0 ? mouseSvgLeft : mouseSvgRight;

		// Initial position
		const initX = Math.max(10, Math.min(window.innerWidth - 70, pos.x));
		const initY = Math.max(10, Math.min(window.innerHeight - 70, pos.y));
		btn.style.left = `${initX}px`;
		btn.style.top = `${initY}px`;

		let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
		let isDragging = false;
		let isHeld = false;

		btn.addEventListener('touchstart', (e) => {
			if (e.changedTouches.length > 0) {
				const t = e.changedTouches[0];
				startX = t.clientX;
				startY = t.clientY;
				const rect = btn.getBoundingClientRect();
				initialLeft = rect.left;
				initialTop = rect.top;
				isDragging = false;
				isHeld = true;
				if (mouseButton === 0) isLmbHeld = true;
				if (mouseButton === 2) isRmbHeld = true;
				btn.classList.add('held');
				triggerHaptic(16);

				// Fire mousedown on target under cursor
				dispatchMouseEvent('mousedown', mouseButton);
			}
		}, { passive: true });

		btn.addEventListener('touchmove', (e) => {
			if (e.changedTouches.length > 0) {
				const t = e.changedTouches[0];
				const dx = t.clientX - startX;
				const dy = t.clientY - startY;

				if (!isDragging && Math.hypot(dx, dy) > 10) {
					isDragging = true;
				}

				if (isDragging) {
					const newX = Math.max(8, Math.min(window.innerWidth - 64, initialLeft + dx));
					const newY = Math.max(8, Math.min(window.innerHeight - 64, initialTop + dy));
					btn.style.left = `${newX}px`;
					btn.style.top = `${newY}px`;

					// Update stored position
					if (id === 'lmb') {
						config.lmbPos = { x: newX, y: newY };
					} else {
						config.rmbPos = { x: newX, y: newY };
					}
					saveConfig();
				}
			}
		}, { passive: true });

		btn.addEventListener('touchend', () => {
			if (isHeld) {
				btn.classList.remove('held');
				isHeld = false;
				if (mouseButton === 0) isLmbHeld = false;
				if (mouseButton === 2) isRmbHeld = false;
				dispatchMouseEvent('mouseup', mouseButton);

				if (!isDragging) {
					if (mouseButton === 0) {
						dispatchMouseEvent('click', 0);
					} else {
						dispatchMouseEvent('contextmenu', 2);
					}
					triggerHaptic(14);
				}
			}
		}, { passive: true });

		btn.addEventListener('touchcancel', () => {
			if (isHeld) {
				btn.classList.remove('held');
				isHeld = false;
				if (mouseButton === 0) isLmbHeld = false;
				if (mouseButton === 2) isRmbHeld = false;
				dispatchMouseEvent('mouseup', mouseButton);
			}
		}, { passive: true });

		document.body.appendChild(btn);
	}

	function setupScreenTouchpad() {
		let touchpadTouchId = null;
		let lastX = 0, lastY = 0;

		window.addEventListener('touchstart', (e) => {
			for (let i = 0; i < e.changedTouches.length; i++) {
				const t = e.changedTouches[i];
				const target = t.target;
				if (
					target.closest('.floating-mouse-btn') ||
					target.closest('#native_header_mobile_tools') ||
					target.closest('#mb-settings-modal')
				) {
					continue;
				}

				if (touchpadTouchId === null) {
					touchpadTouchId = t.identifier;
					lastX = t.clientX;
					lastY = t.clientY;
					break;
				}
			}
		}, { passive: true });

		window.addEventListener('touchmove', (e) => {
			if (touchpadTouchId === null) return;

			for (let i = 0; i < e.changedTouches.length; i++) {
				const t = e.changedTouches[i];
				if (t.identifier === touchpadTouchId) {
					const dx = (t.clientX - lastX) * config.cursorSpeed;
					const dy = (t.clientY - lastY) * config.cursorSpeed;
					setCursorPosition(cursorX + dx, cursorY + dy);
					lastX = t.clientX;
					lastY = t.clientY;

					// Dispatch mousemove to support 3D orbit and dragging
					dispatchMouseMove();
					break;
				}
			}
		}, { passive: true });

		function handleTouchEnd(e) {
			if (touchpadTouchId === null) return;
			for (let i = 0; i < e.changedTouches.length; i++) {
				if (e.changedTouches[i].identifier === touchpadTouchId) {
					touchpadTouchId = null;
					break;
				}
			}
		}

		window.addEventListener('touchend', handleTouchEnd, { passive: true });
		window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
	}

	function applyUiScale() {
		document.body.style.zoom = `${config.uiScale}%`;
	}

	function toggleFullscreen() {
		triggerHaptic(20);
		if (window.AndroidBridge && window.AndroidBridge.toggleFullscreen) {
			window.AndroidBridge.toggleFullscreen();
			return;
		}
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen?.().catch(() => {});
		} else {
			document.exitFullscreen?.().catch(() => {});
		}
	}

	// -------------------------------------------------------------
	// 6. Quick Settings Modal
	// -------------------------------------------------------------
	function createQuickSettingsModal() {
		const modal = document.createElement('div');
		modal.id = 'mb-settings-modal';
		modal.innerHTML = `
			<div class="mb-modal-header">
				<span>Mobile & Performance Settings</span>
				<button class="mb-modal-close" id="mb-close-modal">✕</button>
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
				<input type="range" id="mb-set-cursize" min="18" max="52" step="2" value="${config.cursorSize}">
			</div>
			<div class="mb-setting-row">
				<span class="mb-setting-label">Cursor Speed:</span>
				<input type="range" id="mb-set-curspeed" min="0.5" max="2.5" step="0.1" value="${config.cursorSpeed}">
			</div>
			<div class="mb-setting-row" style="margin-top: 14px;">
				<button id="mb-reset-pos-btn" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #fff; cursor: pointer;">
					Reset Button Positions
				</button>
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
			syncRefreshRateWithNative();
			saveConfig();
		});

		const showFpsCb = document.getElementById('mb-set-showfps');
		showFpsCb.checked = config.showFps;
		showFpsCb.addEventListener('change', (e) => {
			toggleFpsDisplay(e.target.checked);
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
			updateCursorRender();
			saveConfig();
		});

		document.getElementById('mb-set-curcolor').addEventListener('input', (e) => {
			config.cursorColor = e.target.value;
			updateCursorRender();
			saveConfig();
		});

		document.getElementById('mb-set-cururl').addEventListener('change', (e) => {
			config.customCursorUrl = e.target.value;
			updateCursorRender();
			saveConfig();
		});

		document.getElementById('mb-set-cursize').addEventListener('input', (e) => {
			config.cursorSize = Number(e.target.value);
			updateCursorRender();
			saveConfig();
		});

		document.getElementById('mb-set-curspeed').addEventListener('input', (e) => {
			config.cursorSpeed = Number(e.target.value);
			saveConfig();
		});

		document.getElementById('mb-reset-pos-btn').addEventListener('click', () => {
			triggerHaptic(18);
			const lmb = document.getElementById('mb-float-lmb');
			const rmb = document.getElementById('mb-float-rmb');
			const defaultLmb = { x: 24, y: window.innerHeight - 100 };
			const defaultRmb = { x: window.innerWidth - 80, y: window.innerHeight - 100 };
			if (lmb) {
				lmb.style.left = `${defaultLmb.x}px`;
				lmb.style.top = `${defaultLmb.y}px`;
			}
			if (rmb) {
				rmb.style.left = `${defaultRmb.x}px`;
				rmb.style.top = `${defaultRmb.y}px`;
			}
			config.lmbPos = defaultLmb;
			config.rmbPos = defaultRmb;
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
			initMobileControls();
			startAutoSaveDaemon();
		});
	} else {
		initMobileControls();
		startAutoSaveDaemon();
	}

	window.MobileControls = {
		config,
		saveConfig,
		triggerHaptic,
		toggleFullscreen,
		toggleFpsDisplay
	};
})();
