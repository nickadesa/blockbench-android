/**
 * Mobile AI Assistant Drawer UI Manager for Blockbench Mod Mobile
 * Handles slide-over drawer, API key auto-detection (Gemini, Groq, Cloudflare, OpenRouter),
 * in-chat image attachments (up to 5), connection testing, and chat timeline
 * Strictly no emojis and no third-party branding as requested.
 */

(function () {
	'use strict';

	let drawerEl = null;
	let backdropEl = null;
	let messagesContainer = null;
	let inputEl = null;
	let sendBtn = null;
	let fileInputEl = null;
	let settingsCardEl = null;
	let attachedStripEl = null;

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
					<span class="ai-setting-label">API Key (Stored locally on device):</span>
					<input type="password" class="ai-setting-input" id="ai-apikey-input" placeholder="Paste Gemini, Groq, or Cloudflare Key">
					<div id="ai-detected-badge" class="ai-detected-badge" style="display:none;"></div>
				</div>
				<div class="ai-setting-field" id="ai-cf-account-row" style="display:none;">
					<span class="ai-setting-label">Cloudflare Account ID:</span>
					<input type="text" class="ai-setting-input" id="ai-cf-account-input" placeholder="e.g. 1a2b3c4d5e6f...">
				</div>
				<div class="ai-setting-field">
					<span class="ai-setting-label">AI Provider:</span>
					<select class="ai-setting-select" id="ai-provider-select">
						<option value="gemini">Google Gemini (Official REST)</option>
						<option value="groq">Groq Cloud (Fast LPU)</option>
						<option value="cloudflare">Cloudflare Workers AI</option>
						<option value="freellmapi">FreeLLMAPI (Relay / Local)</option>
						<option value="openrouter">OpenRouter</option>
						<option value="openai">OpenAI</option>
						<option value="custom">Custom OpenAI Endpoint</option>
					</select>
				</div>
				<div class="ai-setting-field">
					<span class="ai-setting-label">Model Selection:</span>
					<select class="ai-setting-select" id="ai-model-select"></select>
				</div>
				<div class="ai-setting-field">
					<span class="ai-setting-label">Endpoint Base URL:</span>
					<input type="text" class="ai-setting-input" id="ai-baseurl-input" placeholder="https://...">
				</div>
				<div class="ai-settings-actions">
					<button class="ai-test-btn" id="ai-test-connection-btn">Test Connection</button>
					<button class="ai-save-btn" id="ai-save-settings-btn">Save Settings</button>
				</div>
				<div id="ai-test-status" style="font-size:11px; margin-top:2px;"></div>
			</div>

			<!-- Quick Commands -->
			<div class="ai-commands-strip">
				<button class="ai-cmd-pill" data-cmd="/plan ">/plan</button>
				<button class="ai-cmd-pill" data-cmd="/grillme ">/grillme</button>
				<button class="ai-cmd-pill" data-cmd="/model ">/model</button>
				<button class="ai-cmd-pill" data-cmd="/texture ">/texture</button>
				<button class="ai-cmd-pill" data-cmd="/animate ">/animate</button>
				<button class="ai-cmd-pill" data-cmd="/clear">/clear</button>
				<button class="ai-cmd-pill" data-cmd="/help">/help</button>
			</div>

			<!-- Chat Timeline -->
			<div class="ai-chat-messages" id="ai-chat-messages">
				<div class="ai-message assistant">
					Hello! I am your AI 3D modeling assistant. You can prompt me to build voxel models (/model), paint pixel textures (/texture), or generate animations (/animate). Attach up to 5 reference images below.
				</div>
			</div>

			<!-- Input Footer & Image Attachments -->
			<div class="ai-drawer-footer">
				<div class="ai-attached-images-strip" id="ai-attached-images-strip"></div>
				<div class="ai-input-row">
					<button class="ai-attach-btn" id="ai-add-img-btn" title="Attach Images (Max 5)">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="12" y1="5" x2="12" y2="19"></line>
							<line x1="5" y1="12" x2="19" y2="12"></line>
						</svg>
					</button>
					<input type="file" id="ai-file-input" multiple accept="image/*" style="display:none;">
					<input type="text" class="ai-chat-input" id="ai-chat-input" placeholder="Type prompt or command...">
					<button class="ai-send-btn" id="ai-send-btn">Send</button>
				</div>
			</div>
		`;

		document.body.appendChild(drawerEl);

		messagesContainer = document.getElementById('ai-chat-messages');
		inputEl = document.getElementById('ai-chat-input');
		sendBtn = document.getElementById('ai-send-btn');
		fileInputEl = document.getElementById('ai-file-input');
		settingsCardEl = document.getElementById('ai-settings-card');
		attachedStripEl = document.getElementById('ai-attached-images-strip');

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

		// Settings controls
		setupSettingsCard();

		// Header trigger button
		const headerBtn = document.getElementById('btn_native_ai_assistant');
		if (headerBtn) {
			headerBtn.addEventListener('click', toggleDrawer);
		}
	}

	function setupSettingsCard() {
		const providerSelect = document.getElementById('ai-provider-select');
		const apiKeyInput = document.getElementById('ai-apikey-input');
		const baseUrlInput = document.getElementById('ai-baseurl-input');
		const modelSelect = document.getElementById('ai-model-select');
		const detectedBadge = document.getElementById('ai-detected-badge');
		const cfAccountRow = document.getElementById('ai-cf-account-row');
		const cfAccountInput = document.getElementById('ai-cf-account-input');
		const testBtn = document.getElementById('ai-test-connection-btn');
		const testStatus = document.getElementById('ai-test-status');

		function populateModelSelect(providerKey, selectedModel) {
			modelSelect.innerHTML = '';
			const provider = window.DEFAULT_PROVIDERS ? window.DEFAULT_PROVIDERS[providerKey] : null;
			const models = (provider && provider.models) ? provider.models : [selectedModel || 'default'];

			models.forEach((m) => {
				const opt = document.createElement('option');
				opt.value = m;
				opt.textContent = m;
				if (m === selectedModel) opt.selected = true;
				modelSelect.appendChild(opt);
			});

			if (!models.includes(selectedModel) && selectedModel) {
				const customOpt = document.createElement('option');
				customOpt.value = selectedModel;
				customOpt.textContent = selectedModel;
				customOpt.selected = true;
				modelSelect.appendChild(customOpt);
			}
		}

		function applyAutoDetection(key) {
			if (!window.detectProviderFromKey) return;
			const detected = window.detectProviderFromKey(key);
			if (detected && window.DEFAULT_PROVIDERS && window.DEFAULT_PROVIDERS[detected]) {
				const pInfo = window.DEFAULT_PROVIDERS[detected];
				detectedBadge.style.display = 'inline-block';
				detectedBadge.textContent = `Auto-Detected: ${pInfo.name}`;
				providerSelect.value = detected;
				baseUrlInput.value = pInfo.defaultBaseUrl;
				populateModelSelect(detected, pInfo.defaultModel);

				if (detected === 'cloudflare') {
					cfAccountRow.style.display = 'flex';
					if (key.includes(':')) {
						const parts = key.split(':');
						cfAccountInput.value = parts[0].trim();
					}
				} else {
					cfAccountRow.style.display = 'none';
				}
			} else {
				detectedBadge.style.display = 'none';
			}
		}

		if (window.AIProvider) {
			providerSelect.value = window.AIProvider.config.activeProvider || 'gemini';
			apiKeyInput.value = window.AIProvider.config.apiKey || '';
			baseUrlInput.value = window.AIProvider.config.baseUrl || '';
			cfAccountInput.value = window.AIProvider.config.cloudflareAccountId || '';
			populateModelSelect(providerSelect.value, window.AIProvider.config.model);

			if (providerSelect.value === 'cloudflare') {
				cfAccountRow.style.display = 'flex';
			}
			if (apiKeyInput.value) {
				applyAutoDetection(apiKeyInput.value);
			}
		}

		apiKeyInput.addEventListener('input', (e) => {
			applyAutoDetection(e.target.value);
		});

		providerSelect.addEventListener('change', (e) => {
			const prov = e.target.value;
			if (window.DEFAULT_PROVIDERS && window.DEFAULT_PROVIDERS[prov]) {
				baseUrlInput.value = window.DEFAULT_PROVIDERS[prov].defaultBaseUrl;
				populateModelSelect(prov, window.DEFAULT_PROVIDERS[prov].defaultModel);
			}
			cfAccountRow.style.display = prov === 'cloudflare' ? 'flex' : 'none';
		});

		testBtn.addEventListener('click', async () => {
			testStatus.textContent = 'Testing connection...';
			testStatus.style.color = '#3e90ff';
			try {
				if (window.AIProvider) {
					window.AIProvider.config.activeProvider = providerSelect.value;
					window.AIProvider.config.apiKey = apiKeyInput.value.trim();
					window.AIProvider.config.baseUrl = baseUrlInput.value.trim();
					window.AIProvider.config.model = modelSelect.value.trim();
					window.AIProvider.config.cloudflareAccountId = cfAccountInput.value.trim();
				}
				await window.AIProvider.testConnection();
				testStatus.textContent = 'Success: Connected to AI Provider!';
				testStatus.style.color = '#2ecc71';
			} catch (err) {
				testStatus.textContent = `Failed: ${err.message || String(err)}`;
				testStatus.style.color = '#e74c3c';
			}
		});

		document.getElementById('ai-save-settings-btn').addEventListener('click', () => {
			if (window.AIProvider) {
				window.AIProvider.config.activeProvider = providerSelect.value;
				window.AIProvider.config.apiKey = apiKeyInput.value.trim();
				window.AIProvider.config.baseUrl = baseUrlInput.value.trim();
				window.AIProvider.config.model = modelSelect.value.trim();
				window.AIProvider.config.cloudflareAccountId = cfAccountInput.value.trim();
				window.AIProvider.saveConfig();
			}
			toggleSettings();
		});
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
		const files = Array.from(e.target.files || []);
		if (!files.length) return;

		const remainingSlots = 5 - uploadedImages.length;
		if (remainingSlots <= 0) {
			alert('Maximum 5 reference images allowed');
			return;
		}

		const filesToProcess = files.slice(0, remainingSlots);

		filesToProcess.forEach((file) => {
			const reader = new FileReader();
			reader.onload = function (evt) {
				const dataUrl = evt.target.result;
				compressImage(dataUrl, 1024, 1024, (compressedDataUrl) => {
					if (uploadedImages.length < 5) {
						uploadedImages.push(compressedDataUrl);
						renderAttachedThumbnails();
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

	function renderAttachedThumbnails() {
		if (!attachedStripEl) return;
		attachedStripEl.innerHTML = '';

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
				renderAttachedThumbnails();
			});
			attachedStripEl.appendChild(container);
		});
	}

	function appendMessage(role, text, toolResults = [], images = []) {
		if (!messagesContainer) return;
		const msgEl = document.createElement('div');
		msgEl.className = `ai-message ${role}`;

		// If user message contains attached images, render thumbnails inside chat bubble
		if (Array.isArray(images) && images.length > 0) {
			const imgRow = document.createElement('div');
			imgRow.className = 'ai-msg-images';
			images.forEach((imgSrc) => {
				const img = document.createElement('img');
				img.className = 'ai-msg-thumb';
				img.src = imgSrc;
				imgRow.appendChild(img);
			});
			msgEl.appendChild(imgRow);
		}

		if (text) {
			const textNode = document.createElement('div');
			textNode.innerHTML = (text || '')
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/\n/g, '<br>');
			msgEl.appendChild(textNode);
		}

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

		const currentImages = [...uploadedImages];
		inputEl.value = '';
		uploadedImages.length = 0; // Clear attachment tray
		renderAttachedThumbnails();

		sendBtn.disabled = true;
		inputEl.disabled = true;

		// Display user message in chat along with thumbnail images
		appendMessage('user', rawText, null, currentImages);

		const statusMsg = appendStatusMessage('Thinking...');

		try {
			const result = await window.AICommands.executePrompt({
				rawInput: rawText,
				images: currentImages,
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
