/**
 * Slash Command Router & System Prompt Orchestrator
 * Supports /plan, /grillme, /model, /texture, /animate, /clear, and /help
 * Strictly no emojis and no third-party branding as requested.
 */

(function () {
	'use strict';

	const COMMAND_HELP = [
		{ cmd: '/plan [topic]', desc: 'Analyze reference images and formulate a structured 3D modeling roadmap.' },
		{ cmd: '/grillme [topic]', desc: 'Interactive interview mode: AI asks clarifying questions about format, dimensions, and palette.' },
		{ cmd: '/model [prompt]', desc: 'Generate 3D voxel cubes, bones, and hierarchy directly into the scene.' },
		{ cmd: '/texture [prompt]', desc: 'Paint pixel-art textures onto model UV faces or canvas.' },
		{ cmd: '/animate [prompt]', desc: 'Generate keyframe animation sequences for bones and groups.' },
		{ cmd: '/clear', desc: 'Clear conversation history from memory and chat window.' },
		{ cmd: '/help', desc: 'Display this command reference manual.' }
	];

	class AICommands {
		constructor() {
			this.history = [];
		}

		clearHistory() {
			this.history = [];
		}

		getHistory() {
			return this.history;
		}

		async executePrompt({ rawInput, images = [], onStatusUpdate }) {
			const input = (rawInput || '').trim();
			if (!input && images.length === 0) {
				throw new Error('Please enter a message or attach a reference image.');
			}

			// Local commands that do not call API
			if (input.toLowerCase() === '/clear') {
				this.clearHistory();
				return {
					text: 'Chat history cleared.',
					toolResults: []
				};
			}

			if (input.toLowerCase() === '/help') {
				const helpText = COMMAND_HELP.map((c) => `${c.cmd} - ${c.desc}`).join('\n\n');
				return {
					text: `Available Commands:\n\n${helpText}`,
					toolResults: []
				};
			}

			// Parse command and extract arguments
			let command = null;
			let userPrompt = input;

			if (input.startsWith('/')) {
				const firstSpace = input.indexOf(' ');
				if (firstSpace !== -1) {
					command = input.substring(1, firstSpace).toLowerCase();
					userPrompt = input.substring(firstSpace + 1).trim();
				} else {
					command = input.substring(1).toLowerCase();
					userPrompt = '';
				}
			}

			// Configure prompt based on slash command
			let specializedPrompt = userPrompt;
			let allowTools = true;

			if (command === 'plan') {
				allowTools = false;
				specializedPrompt = `[MODE: 3D MODEL ARCHITECTURAL PLAN]\nAnalyze the reference images and requirements for "${userPrompt}". Formulate a structured step-by-step 3D modeling plan:\n1. Voxel Dimensions and Bounding Box.\n2. Bone / Group Hierarchy (root, torso, limbs, head).\n3. Palette & Materials.\n4. Step-by-step Assembly Sequence.\nDo not execute tool calls yet; output the detailed design plan.`;
			} else if (command === 'grillme') {
				allowTools = false;
				specializedPrompt = `[MODE: INTERACTIVE INTERVIEW]\nI want to create a 3D model for "${userPrompt}". Ask me 3 to 4 targeted, technical clarifying questions about target platform (Minecraft Java vs Bedrock), polycount/voxel budget, joint pivot points, and texture resolution before we build.`;
			} else if (command === 'model') {
				specializedPrompt = `[MODE: 3D VOXEL MODEL GENERATION]\nGenerate 3D voxel elements for "${userPrompt}". Call create_groups to set up bones and pivot points, and create_cubes with exact from [X,Y,Z] and to [X,Y,Z] coordinates in Blockbench units (16 units = 1 block).`;
			} else if (command === 'texture' || command === 'pixelart') {
				specializedPrompt = `[MODE: PIXEL ART TEXTURE GENERATION]\nGenerate or paint texture pixels for "${userPrompt}". Call paint_texture with hex color values and exact [X, Y] pixel coordinates matching the model UV layout.`;
			} else if (command === 'animate') {
				specializedPrompt = `[MODE: SKELETAL ANIMATION GENERATION]\nGenerate keyframe animations for "${userPrompt}". Call create_animation with bone names, timestamps, channels (rotation/position), and Euler angle values.`;
			}

			// Inspect current scene context so model knows what already exists
			let sceneContext = '';
			if (window.AITools && window.AITools.inspectScene) {
				const scene = window.AITools.inspectScene();
				if (scene.success && scene.result.cubeCount > 0) {
					sceneContext = `\nCurrent Scene State: ${scene.result.cubeCount} cubes, ${scene.result.groupCount} groups existing in model.`;
				}
			}

			const fullMessageText = `${specializedPrompt}${sceneContext}`;

			// Append to history
			this.history.push({ role: 'user', content: fullMessageText });

			if (onStatusUpdate) onStatusUpdate('Contacting AI provider...');

			// Call provider
			const response = await window.AIProvider.sendChat({
				messages: this.history,
				images: images,
				tools: allowTools
			});

			// Append assistant response to history
			this.history.push({ role: 'assistant', content: response.text || '' });

			const toolResults = [];

			// Execute tool calls if any
			if (response.toolCalls && response.toolCalls.length > 0) {
				for (const tc of response.toolCalls) {
					if (onStatusUpdate) onStatusUpdate(`Executing ${tc.name}...`);
					const execResult = await window.AITools.execute(tc.name, tc.args);
					toolResults.push({
						toolName: tc.name,
						args: tc.args,
						result: execResult
					});
				}
			}

			return {
				text: response.text,
				toolCalls: response.toolCalls,
				toolResults: toolResults
			};
		}
	}

	window.AICommands = new AICommands();
})();
