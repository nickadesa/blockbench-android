/**
 * AI Provider Client Layer for Blockbench Android
 * Supports FreeLLMAPI, OpenRouter, Groq, OpenAI, and Google Gemini
 * Strictly no emojis and no third-party branding as requested.
 */

(function () {
	'use strict';

	const DEFAULT_PROVIDERS = {
		freellmapi: {
			name: 'FreeLLMAPI (Relay / Local)',
			type: 'openai_compatible',
			defaultBaseUrl: 'http://localhost:3001/v1/chat/completions',
			defaultModel: 'gemini-2.0-flash',
			description: 'OpenAI-compatible aggregator with 34 free providers'
		},
		gemini: {
			name: 'Google Gemini (Official REST)',
			type: 'gemini',
			defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
			defaultModel: 'gemini-2.0-flash',
			description: 'Direct Google AI Studio API with high speed & vision'
		},
		openrouter: {
			name: 'OpenRouter',
			type: 'openai_compatible',
			defaultBaseUrl: 'https://openrouter.ai/api/v1/chat/completions',
			defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
			description: 'Universal model aggregator with free and premium tiers'
		},
		groq: {
			name: 'Groq Cloud',
			type: 'openai_compatible',
			defaultBaseUrl: 'https://api.groq.com/openai/v1/chat/completions',
			defaultModel: 'llama-3.3-70b-versatile',
			description: 'Ultra-fast LPU inference engine'
		},
		openai: {
			name: 'OpenAI',
			type: 'openai_compatible',
			defaultBaseUrl: 'https://api.openai.com/v1/chat/completions',
			defaultModel: 'gpt-4o-mini',
			description: 'Official OpenAI API endpoint'
		},
		custom: {
			name: 'Custom OpenAI Endpoint',
			type: 'openai_compatible',
			defaultBaseUrl: 'http://localhost:11434/v1/chat/completions',
			defaultModel: 'llama3',
			description: 'Local Ollama, vLLM, or custom reverse proxy'
		}
	};

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
								name: { type: 'string', description: 'Name of the cube element (e.g., head, torso, arm)' },
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
								parent: { type: 'string', description: 'Name of the parent group or bone' }
							},
							required: ['name', 'from', 'to']
						}
					}
				},
				required: ['cubes']
			}
		},
		{
			name: 'create_groups',
			description: 'Create hierarchical bone groups with pivot points for rigging and animation.',
			parameters: {
				type: 'object',
				properties: {
					groups: {
						type: 'array',
						description: 'List of groups to create',
						items: {
							type: 'object',
							properties: {
								name: { type: 'string', description: 'Name of the group/bone (e.g., root, head, left_leg)' },
								origin: {
									type: 'array',
									items: { type: 'number' },
									description: 'Pivot point [X, Y, Z] around which the bone rotates'
								},
								parent: { type: 'string', description: 'Parent group name (if nested)' }
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
			description: 'Paint pixel-art colors directly onto a texture canvas in the model.',
			parameters: {
				type: 'object',
				properties: {
					texture_name: { type: 'string', description: 'Target texture name' },
					width: { type: 'integer', description: 'Texture width in pixels (e.g. 16, 32, 64)' },
					height: { type: 'integer', description: 'Texture height in pixels (e.g. 16, 32, 64)' },
					pixels: {
						type: 'array',
						description: 'List of pixels to paint',
						items: {
							type: 'object',
							properties: {
								x: { type: 'integer', description: 'X pixel coordinate (0 to width - 1)' },
								y: { type: 'integer', description: 'Y pixel coordinate (0 to height - 1)' },
								color: { type: 'string', description: 'Hex color string (e.g. #3e90ff, #ff0000)' }
							},
							required: ['x', 'y', 'color']
						}
					}
				},
				required: ['pixels']
			}
		},
		{
			name: 'create_animation',
			description: 'Generate skeletal keyframe animation sequences (walk, run, attack, idle).',
			parameters: {
				type: 'object',
				properties: {
					name: { type: 'string', description: 'Animation name (e.g., walk, idle, attack)' },
					length: { type: 'number', description: 'Animation length in seconds' },
					loop: { type: 'boolean', description: 'Whether the animation loops' },
					keyframes: {
						type: 'array',
						description: 'List of keyframe points for bones',
						items: {
							type: 'object',
							properties: {
								bone: { type: 'string', description: 'Bone or group name' },
								time: { type: 'number', description: 'Keyframe timestamp in seconds' },
								channel: { type: 'string', enum: ['rotation', 'position', 'scale'], description: 'Transform channel' },
								values: {
									type: 'array',
									items: { type: 'number' },
									description: '[X, Y, Z] Euler angles in degrees or translation offsets'
								}
							},
							required: ['bone', 'time', 'channel', 'values']
						}
					}
				},
				required: ['name', 'length', 'keyframes']
			}
		},
		{
			name: 'inspect_scene',
			description: 'Inspect the current 3D outliner structure, bones, cubes, and textures to plan modifications.',
			parameters: {
				type: 'object',
				properties: {}
			}
		},
		{
			name: 'execute_script',
			description: 'Execute custom Blockbench JavaScript code safely within an undoable transaction.',
			parameters: {
				type: 'object',
				properties: {
					code: { type: 'string', description: 'JavaScript code snippet to run' }
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
				systemPrompt: 'You are an expert 3D voxel modeling, pixel-art texture artist, and animator assistant for Blockbench. You generate 3D models with proper proportions, clean hierarchy, and accurate textures using the provided tools. Coordinate convention: 16 units = 1 block, Y is up, [0, 0, 0] is ground origin.'
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
			return DEFAULT_PROVIDERS[this.config.activeProvider] || DEFAULT_PROVIDERS.freellmapi;
		}

		getToolDefinitions() {
			return TOOL_DEFINITIONS;
		}

		async sendChat({ messages, images = [], tools = true }) {
			const provider = this.getProviderInfo();
			if (!this.config.apiKey && provider.type !== 'custom') {
				throw new Error('API key is missing. Please set your API key in the AI Assistant settings.');
			}

			if (provider.type === 'gemini') {
				return this.callGeminiAPI({ messages, images, tools });
			} else {
				return this.callOpenAICompatibleAPI({ messages, images, tools });
			}
		}

		async callOpenAICompatibleAPI({ messages, images = [], tools = true }) {
			const url = this.config.baseUrl || DEFAULT_PROVIDERS[this.config.activeProvider].defaultBaseUrl;
			const headers = {
				'Content-Type': 'application/json'
			};
			if (this.config.apiKey) {
				headers['Authorization'] = `Bearer ${this.config.apiKey}`;
			}

			// Format conversation messages
			const formattedMessages = [];

			// System message
			if (this.config.systemPrompt) {
				formattedMessages.push({
					role: 'system',
					content: this.config.systemPrompt
				});
			}

			// Past history & user message
			messages.forEach((msg, idx) => {
				const isLast = idx === messages.length - 1;
				if (isLast && msg.role === 'user' && images.length > 0) {
					// Multimodal content
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

			const response = await fetch(url, {
				method: 'POST',
				headers: headers,
				body: JSON.stringify(bodyPayload)
			});

			if (!response.ok) {
				const errText = await response.text();
				throw new Error(`API Error (${response.status}): ${errText}`);
			}

			const data = await response.json();
			const choice = data.choices && data.choices[0];
			if (!choice) throw new Error('No response choices returned by model');

			const message = choice.message || {};
			const toolCalls = [];

			// Native tool calls extraction
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

			// Fallback: extract JSON tool calls embedded in markdown text
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

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(bodyPayload)
			});

			if (!response.ok) {
				const errText = await response.text();
				throw new Error(`Gemini API Error (${response.status}): ${errText}`);
			}

			const data = await response.json();
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

			// Fallback: extract embedded JSON
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
	window.AIProvider = new AIProvider();
})();
