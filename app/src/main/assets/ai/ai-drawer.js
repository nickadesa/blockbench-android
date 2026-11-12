/**
 * Mobile AI Assistant Drawer UI Manager
 * Handles slide-over drawer, 5-image reference uploads, settings, chat timeline, and tool result badges
 * Strictly no emojis and no third-party branding as requested.
 */

(function () {
	'use strict';

	let drawerEl = null;
	let backdropEl = null;
	let messagesContainer = null;
	let inputEl = null;
	let sendBtn = null;
	let imageStripEl = null;
	let fileInputEl = null;
	let settingsCardEl = null;

	const uploadedImages = []; // Base64 data strings (max 5)

	function initAIDrawer() {
		// Backdrop
		backdropEl = document.createElement('div');
		backdropEl.id = 'ai-drawer-backdrop';
		backdropEl.addEventListener('click', closeDrawer);
		document.body.appendChild(backdropEl);

		// Drawer
		drawerEl = document.createElement('div');
		drawerEl.id = 'ai-assistant-drawer';
		drawerEl.innerHTML = `
			<div class="ai-drawer-header">
				<div class="ai-header-title">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3e90ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="3" y="11" width="18" height="10" rx="2"></rect>
						<circle cx="12" cy="5" r="2"></circle>
						<path d="M12 7v4"></path>
						<line x1="8" y1="16" x2="8" y2="16"></line>
						<line x1="16" y1="16" x2="16" y2="16"></line>
					</svg>
					<span>AI 3D Assistant (BYOK)</span>
				</div>
				<div class="ai-header-actions">
					<button class="ai-icon-btn" id="ai-toggle-settings" title="Provider Settings">
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="3"></circle>
							<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
						</svg>
					</button>
					<button class="ai-icon-btn" id="ai-close-drawer" title="Close">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</div>
			</div>

			<!-- Settings Card -->
			<div id="ai-settings-card">
				<div class="ai-setting-field">
					<span class="ai-setting-label">AI Provider:</span>
					<select class="ai-setting-select" id="ai-provider-select">
						<option value="gemini">Google Gemini (Official REST)</option>
						<option value="freellmapi">FreeLLMAPI (Relay / Local)</option>
						<option value="openrouter">OpenRouter</option>
						<option value="groq">Groq Cloud</option>
						<option value="openai">OpenAI</option>
						<option value="custom">Custom OpenAI Endpoint</option>
					</select>
				</div>
				<div class="ai-setting-field">
					<span class="ai-setting-label">API Key (Stored locally on device):</span>
					<input type="password" class="ai-setting-input" id="ai-apikey-input" placeholder="Enter API Key">
				</div>
				<div class="ai-setting-field">
					<span class="ai-setting-label">Endpoint Base URL:</span>
					<input type="text" class="ai-setting-input" id="ai-baseurl-input" placeholder="https://...">
				</div>
				<div class="ai-setting-field">
					<span class="ai-setting-label">Model Name:</span>
					<input type="text" class="ai-setting-input" id="ai-model-input" placeholder="e.g. gemini-2.0-flash">
				</div>
				<div style="display:flex; justify-content:flex-end; margin-top:8px;">
					<button id="ai-save-settings-btn" style="background:var(--ai-accent); border:none; color:#fff; border-radius:6px; padding:6px 12px; font-size:11px; cursor:pointer;">Save Settings</button>
				</div>
			</div>

			<!-- Reference Images (Max 5) -->
			<div class="ai-image-strip" id="ai-image-strip">
				<button class="ai-upload-btn" id="ai-add-img-btn">+ Add Images (Max 5)</button>
				<input type="file" id="ai-file-input" multiple accept="image/*" style="display:none;">
				<div id="ai-thumbs-wrapper" style="display:flex; gap:6px;"></div>
			</div>

			<!-- Quick Commands -->
			<div class="ai-commands-strip">
				<button class="ai-cmd-pill" data-cmd="/plan ">/plan</button>
				<button class="ai-cmd-pill" data-cmd="/grillme ">/grillme</button>
				<button class="ai-cmd-pill" data-cmd="/model ">/model</button>
				<button class="ai-cmd-pill" data-cmd="/texture ">/texture</button>
				<button class="ai-cmd-pill" data-cmd="/animate ">/animate</button>
				<button class="ai-cmd-pill" data-cmd="/help">/help</button>
				<button class="ai-cmd-pill" data-cmd="/clear">/clear</button>
			</div>

			<!-- Messages Log -->
			<div class="ai-chat-messages" id="ai-chat-messages">
				<div class="ai-message assistant">
					Welcome to Blockbench AI Assistant. Provide a description or attach up to 5 reference images, then use commands like /plan, /grillme, /model, /texture, or /animate to build your model.
				</div>
			</div>

			<!-- Input Footer -->
			<div class="ai-drawer-footer">
				<textarea class="ai-chat-input" id="ai-chat-input" placeholder="Type prompt or /command..."></textarea>
				<button class="ai-send-btn" id="ai-send-btn">Send</button>
			</div>
		`;

		document.body.appendChild(drawerEl);

		// Cache DOM elements
		messagesContainer = document.getElementById('ai-chat-messages');
		inputEl = document.getElementById('ai-chat-input');
		sendBtn = document.getElementById('ai-send-btn');
		imageStripEl = document.getElementById('ai-image-strip');
		fileInputEl = document.getElementById('ai-file-input');
		settingsCardEl = document.getElementById('ai-settings-card');

		// Bind events
		document.getElementById('ai-close-drawer').addEventListener('click', closeDrawer);
		document.getElementById('ai-toggle-settings').addEventListener('click', toggleSettings);
		document.getElementById('ai-add-img-btn').addEventListener('click', () => fileInputEl.click());
		fileInputEl.addEventListener('change', handleFileSelection);
		sendBtn.addEventListener('click', handleSubmitMessage);

		inputEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				handleSubmitMessage();
			}
		});

		// Quick command pills
		document.querySelectorAll('.ai-cmd-pill').forEach((pill) => {
			pill.addEventListener('click', (e) => {
				const cmd = e.target.getAttribute('data-cmd');
				inputEl.value = cmd;
				inputEl.focus();
			});
		});

		// Provider Settings inputs
		const providerSelect = document.getElementById('ai-provider-select');
		const apiKeyInput = document.getElementById('ai-apikey-input');
		const baseUrlInput = document.getElementById('ai-baseurl-input');
		const modelInput = document.getElementById('ai-model-input');

		if (window.AIProvider) {
			providerSelect.value = window.AIProvider.config.activeProvider;
			apiKeyInput.value = window.AIProvider.config.apiKey || '';
			baseUrlInput.value = window.AIProvider.config.baseUrl || '';
			modelInput.value = window.AIProvider.config.model || '';
		}

		providerSelect.addEventListener('change', (e) => {
			const prov = e.target.value;
			if (window.DEFAULT_PROVIDERS && window.DEFAULT_PROVIDERS[prov]) {
				baseUrlInput.value = window.DEFAULT_PROVIDERS[prov].defaultBaseUrl;
				modelInput.value = window.DEFAULT_PROVIDERS[prov].defaultModel;
			}
		});

		document.getElementById('ai-save-settings-btn').addEventListener('click', () => {
			if (window.AIProvider) {
				window.AIProvider.config.activeProvider = providerSelect.value;
				window.AIProvider.config.apiKey = apiKeyInput.value.trim();
				window.AIProvider.config.baseUrl = baseUrlInput.value.trim();
				window.AIProvider.config.model = modelInput.value.trim();
				window.AIProvider.saveConfig();
				appendStatusMessage('Settings saved successfully.');
				toggleSettings();
			}
		});

		// Header trigger button
		const headerBtn = document.getElementById('btn_native_ai_assistant');
		if (headerBtn) {
			headerBtn.addEventListener('click', toggleDrawer);
		}
	}

	function toggleDrawer() {
		if (drawerEl && drawerEl.classList.contains('open')) {
			closeDrawer();
		} else {
			openDrawer();
		}
	}

	function openDrawer() {
		if (drawerEl) drawerEl.classList.add('open');
		if (backdropEl) backdropEl.classList.add('open');
		const headerBtn = document.getElementById('btn_native_ai_assistant');
		if (headerBtn) headerBtn.classList.add('active');
	}

	function closeDrawer() {
		if (drawerEl) drawerEl.classList.remove('open');
		if (backdropEl) backdropEl.classList.remove('open');
		const headerBtn = document.getElementById('btn_native_ai_assistant');
		if (headerBtn) headerBtn.classList.remove('active');
	}

	function toggleSettings() {
		if (settingsCardEl) {
			settingsCardEl.classList.toggle('open');
		}
	}

	function handleFileSelection(e) {
		const files = Array.from(e.target.files);
		if (!files || files.length === 0) return;

		files.forEach((file) => {
			if (uploadedImages.length >= 5) return;
			const reader = new FileReader();
			reader.onload = function (evt) {
				const rawDataUrl = evt.target.result;
				compressImage(rawDataUrl, 1024, 1024, (compressedDataUrl) => {
					if (uploadedImages.length < 5) {
						uploadedImages.push(compressedDataUrl);
						renderImageThumbnails();
					}
				});
			};
			reader.readAsDataURL(file);
		});

		fileInputEl.value = '';
	}

	function compressImage(dataUrl, maxW, maxH, callback) {
		const img = new Image();
		img.onload = function () {
			let w = img.width;
			let h = img.height;
			if (w > maxW || h > maxH) {
				if (w > h) {
					h = Math.round((h * maxW) / w);
					w = maxW;
				} else {
					w = Math.round((w * maxH) / h);
					h = maxH;
				}
			}
			const canvas = document.createElement('canvas');
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(img, 0, 0, w, h);
			callback(canvas.toDataURL('image/jpeg', 0.85));
		};
		img.src = dataUrl;
	}

	function renderImageThumbnails() {
		const wrapper = document.getElementById('ai-thumbs-wrapper');
		if (!wrapper) return;
		wrapper.innerHTML = '';

		uploadedImages.forEach((imgSrc, idx) => {
			const container = document.createElement('div');
			container.className = 'ai-img-thumb-container';
			container.innerHTML = `
				<img src="${imgSrc}" class="ai-img-thumb" alt="ref">
				<button class="ai-img-remove-btn" data-idx="${idx}">
					<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			`;
			container.querySelector('button').addEventListener('click', () => {
				uploadedImages.splice(idx, 1);
				renderImageThumbnails();
			});
			wrapper.appendChild(container);
		});
	}

	function appendMessage(role, text, toolResults = []) {
		if (!messagesContainer) return;
		const msgEl = document.createElement('div');
		msgEl.className = `ai-message ${role}`;

		// Simple markdown code formatting
		let formattedText = (text || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/\n/g, '<br>');

		msgEl.innerHTML = formattedText;

		// Append tool results badges if present
		if (Array.isArray(toolResults) && toolResults.length > 0) {
			toolResults.forEach((tr) => {
				const chip = document.createElement('div');
				chip.className = `ai-tool-chip ${tr.result && tr.result.success ? '' : 'error'}`;
				const summary = tr.result ? (tr.result.summary || tr.result.error || 'Done') : 'Executed';
				chip.textContent = `[${tr.toolName}]: ${summary}`;
				msgEl.appendChild(chip);
			});
		}

		messagesContainer.appendChild(msgEl);
		messagesContainer.scrollTop = messagesContainer.scrollHeight;
	}

	function appendStatusMessage(text) {
		if (!messagesContainer) return;
		const statusEl = document.createElement('div');
		statusEl.className = 'ai-message status';
		statusEl.textContent = text;
		messagesContainer.appendChild(statusEl);
		messagesContainer.scrollTop = messagesContainer.scrollHeight;
		return statusEl;
	}

	async function handleSubmitMessage() {
		const rawText = inputEl.value.trim();
		if (!rawText && uploadedImages.length === 0) return;

		inputEl.value = '';
		sendBtn.disabled = true;
		inputEl.disabled = true;

		// Display user message in chat
		appendMessage('user', rawText);

		const statusMsg = appendStatusMessage('Thinking...');

		try {
			const result = await window.AICommands.executePrompt({
				rawInput: rawText,
				images: [...uploadedImages],
				onStatusUpdate: (status) => {
					if (statusMsg) statusMsg.textContent = status;
				}
			});

			if (statusMsg) statusMsg.remove();
			appendMessage('assistant', result.text, result.toolResults);
		} catch (err) {
			if (statusMsg) statusMsg.remove();
			appendMessage('assistant', `Error: ${err.message || String(err)}`);
		} finally {
			sendBtn.disabled = false;
			inputEl.disabled = false;
			inputEl.focus();
		}
	}

	// Initialize when DOM ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initAIDrawer);
	} else {
		initAIDrawer();
	}

	window.AIDrawer = {
		open: openDrawer,
		close: closeDrawer,
		toggle: toggleDrawer
	};
})();
