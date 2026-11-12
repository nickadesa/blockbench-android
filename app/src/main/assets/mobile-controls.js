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
		fpsLimit: 60,
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

	// -------------------------------------------------------------
	// 1. Performance Engine (FPS Throttler & Resolution Scale)
	// -------------------------------------------------------------
	let realFps = 60;
	let frameCount = 0;
	let lastFpsUpdate = performance.now();
	let lastFrameTime = performance.now();
	const originalRAF = window.requestAnimationFrame.bind(window);

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
			buttons: type === 'mouseup' ? 0 : button === 0 ? 1 : button === 2 ? 2 : 4
		});
		target.dispatchEvent(event);
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
	// 4. UI Construction & Event Handlers
	// -------------------------------------------------------------
	function initMobileControls() {
		// Realtime FPS Counter
		const fpsCounter = document.createElement('div');
		fpsCounter.id = 'mb-fps-counter';
		fpsCounter.textContent = 'FPS: 60';
		if (config.showFps) fpsCounter.style.display = 'block';
		document.body.appendChild(fpsCounter);

		// Virtual Cursor DOM Element (Always Visible)
		const cursorElement = document.createElement('div');
		cursorElement.id = 'virtual-cursor-element';
		document.body.appendChild(cursorElement);
		setCursorPosition(cursorX, cursorY);
		updateCursorRender();

		// Bind Header Native Buttons
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

		// Touch drag steering on viewport
		setupScreenTouchpad();

		// Quick Settings Modal
		createQuickSettingsModal();

		// Apply UI Scale
		applyUiScale();
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
			if (e.touches.length === 1) {
				const t = e.touches[0];
				startX = t.clientX;
				startY = t.clientY;
				const rect = btn.getBoundingClientRect();
				initialLeft = rect.left;
				initialTop = rect.top;
				isDragging = false;
				isHeld = true;
				btn.classList.add('held');
				triggerHaptic(16);

				// Fire mousedown on target under cursor
				dispatchMouseEvent('mousedown', mouseButton);
			}
		}, { passive: true });

		btn.addEventListener('touchmove', (e) => {
			if (e.touches.length === 1) {
				const t = e.touches[0];
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

		document.body.appendChild(btn);
	}

	function setupScreenTouchpad() {
		let lastX = 0, lastY = 0;
		let tracking = false;

		window.addEventListener('touchstart', (e) => {
			if (e.touches.length === 1) {
				const target = e.target;
				// Skip if touching interactive buttons or header
				if (target.closest('.floating-mouse-btn') || target.closest('#native_header_mobile_tools') || target.closest('#mb-settings-modal')) {
					tracking = false;
					return;
				}
				tracking = true;
				lastX = e.touches[0].clientX;
				lastY = e.touches[0].clientY;
			}
		}, { passive: true });

		window.addEventListener('touchmove', (e) => {
			if (tracking && e.touches.length === 1) {
				const dx = (e.touches[0].clientX - lastX) * config.cursorSpeed;
				const dy = (e.touches[0].clientY - lastY) * config.cursorSpeed;
				setCursorPosition(cursorX + dx, cursorY + dy);
				lastX = e.touches[0].clientX;
				lastY = e.touches[0].clientY;
			}
		}, { passive: true });

		window.addEventListener('touchend', () => {
			tracking = false;
		}, { passive: true });
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
	// 5. Quick Settings Modal
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
	// 6. Auto-Save Backup Daemon
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
		toggleFullscreen
	};
})();
