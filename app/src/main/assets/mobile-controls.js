/**
 * Mobile Controls & Performance Tuning Engine for Blockbench Mod Mobile
 * Features:
 * 1. Fixed floating controller buttons (LMB, RMB, MMB Pan, CTRL, SHIFT, ALT, SPACE, UNDO, REDO, DEL)
 * 2. Dedicated "Edit Layout" mode with persistent coordinate saving in localStorage
 * 3. Native Blockbench Modifier synchronization (window.Pressing.overrides and update_pressed_modifier_keys)
 * 4. High Refresh Rate (120Hz/90Hz/60Hz) synchronization
 * 5. Aggressive Local Auto-Save (2 minutes)
 * Strictly no emojis and no third-party branding as requested.
 */

(function () {
	'use strict';

	const STORAGE_KEY = 'mb_mod_controls_config_v2';
	const POSITIONS_KEY = 'mb_mod_button_positions_v2';

	const DEFAULT_CONFIG = {
		fpsLimit: 120,
		showFps: true,
		resolutionScale: 100,
		enableHaptics: true,
		uiScale: 100,
		autoSaveMinutes: 2,
		enabledButtons: {
			lmb: true,
			rmb: true,
			mmb: false,
			ctrl: true,
			shift: true,
			alt: false,
			space: false,
			undo: true,
			redo: true,
			del: false
		}
	};

	let config = loadConfig();

	function loadConfig() {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				return Object.assign({}, DEFAULT_CONFIG, JSON.parse(saved));
			}
		} catch (e) {
			console.warn('Could not load mobile controls config', e);
		}
		return Object.assign({}, DEFAULT_CONFIG);
	}

	function saveConfig() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
		} catch (e) {}
	}

	function loadButtonPositions() {
		try {
			const saved = localStorage.getItem(POSITIONS_KEY);
			if (saved) {
				return JSON.parse(saved);
			}
		} catch (e) {}
		return getDefaultPositions();
	}

	function saveButtonPositions(positions) {
		try {
			localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
		} catch (e) {}
	}

	function getDefaultPositions() {
		const w = window.innerWidth || 800;
		const h = window.innerHeight || 600;
		return {
			lmb: { x: w - 70, y: h - 140 },
			rmb: { x: w - 70, y: h - 74 },
			mmb: { x: w - 130, y: h - 74 },
			undo: { x: 18, y: 44 },
			redo: { x: 76, y: 44 },
			ctrl: { x: 18, y: h - 74 },
			shift: { x: 76, y: h - 74 },
			alt: { x: 18, y: h - 134 },
			space: { x: 76, y: h - 134 },
			del: { x: w - 130, y: h - 140 }
		};
	}

	let buttonPositions = loadButtonPositions();

	// -------------------------------------------------------------
	// 1. Native Haptic Feedback & Display Sync
	// -------------------------------------------------------------
	function triggerHaptic(duration = 18) {
		if (!config.enableHaptics) return;
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
	// 2. Realtime FPS Engine
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

	// -------------------------------------------------------------
	// 3. Modifier Keys Synchronization (CTRL, ALT, SHIFT)
	// -------------------------------------------------------------
	const modifierStates = {
		ctrl: false,
		shift: false,
		alt: false
	};

	function hookPressingGlobal() {
		try {
			if (!window.Pressing) return;
			if (window.Pressing.__hooked) return;
			window.Pressing.__hooked = true;
			if (!window.Pressing.overrides) {
				window.Pressing.overrides = { shift: false, ctrl: false, alt: false };
			}
			['ctrl', 'shift', 'alt'].forEach((k) => {
				let val = window.Pressing[k] || false;
				let overrideVal = window.Pressing.overrides[k] || false;
				Object.defineProperty(window.Pressing, k, {
					get() {
						return modifierStates[k] ? true : val;
					},
					set(v) {
						val = v;
					},
					configurable: true,
					enumerable: true
				});
				Object.defineProperty(window.Pressing.overrides, k, {
					get() {
						return modifierStates[k] ? true : overrideVal;
					},
					set(v) {
						overrideVal = v;
					},
					configurable: true,
					enumerable: true
				});
			});
		} catch (e) {}
	}

	function installModifierEventCapture() {
		const eventTypes = [
			'pointerdown', 'pointermove', 'pointerup',
			'mousedown', 'mousemove', 'mouseup',
			'touchstart', 'touchmove', 'touchend',
			'click', 'contextmenu'
		];
		eventTypes.forEach((type) => {
			window.addEventListener(type, (e) => {
				if (modifierStates.ctrl) {
					try { Object.defineProperty(e, 'ctrlKey', { get: () => true, configurable: true }); } catch (err) {}
					try { Object.defineProperty(e, 'ctrlOrCmd', { get: () => true, configurable: true }); } catch (err) {}
				}
				if (modifierStates.shift) {
					try { Object.defineProperty(e, 'shiftKey', { get: () => true, configurable: true }); } catch (err) {}
				}
				if (modifierStates.alt) {
					try { Object.defineProperty(e, 'altKey', { get: () => true, configurable: true }); } catch (err) {}
				}
			}, { capture: true, passive: false });
		});
	}

	function setModifierState(key, active) {
		modifierStates[key] = active;
		hookPressingGlobal();

		// 1. Sync with Blockbench Pressing global object
		if (window.Pressing) {
			if (!window.Pressing.overrides) {
				window.Pressing.overrides = { shift: false, ctrl: false, alt: false };
			}
			window.Pressing[key] = active;
			window.Pressing.overrides[key] = active;
		}

		// 2. Dispatch standard window KeyboardEvent for global listeners
		const eventName = active ? 'keydown' : 'keyup';
		const keyMap = {
			ctrl: { key: 'Control', code: 'ControlLeft', keyCode: 17, which: 17 },
			shift: { key: 'Shift', code: 'ShiftLeft', keyCode: 16, which: 16 },
			alt: { key: 'Alt', code: 'AltLeft', keyCode: 18, which: 18 }
		};

		const info = keyMap[key];
		let ev = null;
		if (info) {
			ev = new KeyboardEvent(eventName, {
				key: info.key,
				code: info.code,
				keyCode: info.keyCode,
				which: info.which,
				ctrlKey: modifierStates.ctrl,
				shiftKey: modifierStates.shift,
				altKey: modifierStates.alt,
				bubbles: true,
				cancelable: true
			});
			window.dispatchEvent(ev);
			document.dispatchEvent(ev);
		}

		// 3. Dispatch Blockbench internal modifier event with expected structure { before, now, event }
		if (window.Blockbench && typeof window.Blockbench.dispatchEvent === 'function') {
			const beforeState = {
				shift: key === 'shift' ? !active : modifierStates.shift,
				ctrl: key === 'ctrl' ? !active : modifierStates.ctrl,
				alt: key === 'alt' ? !active : modifierStates.alt
			};
			const nowState = {
				shift: modifierStates.shift,
				ctrl: modifierStates.ctrl,
				alt: modifierStates.alt
			};
			try {
				window.Blockbench.dispatchEvent('update_pressed_modifier_keys', {
					before: beforeState,
					now: nowState,
					event: ev || new Event(eventName)
				});
			} catch (e) {}
		}

		// Update button visual state with unmistakable bright solid green and [ON] badge
		const btn = renderedButtons[key];
		if (btn) {
			btn.classList.toggle('modifier-active', active);
			if (active) {
				btn.innerHTML = `<span class="mb-mod-label">${key.toUpperCase()}</span><span class="mb-mod-badge">ON</span>`;
				btn.style.setProperty('background', '#2ecc71', 'important');
				btn.style.setProperty('border-color', '#27ae60', 'important');
				btn.style.setProperty('color', '#092613', 'important');
				btn.style.setProperty('box-shadow', '0 0 18px rgba(46, 204, 113, 0.95), 0 4px 12px rgba(0, 0, 0, 0.6)', 'important');
			} else {
				btn.innerHTML = `<span class="mb-mod-label">${key.toUpperCase()}</span>`;
				btn.style.removeProperty('background');
				btn.style.removeProperty('border-color');
				btn.style.removeProperty('color');
				btn.style.removeProperty('box-shadow');
			}
		}
	}

	// -------------------------------------------------------------
	// 4. Button Definitions
	// -------------------------------------------------------------
	const buttonDefinitions = {
		lmb: {
			title: 'Left Mouse Button (Select / Paint)',
			type: 'mouse',
			mouseButton: 0,
			svg: `
				<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
					<rect x="7" y="3" width="22" height="30" rx="11" stroke="#ffffff" stroke-width="2" fill="#14181f"/>
					<path d="M7 14C7 8 11.5 3 18 3V15H7V14Z" fill="#3e90ff"/>
					<line x1="18" y1="3" x2="18" y2="15" stroke="#ffffff" stroke-width="1.5"/>
					<line x1="7" y1="15" x2="29" y2="15" stroke="#ffffff" stroke-width="1.5"/>
					<circle cx="18" cy="10" r="1.5" fill="#ffffff"/>
				</svg>`
		},
		rmb: {
			title: 'Right Mouse Button (Rotate / Context Menu)',
			type: 'mouse',
			mouseButton: 2,
			svg: `
				<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
					<rect x="7" y="3" width="22" height="30" rx="11" stroke="#ffffff" stroke-width="2" fill="#14181f"/>
					<path d="M18 3C24.5 3 29 8 29 14V15H18V3Z" fill="#3e90ff"/>
					<line x1="18" y1="3" x2="18" y2="15" stroke="#ffffff" stroke-width="1.5"/>
					<line x1="7" y1="15" x2="29" y2="15" stroke="#ffffff" stroke-width="1.5"/>
					<circle cx="18" cy="10" r="1.5" fill="#ffffff"/>
				</svg>`
		},
		mmb: {
			title: 'Middle Mouse Button (Pan 3D View)',
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
			title: 'CTRL Modifier (Tap to Toggle ON/OFF)',
			type: 'modifier',
			label: 'CTRL',
			key: 'ctrl'
		},
		shift: {
			title: 'SHIFT Modifier (Tap to Toggle ON/OFF)',
			type: 'modifier',
			label: 'SHIFT',
			key: 'shift'
		},
		alt: {
			title: 'ALT Modifier (Tap to Toggle ON/OFF)',
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
	let isLayoutEditMode = false;
	let layoutBannerEl = null;
	let layoutActionsEl = null;

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
		} else if (def.type === 'modifier') {
			btn.innerHTML = modifierStates[key]
				? `<span class="mb-mod-label">${def.label}</span><span class="mb-mod-badge">ON</span>`
				: `<span class="mb-mod-label">${def.label}</span>`;
		} else {
			btn.textContent = def.label;
		}

		if (def.type === 'modifier' && modifierStates[key]) {
			btn.classList.add('modifier-active');
			btn.style.setProperty('background', '#2ecc71', 'important');
			btn.style.setProperty('border-color', '#27ae60', 'important');
			btn.style.setProperty('color', '#092613', 'important');
			btn.style.setProperty('box-shadow', '0 0 18px rgba(46, 204, 113, 0.95), 0 4px 12px rgba(0, 0, 0, 0.6)', 'important');
		}

		// Initial position
		const pos = buttonPositions[key] || { x: 30, y: 300 };
		const initX = Math.max(8, Math.min(window.innerWidth - 60, pos.x));
		const initY = Math.max(34, Math.min(window.innerHeight - 60, pos.y));
		btn.style.left = `${initX}px`;
		btn.style.top = `${initY}px`;

		// Touch handling: Strictly FIXED during normal mode, draggable ONLY during Edit Mode
		let startTouchX = 0, startTouchY = 0, startLeft = 0, startTop = 0;

		btn.addEventListener('touchstart', (e) => {
			e.preventDefault();
			e.stopPropagation();

			if (isLayoutEditMode) {
				const touch = e.touches[0];
				startTouchX = touch.clientX;
				startTouchY = touch.clientY;
				startLeft = btn.offsetLeft;
				startTop = btn.offsetTop;
				triggerHaptic(12);
				return;
			}

			// Normal Mode: Trigger action
			triggerHaptic(14);
			if (def.type !== 'modifier') {
				btn.classList.add('held');
			}

			if (def.type === 'modifier') {
				const nextState = !modifierStates[def.key];
				setModifierState(def.key, nextState);
			} else if (def.type === 'action') {
				if (typeof def.action === 'function') def.action();
			} else if (def.type === 'mouse') {
				// Mouse down simulation on 3D canvas or center target
				dispatchCanvasMouseEvent('mousedown', def.mouseButton);
			}
		}, { passive: false });

		btn.addEventListener('touchmove', (e) => {
			e.preventDefault();
			e.stopPropagation();

			if (!isLayoutEditMode) return; // Do NOT move buttons during normal use!

			const touch = e.touches[0];
			const deltaX = touch.clientX - startTouchX;
			const deltaY = touch.clientY - startTouchY;
			const newLeft = Math.max(6, Math.min(window.innerWidth - 58, startLeft + deltaX));
			const newTop = Math.max(34, Math.min(window.innerHeight - 58, startTop + deltaY));

			btn.style.left = `${newLeft}px`;
			btn.style.top = `${newTop}px`;
		}, { passive: false });

		btn.addEventListener('touchend', (e) => {
			e.preventDefault();
			e.stopPropagation();

			if (isLayoutEditMode) return;

			btn.classList.remove('held');

			if (def.type === 'mouse') {
				dispatchCanvasMouseEvent('mouseup', def.mouseButton);
				if (def.mouseButton === 0) {
					dispatchCanvasMouseEvent('click', 0);
				} else if (def.mouseButton === 2) {
					dispatchCanvasMouseEvent('contextmenu', 2);
				}
			}
		}, { passive: false });

		document.body.appendChild(btn);
		renderedButtons[key] = btn;
	}

	function dispatchCanvasMouseEvent(type, button) {
		const target = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) || document.body;
		const ev = new MouseEvent(type, {
			clientX: window.innerWidth / 2,
			clientY: window.innerHeight / 2,
			button: button,
			buttons: button === 0 ? 1 : (button === 2 ? 2 : 4),
			ctrlKey: modifierStates.ctrl,
			shiftKey: modifierStates.shift,
			altKey: modifierStates.alt,
			bubbles: true,
			cancelable: true
		});
		target.dispatchEvent(ev);
	}

	// -------------------------------------------------------------
	// 5. Layout Edit Mode (Reposition & Lock Buttons)
	// -------------------------------------------------------------
	function startLayoutEditMode() {
		isLayoutEditMode = true;

		// Add highlight to buttons
		Object.values(renderedButtons).forEach((btn) => {
			btn.classList.add('in-edit-mode');
		});

		// Banner
		if (!layoutBannerEl) {
			layoutBannerEl = document.createElement('div');
			layoutBannerEl.id = 'mb-layout-edit-banner';
			layoutBannerEl.textContent = 'Layout Edit Mode: Drag buttons to desired positions';
			document.body.appendChild(layoutBannerEl);
		}
		layoutBannerEl.style.display = 'block';

		// Action bar (Save / Cancel)
		if (!layoutActionsEl) {
			layoutActionsEl = document.createElement('div');
			layoutActionsEl.id = 'mb-layout-edit-actions';
			layoutActionsEl.innerHTML = `
				<button class="mb-layout-action-btn cancel" id="mb-btn-cancel-layout">Cancel</button>
				<button class="mb-layout-action-btn save" id="mb-btn-save-layout">Save Layout</button>
			`;
			document.body.appendChild(layoutActionsEl);

			document.getElementById('mb-btn-save-layout').addEventListener('click', saveAndExitEditMode);
			document.getElementById('mb-btn-cancel-layout').addEventListener('click', cancelAndExitEditMode);
		}
		layoutActionsEl.style.display = 'flex';
	}

	function saveAndExitEditMode() {
		// Record current positions
		Object.keys(renderedButtons).forEach((key) => {
			const btn = renderedButtons[key];
			if (btn) {
				buttonPositions[key] = {
					x: btn.offsetLeft,
					y: btn.offsetTop
				};
			}
		});

		saveButtonPositions(buttonPositions);
		exitLayoutEditMode();
		triggerHaptic(20);
	}

	function cancelAndExitEditMode() {
		// Restore previous positions
		buttonPositions = loadButtonPositions();
		Object.keys(renderedButtons).forEach((key) => {
			const btn = renderedButtons[key];
			const pos = buttonPositions[key];
			if (btn && pos) {
				btn.style.left = `${pos.x}px`;
				btn.style.top = `${pos.y}px`;
			}
		});
		exitLayoutEditMode();
	}

	function exitLayoutEditMode() {
		isLayoutEditMode = false;

		Object.values(renderedButtons).forEach((btn) => {
			btn.classList.remove('in-edit-mode');
		});

		if (layoutBannerEl) layoutBannerEl.style.display = 'none';
		if (layoutActionsEl) layoutActionsEl.style.display = 'none';
	}

	function applyButtonPreset(presetName) {
		const w = window.innerWidth || 800;
		const h = window.innerHeight || 600;

		if (presetName === 'split') {
			buttonPositions = {
				lmb: { x: w - 70, y: h - 140 },
				rmb: { x: w - 70, y: h - 74 },
				mmb: { x: w - 130, y: h - 74 },
				undo: { x: 18, y: 44 },
				redo: { x: 76, y: 44 },
				ctrl: { x: 18, y: h - 74 },
				shift: { x: 76, y: h - 74 },
				alt: { x: 18, y: h - 134 },
				space: { x: 76, y: h - 134 },
				del: { x: w - 130, y: h - 140 }
			};
		} else if (presetName === 'dock_right') {
			buttonPositions = {
				lmb: { x: w - 70, y: h - 210 },
				rmb: { x: w - 70, y: h - 144 },
				mmb: { x: w - 70, y: h - 78 },
				ctrl: { x: w - 130, y: h - 210 },
				shift: { x: w - 130, y: h - 144 },
				alt: { x: w - 130, y: h - 78 },
				undo: { x: w - 190, y: h - 144 },
				redo: { x: w - 190, y: h - 78 },
				space: { x: w - 190, y: h - 210 },
				del: { x: w - 70, y: 44 }
			};
		} else if (presetName === 'dock_left') {
			buttonPositions = {
				lmb: { x: 18, y: h - 210 },
				rmb: { x: 18, y: h - 144 },
				mmb: { x: 18, y: h - 78 },
				ctrl: { x: 78, y: h - 210 },
				shift: { x: 78, y: h - 144 },
				alt: { x: 78, y: h - 78 },
				undo: { x: 138, y: h - 144 },
				redo: { x: 138, y: h - 78 },
				space: { x: 138, y: h - 210 },
				del: { x: 18, y: 44 }
			};
		} else {
			buttonPositions = getDefaultPositions();
		}

		saveButtonPositions(buttonPositions);
		renderAllFloatingButtons();
		triggerHaptic(16);
	}

	// -------------------------------------------------------------
	// 6. UI Scale & Fullscreen
	// -------------------------------------------------------------
	function applyUiScale() {
		try {
			const scale = Number(config.uiScale || 100) / 100;
			document.documentElement.style.setProperty('--ui-scale', scale);
			document.body.style.zoom = scale === 1 ? '' : scale;
		} catch (e) {}
	}

	function toggleFullscreen() {
		triggerHaptic(18);
		if (window.AndroidBridge && window.AndroidBridge.toggleFullscreen) {
			window.AndroidBridge.toggleFullscreen();
		} else {
			if (!document.fullscreenElement) {
				document.documentElement.requestFullscreen().catch(() => {});
			} else {
				document.exitFullscreen().catch(() => {});
			}
		}
	}

	// -------------------------------------------------------------
	// 7. Quick Settings Modal
	// -------------------------------------------------------------
	function openSettingsModal() {
		const modal = document.getElementById('mb-settings-modal');
		if (modal) modal.style.display = 'block';
		triggerHaptic(12);
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

			<div class="mb-section-title">Controller Button Layout</div>
			<div style="font-size:11.5px; color:var(--mb-text-dim); margin-bottom:6px;">
				Buttons are locked in place during modeling. Tap below to reposition them.
			</div>
			<button class="mb-edit-layout-btn" id="mb-btn-edit-layout">Edit Button Layout (Drag to Position)</button>

			<div style="margin-top:10px;">
				<span class="mb-setting-label" style="font-size:11px; font-weight:bold;">Layout Presets:</span>
				<div class="mb-presets-container">
					<button class="mb-preset-btn" id="mb-preset-split">Split Hands</button>
					<button class="mb-preset-btn" id="mb-preset-right">Dock Right</button>
					<button class="mb-preset-btn" id="mb-preset-left">Dock Left</button>
					<button class="mb-preset-btn" id="mb-preset-reset">Reset Defaults</button>
				</div>
			</div>

			<div class="mb-section-title">Toggle Active Buttons</div>
			<div class="mb-button-grid" id="mb-button-checkboxes"></div>

			<div class="mb-section-title">Display & Performance</div>
			<div class="mb-setting-row">
				<span class="mb-setting-label">Target Refresh Rate:</span>
				<select class="mb-setting-select" id="mb-set-fps">
					<option value="60">60 FPS</option>
					<option value="90">90 FPS</option>
					<option value="120">120 FPS</option>
					<option value="uncapped">Uncapped</option>
				</select>
			</div>

			<div class="mb-setting-row">
				<span class="mb-setting-label">Show Realtime FPS Counter:</span>
				<input type="checkbox" id="mb-set-showfps">
			</div>

			<div class="mb-setting-row">
				<span class="mb-setting-label">Haptic Vibration:</span>
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

		document.getElementById('mb-btn-edit-layout').addEventListener('click', () => {
			modal.style.display = 'none';
			startLayoutEditMode();
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

		// Preset buttons
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

		// Haptics
		const hapticCb = document.getElementById('mb-set-haptics');
		hapticCb.checked = config.enableHaptics;
		hapticCb.addEventListener('change', (e) => {
			config.enableHaptics = e.target.checked;
			saveConfig();
		});

		// UI Scale
		const uiScaleInput = document.getElementById('mb-set-uiscale');
		uiScaleInput.addEventListener('input', (e) => {
			config.uiScale = Number(e.target.value);
			applyUiScale();
			saveConfig();
		});
	}

	// -------------------------------------------------------------
	// 8. Auto-Save Daemon
	// -------------------------------------------------------------
	function startAutoSaveDaemon() {
		setInterval(() => {
			try {
				if (window.ModelProject && typeof window.ModelProject.save === 'function') {
					window.ModelProject.save();
				}
			} catch (e) {}
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
		fpsCounter.title = 'Click to toggle FPS';
		if (config.showFps) fpsCounter.style.display = 'block';
		fpsCounter.addEventListener('click', () => toggleFpsDisplay());
		document.body.appendChild(fpsCounter);

		// Header Buttons Integration
		const nativeFpsBtn = document.getElementById('btn_native_toggle_fps');
		if (nativeFpsBtn) {
			nativeFpsBtn.classList.toggle('active', config.showFps);
			nativeFpsBtn.addEventListener('click', () => toggleFpsDisplay());
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

		// Quick Settings Modal
		createQuickSettingsModal();

		// Apply UI Scale
		applyUiScale();

		// Synchronize Modifiers & Event Interception
		hookPressingGlobal();
		installModifierEventCapture();
		setInterval(hookPressingGlobal, 800);

		// Sync Native High Refresh Rate
		syncRefreshRateWithNative();
	}

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
		openSettings: openSettingsModal,
		toggleFps: toggleFpsDisplay,
		toggleFullscreen: toggleFullscreen,
		startEditLayout: startLayoutEditMode,
		setModifier: setModifierState
	};
})();
