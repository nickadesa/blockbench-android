/**
 * AI Provider Client Layer for Blockbench Mod Mobile
 * Supports Google Gemini, Groq, Cloudflare Workers AI, FreeLLMAPI, OpenRouter, and OpenAI
 * Dual transport: AndroidBridge native HTTP client (bypasses CORS/mixed-content) + Web Fetch fallback
 * Strictly no emojis and no third-party branding as requested.
 */

(function () {
	'use strict';

	const DEFAULT_PROVIDERS = {
		gemini: {
			name: 'Google Gemini (Official REST)',
			type: 'gemini',
			defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
			defaultModel: 'gemini-2.0-flash',
			models: [
				'gemini-2.0-flash',
				'gemini-2.5-flash',
				'gemini-1.5-pro',
				'gemini-1.5-flash'
			],
			description: 'Direct Google AI Studio API with high speed & vision'
		},
		groq: {
			name: 'Groq Cloud',
			type: 'openai_compatible',
			defaultBaseUrl: 'https://api.groq.com/openai/v1/chat/completions',
			defaultModel: 'llama-3.3-70b-versatile',
			models: [
				'llama-3.3-70b-versatile',
				'llama-3.1-8b-instant',
				'mixtral-8x7b-32768',
				'gemma2-9b-it',
				'deepseek-r1-distill-llama-70b'
			],
			description: 'Ultra-fast LPU inference engine'
		},
		cloudflare: {
			name: 'Cloudflare Workers AI',
			type: 'cloudflare',
			defaultBaseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions',
			defaultModel: '@cf/meta/llama-3.3-70b-instruct',
			models: [
				'@cf/meta/llama-3.3-70b-instruct',
				'@cf/meta/llama-3.1-8b-instruct',
				'@cf/qwen/qwen2.5-coder-32b-instruct',
				'@cf/deepseek-ai/deepseek-r1-distill-qwen-32b'
			],
			description: 'Edge-hosted AI models on Cloudflare global network'
		},
		freellmapi: {
			name: 'FreeLLMAPI (Relay / Local)',
			type: 'openai_compatible',
			defaultBaseUrl: 'http://localhost:3001/v1/chat/completions',
			defaultModel: 'gemini-2.0-flash',
			models: [
				'gemini-2.0-flash',
				'llama-3.3-70b-versatile',
				'gpt-4o-mini',
				'claude-3-5-sonnet',
				'deepseek-r1'
			],
			description: 'OpenAI-compatible aggregator with 34 free providers'
		},
		openrouter: {
			name: 'OpenRouter',
			type: 'openai_compatible',
			defaultBaseUrl: 'https://openrouter.ai/api/v1/chat/completions',
			defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
			models: [
				'meta-llama/llama-3.3-70b-instruct:free',
				'google/gemini-2.0-flash-exp:free',
				'deepseek/deepseek-r1:free',
				'mistralai/mistral-7b-instruct:free'
			],
			description: 'Universal model aggregator with free and premium tiers'
		},
		openai: {
			name: 'OpenAI',
			type: 'openai_compatible',
			defaultBaseUrl: 'https://api.openai.com/v1/chat/completions',
			defaultModel: 'gpt-4o-mini',
			models: [
				'gpt-4o-mini',
				'gpt-4o',
				'o3-mini'
			],
			description: 'Official OpenAI API endpoint'
		},
		custom: {
			name: 'Custom OpenAI Endpoint',
			type: 'openai_compatible',
			defaultBaseUrl: 'http://localhost:11434/v1/chat/completions',
			defaultModel: 'llama3',
			models: ['llama3', 'mistral', 'qwen2.5'],
			description: 'Local Ollama, vLLM, or custom reverse proxy'
		}
	};

	function detectProviderFromKey(rawKey) {
		if (!rawKey || typeof rawKey !== 'string') return null;
		const key = rawKey.trim();
		if (key.startsWith('AIzaSy')) {
			return 'gemini';
		}
		if (key.startsWith('gsk_')) {
			return 'groq';
		}
		if (key.startsWith('sk-or-')) {
			return 'openrouter';
		}
		if (key.startsWith('sk-') && !key.startsWith('sk-or-')) {
			return 'openai';
		}
		if (key.includes(':') && (key.length >= 50 || key.length === 73)) {
			return 'cloudflare';
		}
		if (/^[a-f0-9]{32}$/i.test(key)) {
			return 'cloudflare';
		}
		return null;
	}

	async function safeHttpRequest(url, method = 'POST', headers = {}, body = null) {
		const bodyStr = typeof body === 'object' ? JSON.stringify(body) : (body || '');

		// Prioritize AndroidBridge native HTTP client on Android to bypass CORS & WebView restrictions
		if (window.AndroidBridge && typeof window.AndroidBridge.executeHttpRequest === 'function') {
			try {
				const raw = window.AndroidBridge.executeHttpRequest(url, method, JSON.stringify(headers), bodyStr);
				if (raw) {
					const res = JSON.parse(raw);
					if (res.status >= 200 && res.status < 300) {
						try {
							return JSON.parse(res.body);
						} catch (e) {
							return { text: res.body };
						}
					} else if (res.status > 0) {
						throw new Error(`API Error (${res.status}): ${res.body || 'Request failed'}`);
					} else if (res.error) {
						throw new Error(`Network Error: ${res.error}`);
					}
				}
			} catch (bridgeErr) {
				console.warn('Native HTTP bridge error, attempting standard fetch:', bridgeErr);
				if (bridgeErr.message && !bridgeErr.message.includes('fetch')) {
					throw bridgeErr;
				}
			}
		}

		// Standard fetch fallback
		const response = await fetch(url, {
			method: method,
			headers: headers,
			body: bodyStr || undefined
		});

		if (!response.ok) {
			const errText = await response.text();
			throw new Error(`API Error (${response.status}): ${errText}`);
		}

		return await response.json();
	}

	// Declarations for MCP-like tools passed to LLM
	const TOOL_DEFINITIONS = [
		{
			name: 'create_cubes',
			description: 'Create one or more 3D voxel cubes in the Blockbench scene with exact coordinates and dimensions.',
			parameters: {
				type: 'object',
				properties: {
					cubes: {
						type: 'array',
						description: 'List of cubes to create',
						items: {
							type: 'object',
							properties: {
								name: { type: 'string', description: 'Name of the cube element' },
								from: {
									type: 'array',
									items: { type: 'number' },
									description: 'Starting [X, Y, Z] coordinate in Blockbench units (16 units = 1 block, Y is up)'
								},
								to: {
									type: 'array',
									items: { type: 'number' },
									description: 'Ending [X, Y, Z] coordinate in Blockbench units'
								},
								color: { type: 'integer', description: 'Color tag integer index from 0 to 7' },
								group: { type: 'string', description: 'Parent group or bone name' }
							},
							required: ['from', 'to']
						}
					}
				},
				required: ['cubes']
			}
		},
		{
			name: 'create_groups',
			description: 'Create hierarchical groups or bones with pivot points for rigging and organization.',
			parameters: {
				type: 'object',
				properties: {
					groups: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								name: { type: 'string', description: 'Group name' },
								origin: {
									type: 'array',
									items: { type: 'number' },
									description: 'Pivot coordinate [X, Y, Z]'
								},
								parent: { type: 'string', description: 'Parent group name (optional)' }
							},
							required: ['name', 'origin']
						}
					}
				},
				required: ['groups']
			}
		},
		{
			name: 'paint_texture',
			description: 'Generate or paint pixel art texture onto active mesh faces or create a new texture canvas.',
			parameters: {
				type: 'object',
				properties: {
					texture_name: { type: 'string', description: 'Name of texture' },
					width: { type: 'integer', description: 'Width in pixels (e.g. 16, 32, 64)' },
					height: { type: 'integer', description: 'Height in pixels (e.g. 16, 32, 64)' },
					palette: {
						type: 'array',
						items: { type: 'string' },
						description: 'Hex colors used for shading'
					},
					pixels: {
						type: 'array',
						description: 'Optional pixel operations array of [x, y, hex_color]',
						items: {
							type: 'array',
							items: { type: 'string' }
						}
					}
				},
				required: ['texture_name', 'width', 'height']
			}
		},
		{
			name: 'create_animation',
			description: 'Create skeletal keyframe animation sequences (e.g., idle, walk, run, attack).',
			parameters: {
				type: 'object',
				properties: {
					name: { type: 'string', description: 'Animation name (e.g. walk, idle)' },
					length: { type: 'number', description: 'Animation length in seconds' },
					loop: { type: 'string', enum: ['once', 'hold', 'loop'], description: 'Loop mode' },
					animators: {
						type: 'object',
						description: 'Map of bone names to rotation/position keyframe arrays'
					}
				},
				required: ['name', 'length']
			}
		},
		{
			name: 'inspect_scene',
			description: 'Inspect the current scene elements, cubes, textures, and groups to inform modeling decisions.',
			parameters: {
				type: 'object',
				properties: {
					include_hierarchy: { type: 'boolean', description: 'Whether to include full hierarchy' }
				}
			}
		},
		{
			name: 'execute_script',
			description: 'Execute arbitrary Blockbench JavaScript API script inside a transactional Undo wrapper.',
			parameters: {
				type: 'object',
				properties: {
					code: { type: 'string', description: 'Blockbench JavaScript code snippet' }
				},
				required: ['code']
			}
		}
	];

	class AIProvider {
		constructor() {
			this.settingsKey = 'mb_ai_provider_settings';
			this.config = {
				activeProvider: 'gemini',
				apiKey: '',
				baseUrl: '',
				model: 'gemini-2.0-flash',
				cloudflareAccountId: '',
				systemPrompt: 'You are an expert 3D voxel modeling, pixel-art texture artist, and animator assistant for Blockbench Mod Mobile. You generate 3D models with proper proportions, clean hierarchy, and accurate textures using the provided tools. Coordinate convention: 16 units = 1 block, Y is up, [0, 0, 0] is ground origin.'
			};
			this.loadConfig();
		}

		loadConfig() {
			try {
				const saved = localStorage.getItem(this.settingsKey);
				if (saved) {
					Object.assign(this.config, JSON.parse(saved));
				}
			} catch (e) {
				console.warn('Could not load AI config', e);
			}

			if (!this.config.baseUrl && DEFAULT_PROVIDERS[this.config.activeProvider]) {
				this.config.baseUrl = DEFAULT_PROVIDERS[this.config.activeProvider].defaultBaseUrl;
			}
			if (!this.config.model && DEFAULT_PROVIDERS[this.config.activeProvider]) {
				this.config.model = DEFAULT_PROVIDERS[this.config.activeProvider].defaultModel;
			}
		}

		saveConfig() {
			try {
				localStorage.setItem(this.settingsKey, JSON.stringify(this.config));
			} catch (e) {}
		}

		getProviderInfo() {
			return DEFAULT_PROVIDERS[this.config.activeProvider] || DEFAULT_PROVIDERS.gemini;
		}

		getToolDefinitions() {
			return TOOL_DEFINITIONS;
		}

		async testConnection() {
			const provider = this.getProviderInfo();
			if (!this.config.apiKey && provider.type !== 'custom') {
				throw new Error('API key is missing');
			}
			const testMsg = [{ role: 'user', content: 'Ping' }];
			if (provider.type === 'gemini') {
				return await this.callGeminiAPI({ messages: testMsg, tools: false });
			} else if (provider.type === 'cloudflare') {
				return await this.callCloudflareAPI({ messages: testMsg, tools: false });
			} else {
				return await this.callOpenAICompatibleAPI({ messages: testMsg, tools: false });
			}
		}

		async sendChat({ messages, images = [], tools = true }) {
			const provider = this.getProviderInfo();
			if (!this.config.apiKey && provider.type !== 'custom') {
				throw new Error('API key is missing. Please set your API key in the AI Assistant settings.');
			}

			if (provider.type === 'gemini') {
				return this.callGeminiAPI({ messages, images, tools });
			} else if (provider.type === 'cloudflare') {
				return this.callCloudflareAPI({ messages, images, tools });
			} else {
				return this.callOpenAICompatibleAPI({ messages, images, tools });
			}
		}

		async callCloudflareAPI({ messages, images = [], tools = true }) {
			let accountId = this.config.cloudflareAccountId || '';
			let apiToken = this.config.apiKey || '';

			if (apiToken.includes(':')) {
				const parts = apiToken.split(':');
				accountId = accountId || parts[0].trim();
				apiToken = parts[1].trim();
			}

			if (!accountId) {
				throw new Error('Cloudflare Account ID is required. Please set it in Settings.');
			}

			const model = this.config.model || '@cf/meta/llama-3.3-70b-instruct';
			const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
			const headers = {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiToken}`
			};

			const formattedMessages = [];
			if (this.config.systemPrompt) {
				formattedMessages.push({ role: 'system', content: this.config.systemPrompt });
			}
			messages.forEach((msg) => {
				formattedMessages.push({ role: msg.role, content: msg.content });
			});

			const bodyPayload = {
				model: model,
				messages: formattedMessages
			};

			const data = await safeHttpRequest(url, 'POST', headers, bodyPayload);
			const choice = data.choices && data.choices[0];
			if (!choice) throw new Error('No response choices returned by Cloudflare');

			const message = choice.message || {};
			const extracted = this.extractToolsFromText(message.content || '');

			return {
				text: message.content || '',
				toolCalls: extracted,
				raw: data
			};
		}

		async callOpenAICompatibleAPI({ messages, images = [], tools = true }) {
			const url = this.config.baseUrl || DEFAULT_PROVIDERS[this.config.activeProvider].defaultBaseUrl;
			const headers = {
				'Content-Type': 'application/json'
			};
			if (this.config.apiKey) {
				headers['Authorization'] = `Bearer ${this.config.apiKey}`;
			}

			const formattedMessages = [];
			if (this.config.systemPrompt) {
				formattedMessages.push({
					role: 'system',
					content: this.config.systemPrompt
				});
			}

			messages.forEach((msg, idx) => {
				const isLast = idx === messages.length - 1;
				if (isLast && msg.role === 'user' && images.length > 0) {
					const contentArray = [{ type: 'text', text: msg.content }];
					images.slice(0, 5).forEach((imgData) => {
						const cleanUrl = imgData.startsWith('data:') ? imgData : `data:image/png;base64,${imgData}`;
						contentArray.push({
							type: 'image_url',
							image_url: { url: cleanUrl }
						});
					});
					formattedMessages.push({ role: 'user', content: contentArray });
				} else {
					formattedMessages.push({ role: msg.role, content: msg.content });
				}
			});

			const bodyPayload = {
				model: this.config.model || 'gemini-2.0-flash',
				messages: formattedMessages
			};

			if (tools) {
				bodyPayload.tools = TOOL_DEFINITIONS.map((tool) => ({
					type: 'function',
					function: {
						name: tool.name,
						description: tool.description,
						parameters: tool.parameters
					}
				}));
				bodyPayload.tool_choice = 'auto';
			}

			const data = await safeHttpRequest(url, 'POST', headers, bodyPayload);
			const choice = data.choices && data.choices[0];
			if (!choice) throw new Error('No response choices returned by model');

			const message = choice.message || {};
			const toolCalls = [];

			if (message.tool_calls && message.tool_calls.length > 0) {
				message.tool_calls.forEach((tc) => {
					try {
						const args = typeof tc.function.arguments === 'string'
							? JSON.parse(tc.function.arguments)
							: tc.function.arguments;
						toolCalls.push({
							id: tc.id,
							name: tc.function.name,
							args: args
						});
					} catch (e) {
						console.warn('Failed to parse tool call args', tc, e);
					}
				});
			}

			if (toolCalls.length === 0 && message.content) {
				const extracted = this.extractToolsFromText(message.content);
				toolCalls.push(...extracted);
			}

			return {
				text: message.content || '',
				toolCalls: toolCalls,
				raw: data
			};
		}

		async callGeminiAPI({ messages, images = [], tools = true }) {
			const model = this.config.model || 'gemini-2.0-flash';
			const apiKey = this.config.apiKey;
			const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

			const contents = [];
			messages.forEach((msg, idx) => {
				const isLast = idx === messages.length - 1;
				const parts = [];

				if (isLast && msg.role === 'user' && images.length > 0) {
					parts.push({ text: msg.content });
					images.slice(0, 5).forEach((imgData) => {
						let mimeType = 'image/png';
						let base64 = imgData;
						if (imgData.startsWith('data:')) {
							const comma = imgData.indexOf(',');
							mimeType = imgData.substring(5, comma).split(';')[0] || 'image/png';
							base64 = imgData.substring(comma + 1);
						}
						parts.push({
							inlineData: {
								mimeType: mimeType,
								data: base64
							}
						});
					});
				} else {
					parts.push({ text: msg.content });
				}

				contents.push({
					role: msg.role === 'assistant' ? 'model' : 'user',
					parts: parts
				});
			});

			const bodyPayload = {
				contents: contents
			};

			if (this.config.systemPrompt) {
				bodyPayload.systemInstruction = {
					parts: [{ text: this.config.systemPrompt }]
				};
			}

			if (tools) {
				bodyPayload.tools = [{
					functionDeclarations: TOOL_DEFINITIONS.map((tool) => ({
						name: tool.name,
						description: tool.description,
						parameters: tool.parameters
					}))
				}];
			}

			const data = await safeHttpRequest(url, 'POST', { 'Content-Type': 'application/json' }, bodyPayload);
			const candidate = data.candidates && data.candidates[0];
			if (!candidate || !candidate.content) {
				throw new Error('No candidate content returned by Gemini');
			}

			const parts = candidate.content.parts || [];
			let textOutput = '';
			const toolCalls = [];

			parts.forEach((p) => {
				if (p.text) {
					textOutput += p.text;
				}
				if (p.functionCall) {
					toolCalls.push({
						name: p.functionCall.name,
						args: p.functionCall.args || {}
					});
				}
			});

			if (toolCalls.length === 0 && textOutput) {
				const extracted = this.extractToolsFromText(textOutput);
				toolCalls.push(...extracted);
			}

			return {
				text: textOutput,
				toolCalls: toolCalls,
				raw: data
			};
		}

		extractToolsFromText(text) {
			const results = [];
			const codeBlockRegex = /```(?:json|blockbench)?\s*([\s\S]*?)```/g;
			let match;
			while ((match = codeBlockRegex.exec(text)) !== null) {
				const code = match[1].trim();
				try {
					const parsed = JSON.parse(code);
					if (parsed.tool && parsed.args) {
						results.push({ name: parsed.tool, args: parsed.args });
					} else if (parsed.action && parsed.params) {
						results.push({ name: parsed.action, args: parsed.params });
					} else if (Array.isArray(parsed) && parsed[0] && parsed[0].from && parsed[0].to) {
						results.push({ name: 'create_cubes', args: { cubes: parsed } });
					} else if (parsed.cubes && Array.isArray(parsed.cubes)) {
						results.push({ name: 'create_cubes', args: parsed });
					}
				} catch (e) {}
			}
			return results;
		}
	}

	window.DEFAULT_PROVIDERS = DEFAULT_PROVIDERS;
	window.detectProviderFromKey = detectProviderFromKey;
	window.AIProvider = new AIProvider();
})();
