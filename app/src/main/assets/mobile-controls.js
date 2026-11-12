/**
 * Mobile Controls, Performance Tuning & Independent Floating Controller for Blockbench
 * Created for Blockbench Android
 * Note: Strictly no emojis and no third-party branding as requested.
 */

(function () {
	'use strict';

	const STORAGE_KEY = 'mb_controls_settings';

	// Default Configuration
	const config = {
		enableVirtualCursor: true,
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
		autoSaveMinutes: 2,
		enabledButtons: {
			lmb: true,
			rmb: true,
			mmb: true,
			ctrl: true,
			shift: true,
			alt: false,
			space: false,
			undo: true,
			redo: true,
			del: false
		},
		buttonPositions: {
			lmb: { x: 20, y: window.innerHeight - 90 },
			rmb: { x: window.innerWidth - 76, y: window.innerHeight - 90 },
			mmb: { x: window.innerWidth - 138, y: window.innerHeight - 90 },
			ctrl: { x: 20, y: window.innerHeight - 152 },
			shift: { x: 20, y: window.innerHeight - 214 },
			alt: { x: 20, y: window.innerHeight - 276 },
			space: { x: 82, y: window.innerHeight - 152 },
			undo: { x: 82, y: window.innerHeight - 214 },
			redo: { x: window.innerWidth - 76, y: window.innerHeight - 152 },
			del: { x: window.innerWidth - 76, y: window.innerHeight - 214 }
		}
	};

	// Load stored configuration
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			if (parsed.enabledButtons) Object.assign(config.enabledButtons, parsed.enabledButtons);
			if (parsed.buttonPositions) Object.assign(config.buttonPositions, parsed.buttonPositions);
			delete parsed.enabledButtons;
			delete parsed.buttonPositions;
			Object.assign(config, parsed);
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

	function toggleVirtualCursor(forceState) {
		if (typeof forceState === 'boolean') {
			config.enableVirtualCursor = forceState;
		} else {
			config.enableVirtualCursor = !config.enableVirtualCursor;
		}
		saveConfig();
		triggerHaptic(14);

		const cursorEl = document.getElementById('virtual-cursor-element');
		if (cursorEl) {
			cursorEl.style.display = config.enableVirtualCursor ? 'block' : 'none';
		}
		const cursorCb = document.getElementById('mb-set-enablecursor');
		if (cursorCb) {
			cursorCb.checked = config.enableVirtualCursor;
		}
		const headerCursorBtn = document.getElementById('btn_native_toggle_cursor');
		if (headerCursorBtn) {
			headerCursorBtn.classList.toggle('active', config.enableVirtualCursor);
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
		cursorContainer.style.display = config.enableVirtualCursor ? 'block' : 'none';

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

	// State tracking for mouse and modifier keys
	let isLmbHeld = false;
	let isRmbHeld = false;
	let isMmbHeld = false;

	let isCtrlHeld = false;
	let isCtrlLocked = false;
	let isShiftHeld = false;
	let isShiftLocked = false;
	let isAltHeld = false;
	let isAltLocked = false;

	function getActiveButtonsMask() {
		let mask = 0;
		if (isLmbHeld) mask |= 1;
		if (isRmbHeld) mask |= 2;
		if (isMmbHeld) mask |= 4;
		return mask;
	}

	function getModifierStates() {
		return {
			ctrlKey: isCtrlHeld || isCtrlLocked,
			shiftKey: isShiftHeld || isShiftLocked,
			altKey: isAltHeld || isAltLocked
		};
	}

	function dispatchMouseEvent(type, button = 0) {
		triggerHaptic(16);
		const target = document.elementFromPoint(cursorX, cursorY) || document.body;
		const mods = getModifierStates();
		let buttons = type === 'mouseup' ? 0 : getActiveButtonsMask();
		if (buttons === 0 && type !== 'mouseup') {
			buttons = button === 2 ? 2 : button === 1 ? 4 : 1;
		}

		const event = new MouseEvent(type, {
			view: window,
			bubbles: true,
			cancelable: true,
			clientX: cursorX,
			clientY: cursorY,
			button: button,
			buttons: buttons,
			ctrlKey: mods.ctrlKey,
			shiftKey: mods.shiftKey,
			altKey: mods.altKey
		});
		target.dispatchEvent(event);
		if (type === 'mouseup' || type === 'mousedown') {
			document.dispatchEvent(event);
		}
	}

	function dispatchMouseMove() {
		const target = document.elementFromPoint(cursorX, cursorY) || document.body;
		const mods = getModifierStates();
		const buttons = getActiveButtonsMask();

		const event = new MouseEvent('mousemove', {
			view: window,
			bubbles: true,
			cancelable: true,
			clientX: cursorX,
			clientY: cursorY,
			button: isRmbHeld ? 2 : isMmbHeld ? 1 : 0,
			buttons: buttons,
			ctrlKey: mods.ctrlKey,
			shiftKey: mods.shiftKey,
			altKey: mods.altKey
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
	// 5. Button Definitions & SVG Icons
	// -------------------------------------------------------------
	const buttonDefinitions = {
		lmb: {
			title: 'Left Mouse Button',
			type: 'mouse',
			mouseButton: 0,
			svg: `
				<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
					<rect x="7" y="3" width="22" height="30" rx="11" stroke="#ffffff" stroke-width="2" fill="#14181f"/>
					<path d="M7 14 C7 7.9 11.9 3 18 3 L18 15 L7 15 Z" fill="#3e90ff"/>
					<line x1="18" y1="3" x2="18" y2="15" stroke="#ffffff" stroke-width="1.5"/>
					<line x1="7" y1="15" x2="29" y2="15" stroke="#ffffff" stroke-width="1.5"/>
					<rect x="16.5" y="7" width="3" height="5.5" rx="1.5" fill="#ffffff"/>
				</svg>`
		},
		rmb: {
			title: 'Right Mouse Button (3D Orbit)',
			type: 'mouse',
			mouseButton: 2,
			svg: `
				<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
					<rect x="7" y="3" width="22" height="30" rx="11" stroke="#ffffff" stroke-width="2" fill="#14181f"/>
					<path d="M18 3 C24.1 3 29 7.9 29 14 L18 14 L18 3 Z" fill="#3e90ff"/>
					<line x1="18" y1="3" x2="18" y2="15" stroke="#ffffff" stroke-width="1.5"/>
					<line x1="7" y1="15" x2="29" y2="15" stroke="#ffffff" stroke-width="1.5"/>
					<rect x="16.5" y="7" width="3" height="5.5" rx="1.5" fill="#ffffff"/>
				</svg>`
		},
		mmb: {
			title: 'Middle Mouse Button (Pan)',
			type: 'mouse',
			mouseButton: 1,
			svg: `
				<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
					<rect x="7" y="3" width="22" height="30" rx="11" stroke="#ffffff" stroke-width="2" fill="#14181f"/>
					<line x1="18" y1="3" x2="18" y2="15" stroke="#ffffff" stroke-width="1.5"/>
					<line x1="7" y1="15" x2="29" y2="15" stroke="#ffffff" stroke-width="1.5"/>
					<rect x="16.5" y="6" width="3" height="7.5" rx="1.5" fill="#3e90ff" stroke="#ffffff" stroke-width="1"/>
				</svg>`
		},
		ctrl: {
			title: 'CTRL Modifier (Tap to Lock)',
			type: 'modifier',
			label: 'CTRL',
			key: 'ctrl'
		},
		shift: {
			title: 'SHIFT Modifier (Tap to Lock)',
			type: 'modifier',
			label: 'SHIFT',
			key: 'shift'
		},
		alt: {
			title: 'ALT Modifier (Tap to Lock)',
			type: 'modifier',
			label: 'ALT',
			key: 'alt'
		},
		space: {
			title: 'Space Key (Pan / Play)',
			type: 'action',
			label: 'SPACE',
			action: () => {
				const eventDown = new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, bubbles: true });
				const eventUp = new KeyboardEvent('keyup', { key: ' ', code: 'Space', keyCode: 32, bubbles: true });
				window.dispatchEvent(eventDown);
				setTimeout(() => window.dispatchEvent(eventUp), 50);
			}
		},
		undo: {
			title: 'Undo',
			type: 'action',
			svg: `
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 7v6h6"></path>
					<path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
				</svg>`,
			action: () => {
				if (window.Undo && window.Undo.undo) window.Undo.undo();
			}
		},
		redo: {
			title: 'Redo',
			type: 'action',
			svg: `
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 7v6h-6"></path>
					<path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path>
				</svg>`,
			action: () => {
				if (window.Undo && window.Undo.redo) window.Undo.redo();
			}
		},
		del: {
			title: 'Delete Selected',
			type: 'action',
			svg: `
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="3 6 5 6 21 6"></polyline>
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
				</svg>`,
			action: () => {
				if (window.BarItems && window.BarItems.delete) {
					window.BarItems.delete.trigger();
				} else {
					const eventDown = new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', keyCode: 46, bubbles: true });
					window.dispatchEvent(eventDown);
				}
			}
		}
	};

	const renderedButtons = {};

	function renderAllFloatingButtons() {
		// Clean up existing elements
		Object.keys(renderedButtons).forEach((key) => {
			if (renderedButtons[key]) {
				renderedButtons[key].remove();
				delete renderedButtons[key];
			}
		});

		// Create enabled buttons
		Object.keys(buttonDefinitions).forEach((key) => {
			if (config.enabledButtons[key]) {
				createFloatingButton(key);
			}
		});
	}

	function createFloatingButton(key) {
		const def = buttonDefinitions[key];
		if (!def) return;

		const btn = document.createElement('div');
		btn.id = `mb-btn-${key}`;
		btn.className = 'floating-controller-btn';
		btn.title = def.title;

		if (def.svg) {
			btn.innerHTML = def.svg;
		} else {
			btn.textContent = def.label;
		}

		// Initial position
		const pos = config.buttonPositions[key] || { x: 30, y: 300 };
		const initX = Math.max(8, Math.min(window.innerWidth - 60, pos.x));
		const initY = Math.max(34, Math.min(window.innerHeight - 60, pos.y));
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
				btn.classList.add('held');
				triggerHaptic(16);

				if (def.type === 'mouse') {
					if (def.mouseButton === 0) isLmbHeld = true;
					if (def.mouseButton === 2) isRmbHeld = true;
					if (def.mouseButton === 1) isMmbHeld = true;
					dispatchMouseEvent('mousedown', def.mouseButton);
				} else if (def.type === 'modifier') {
					if (def.key === 'ctrl') isCtrlHeld = true;
					if (def.key === 'shift') isShiftHeld = true;
					if (def.key === 'alt') isAltHeld = true;
				}
			}
		}, { passive: true });

		btn.addEventListener('touchmove', (e) => {
			if (e.changedTouches.length > 0) {
				const t = e.changedTouches[0];
				const dx = t.clientX - startX;
				const dy = t.clientY - startY;

				if (!isDragging && Math.hypot(dx, dy) > 8) {
					isDragging = true;
				}

				if (isDragging) {
					const newX = Math.max(4, Math.min(window.innerWidth - 56, initialLeft + dx));
					const newY = Math.max(34, Math.min(window.innerHeight - 56, initialTop + dy));
					btn.style.left = `${newX}px`;
					btn.style.top = `${newY}px`;

					config.buttonPositions[key] = { x: newX, y: newY };
					saveConfig();
				}
			}
		}, { passive: true });

		function handleRelease() {
			if (isHeld) {
				btn.classList.remove('held');
				isHeld = false;

				if (def.type === 'mouse') {
					if (def.mouseButton === 0) isLmbHeld = false;
					if (def.mouseButton === 2) isRmbHeld = false;
					if (def.mouseButton === 1) isMmbHeld = false;
					dispatchMouseEvent('mouseup', def.mouseButton);

					if (!isDragging) {
						if (def.mouseButton === 0) {
							dispatchMouseEvent('click', 0);
						} else if (def.mouseButton === 2) {
							dispatchMouseEvent('contextmenu', 2);
						}
						triggerHaptic(14);
					}
				} else if (def.type === 'modifier') {
					if (def.key === 'ctrl') isCtrlHeld = false;
					if (def.key === 'shift') isShiftHeld = false;
					if (def.key === 'alt') isAltHeld = false;

					// Tap to toggle sticky lock
					if (!isDragging) {
						if (def.key === 'ctrl') {
							isCtrlLocked = !isCtrlLocked;
							btn.classList.toggle('sticky-locked', isCtrlLocked);
						} else if (def.key === 'shift') {
							isShiftLocked = !isShiftLocked;
							btn.classList.toggle('sticky-locked', isShiftLocked);
						} else if (def.key === 'alt') {
							isAltLocked = !isAltLocked;
							btn.classList.toggle('sticky-locked', isAltLocked);
						}
						triggerHaptic(18);
					}
				} else if (def.type === 'action') {
					if (!isDragging && def.action) {
						def.action();
						triggerHaptic(20);
					}
				}
			}
		}

		btn.addEventListener('touchend', handleRelease, { passive: true });
		btn.addEventListener('touchcancel', handleRelease, { passive: true });

		document.body.appendChild(btn);
		renderedButtons[key] = btn;
	}

	// -------------------------------------------------------------
	// 6. Touchpad Steering & Touch Isolation
	// -------------------------------------------------------------
	function setupScreenTouchpad() {
		let touchpadTouchId = null;
		let lastX = 0, lastY = 0;

		window.addEventListener('touchstart', (e) => {
			if (!config.enableVirtualCursor) return;

			for (let i = 0; i < e.changedTouches.length; i++) {
				const t = e.changedTouches[i];
				const target = t.target;

				// Skip if touching floating buttons, header controls, settings modal, or native dialogs
				if (
					target.closest('.floating-controller-btn') ||
					target.closest('#native_header_mobile_tools') ||
					target.closest('#mb-settings-modal') ||
					target.closest('.dialog_wrapper') ||
					target.closest('.menu')
				) {
					continue;
				}

				if (touchpadTouchId === null) {
					// Isolate touchpad touch: prevent background scrolling / element dragging
					e.preventDefault();
					e.stopPropagation();

					touchpadTouchId = t.identifier;
					lastX = t.clientX;
					lastY = t.clientY;
					break;
				}
			}
		}, { passive: false });

		window.addEventListener('touchmove', (e) => {
			if (!config.enableVirtualCursor || touchpadTouchId === null) return;

			for (let i = 0; i < e.changedTouches.length; i++) {
				const t = e.changedTouches[i];
				if (t.identifier === touchpadTouchId) {
					// Prevent UI scrolling while steering cursor
					e.preventDefault();
					e.stopPropagation();

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
		}, { passive: false });

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
	// 7. Quick Settings Modal & Custom Button Configuration
	// -------------------------------------------------------------
	function applyButtonPreset(presetName) {
		triggerHaptic(16);
		const W = window.innerWidth;
		const H = window.innerHeight;

		if (presetName === 'split') {
			config.buttonPositions.lmb = { x: 20, y: H - 90 };
			config.buttonPositions.rmb = { x: W - 76, y: H - 90 };
			config.buttonPositions.mmb = { x: W - 138, y: H - 90 };
			config.buttonPositions.ctrl = { x: 20, y: H - 152 };
			config.buttonPositions.shift = { x: 20, y: H - 214 };
			config.buttonPositions.alt = { x: 20, y: H - 276 };
			config.buttonPositions.space = { x: 82, y: H - 152 };
			config.buttonPositions.undo = { x: 82, y: H - 214 };
			config.buttonPositions.redo = { x: W - 76, y: H - 152 };
			config.buttonPositions.del = { x: W - 76, y: H - 214 };
		} else if (presetName === 'dock_right') {
			config.buttonPositions.rmb = { x: W - 76, y: H - 90 };
			config.buttonPositions.lmb = { x: W - 138, y: H - 90 };
			config.buttonPositions.mmb = { x: W - 200, y: H - 90 };
			config.buttonPositions.ctrl = { x: W - 76, y: H - 152 };
			config.buttonPositions.shift = { x: W - 138, y: H - 152 };
			config.buttonPositions.alt = { x: W - 200, y: H - 152 };
			config.buttonPositions.space = { x: W - 76, y: H - 214 };
			config.buttonPositions.undo = { x: W - 138, y: H - 214 };
			config.buttonPositions.redo = { x: W - 200, y: H - 214 };
			config.buttonPositions.del = { x: W - 76, y: H - 276 };
		} else if (presetName === 'dock_left') {
			config.buttonPositions.lmb = { x: 20, y: H - 90 };
			config.buttonPositions.rmb = { x: 82, y: H - 90 };
			config.buttonPositions.mmb = { x: 144, y: H - 90 };
			config.buttonPositions.ctrl = { x: 20, y: H - 152 };
			config.buttonPositions.shift = { x: 82, y: H - 152 };
			config.buttonPositions.alt = { x: 144, y: H - 152 };
			config.buttonPositions.space = { x: 20, y: H - 214 };
			config.buttonPositions.undo = { x: 82, y: H - 214 };
			config.buttonPositions.redo = { x: 144, y: H - 214 };
			config.buttonPositions.del = { x: 20, y: H - 276 };
		} else if (presetName === 'reset') {
			config.buttonPositions.lmb = { x: 20, y: H - 90 };
			config.buttonPositions.rmb = { x: W - 76, y: H - 90 };
			config.buttonPositions.mmb = { x: W - 138, y: H - 90 };
			config.buttonPositions.ctrl = { x: 20, y: H - 152 };
			config.buttonPositions.shift = { x: 20, y: H - 214 };
			config.buttonPositions.alt = { x: 20, y: H - 276 };
			config.buttonPositions.space = { x: 82, y: H - 152 };
			config.buttonPositions.undo = { x: 82, y: H - 214 };
			config.buttonPositions.redo = { x: W - 76, y: H - 152 };
			config.buttonPositions.del = { x: W - 76, y: H - 214 };
		}

		saveConfig();
		renderAllFloatingButtons();
	}

	function createQuickSettingsModal() {
		const modal = document.createElement('div');
		modal.id = 'mb-settings-modal';
		modal.innerHTML = `
			<div class="mb-modal-header">
				<span>Mobile Controller & Performance</span>
				<button class="mb-modal-close" id="mb-close-modal">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="mb-section-title">Virtual Cursor & Touchpad</div>
			<div class="mb-setting-row">
				<span class="mb-setting-label">Enable Virtual Cursor:</span>
				<input type="checkbox" id="mb-set-enablecursor">
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

			<div class="mb-section-title">Floating Controller Buttons</div>
			<div class="mb-presets-row">
				<button class="mb-preset-btn" id="mb-preset-split">Split</button>
				<button class="mb-preset-btn" id="mb-preset-right">Dock Right</button>
				<button class="mb-preset-btn" id="mb-preset-left">Dock Left</button>
				<button class="mb-preset-btn" id="mb-preset-reset">Reset</button>
			</div>
			<div class="mb-btn-grid" id="mb-button-checkboxes">
				<!-- Dynamically filled with checkboxes -->
			</div>

			<div class="mb-section-title">Performance & System</div>
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
		`;

		document.body.appendChild(modal);

		document.getElementById('mb-close-modal').addEventListener('click', () => {
			modal.style.display = 'none';
		});

		// Virtual cursor toggle
		const cursorCb = document.getElementById('mb-set-enablecursor');
		cursorCb.checked = config.enableVirtualCursor;
		cursorCb.addEventListener('change', (e) => {
			toggleVirtualCursor(e.target.checked);
		});

		// Fill button checkboxes
		const btnGrid = document.getElementById('mb-button-checkboxes');
		Object.keys(buttonDefinitions).forEach((key) => {
			const def = buttonDefinitions[key];
			const label = document.createElement('label');
			label.className = 'mb-btn-checkbox-label';
			label.innerHTML = `
				<input type="checkbox" data-btn="${key}" ${config.enabledButtons[key] ? 'checked' : ''}>
				<span>${key.toUpperCase()} (${def.type})</span>
			`;
			label.querySelector('input').addEventListener('change', (e) => {
				config.enabledButtons[key] = e.target.checked;
				saveConfig();
				triggerHaptic(14);
				renderAllFloatingButtons();
			});
			btnGrid.appendChild(label);
		});

		// Presets buttons
		document.getElementById('mb-preset-split').addEventListener('click', () => applyButtonPreset('split'));
		document.getElementById('mb-preset-right').addEventListener('click', () => applyButtonPreset('dock_right'));
		document.getElementById('mb-preset-left').addEventListener('click', () => applyButtonPreset('dock_left'));
		document.getElementById('mb-preset-reset').addEventListener('click', () => applyButtonPreset('reset'));

		// FPS limit
		const fpsSelect = document.getElementById('mb-set-fps');
		fpsSelect.value = String(config.fpsLimit);
		fpsSelect.addEventListener('change', (e) => {
			config.fpsLimit = e.target.value === 'uncapped' ? 'uncapped' : Number(e.target.value);
			syncRefreshRateWithNative();
			saveConfig();
		});

		// Show FPS
		const showFpsCb = document.getElementById('mb-set-showfps');
		showFpsCb.checked = config.showFps;
		showFpsCb.addEventListener('change', (e) => {
			toggleFpsDisplay(e.target.checked);
		});

		// Resolution scale
		const resSelect = document.getElementById('mb-set-res');
		resSelect.value = String(config.resolutionScale);
		resSelect.addEventListener('change', (e) => {
			config.resolutionScale = Number(e.target.value);
			applyResolutionScale();
			saveConfig();
		});

		// Haptics
		const hapticCb = document.getElementById('mb-set-haptics');
		hapticCb.checked = config.haptics;
		hapticCb.addEventListener('change', (e) => {
			config.haptics = e.target.checked;
			saveConfig();
		});

		// UI Scale
		const uiscaleRange = document.getElementById('mb-set-uiscale');
		uiscaleRange.addEventListener('input', (e) => {
			config.uiScale = Number(e.target.value);
			applyUiScale();
			saveConfig();
		});

		// Cursor templates & customizer
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
	}

	function openSettingsModal() {
		triggerHaptic(15);
		const modal = document.getElementById('mb-settings-modal');
		if (modal) {
			modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
		}
	}

	// -------------------------------------------------------------
	// 8. Auto-Save Backup Daemon
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

	// -------------------------------------------------------------
	// 9. Initializer
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

		// Virtual Cursor DOM Element
		const cursorElement = document.createElement('div');
		cursorElement.id = 'virtual-cursor-element';
		document.body.appendChild(cursorElement);
		setCursorPosition(cursorX, cursorY);
		updateCursorRender();

		// Bind Header Native Buttons (Top-Right Fixed)
		const nativeCursorBtn = document.getElementById('btn_native_toggle_cursor');
		if (nativeCursorBtn) {
			nativeCursorBtn.addEventListener('click', () => toggleVirtualCursor());
			nativeCursorBtn.classList.toggle('active', config.enableVirtualCursor);
		}

		const nativeFpsBtn = document.getElementById('btn_native_toggle_fps');
		if (nativeFpsBtn) {
			nativeFpsBtn.addEventListener('click', () => toggleFpsDisplay());
			nativeFpsBtn.classList.toggle('active', config.showFps);
		}

		const nativeFsBtn = document.getElementById('btn_native_fullscreen');
		if (nativeFsBtn) {
			nativeFsBtn.addEventListener('click', toggleFullscreen);
		}

		const nativeSetBtn = document.getElementById('btn_native_mobile_settings');
		if (nativeSetBtn) {
			nativeSetBtn.addEventListener('click', openSettingsModal);
		}

		// Floating Controller Buttons
		renderAllFloatingButtons();

		// Screen Touchpad Steering
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
		toggleFpsDisplay,
		toggleVirtualCursor,
		applyButtonPreset
	};
})();
