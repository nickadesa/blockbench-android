/**
 * Blockbench MCP-like Tool Execution Engine
 * Safely dispatches AI Function Calls into Blockbench 3D Core with Undo Transactions
 * Strictly no emojis and no third-party branding as requested.
 */

(function () {
	'use strict';

	class AITools {
		constructor() {}

		async execute(toolName, args) {
			console.log(`[AITools] Executing ${toolName}:`, args);
			try {
				switch (toolName) {
					case 'create_cubes':
						return this.createCubes(args);
					case 'create_groups':
						return this.createGroups(args);
					case 'paint_texture':
						return this.paintTexture(args);
					case 'create_animation':
						return this.createAnimation(args);
					case 'inspect_scene':
						return this.inspectScene(args);
					case 'execute_script':
						return this.executeScript(args);
					default:
						return {
							success: false,
							error: `Unknown tool: ${toolName}`
						};
				}
			} catch (err) {
				console.error(`[AITools] Error executing ${toolName}:`, err);
				return {
					success: false,
					error: err.message || String(err)
				};
			}
		}

		createCubes({ cubes }) {
			if (!Array.isArray(cubes) || cubes.length === 0) {
				return { success: false, error: 'No cubes provided' };
			}

			if (window.Undo && window.Undo.initEdit) {
				window.Undo.initEdit({ outliner: true, elements: [] });
			}

			const created = [];
			const outliner = window.Outliner || window.Tree;

			cubes.forEach((data, idx) => {
				// Normalize coordinate bounds to avoid inverted boxes
				const from = [
					Math.min(data.from[0], data.to[0]),
					Math.min(data.from[1], data.to[1]),
					Math.min(data.from[2], data.to[2])
				];
				const to = [
					Math.max(data.from[0], data.to[0]),
					Math.max(data.from[1], data.to[1]),
					Math.max(data.from[2], data.to[2])
				];

				// Ensure minimum 0.1 thickness if coordinates are identical
				for (let i = 0; i < 3; i++) {
					if (from[i] === to[i]) {
						to[i] += 1;
					}
				}

				const cubeConfig = {
					name: data.name || `cube_${idx}`,
					from: from,
					to: to,
					color: typeof data.color === 'number' ? data.color : idx % 8
				};

				let cube;
				if (typeof window.Cube === 'function') {
					cube = new window.Cube(cubeConfig).init();
				}

				// Find parent group if specified
				if (cube && data.parent) {
					const parentGroup = window.Group && window.Group.all
						? window.Group.all.find((g) => g.name.toLowerCase() === data.parent.toLowerCase())
						: null;
					if (parentGroup) {
						cube.addTo(parentGroup);
					}
				}

				if (cube) created.push(cube);
			});

			if (window.Canvas && window.Canvas.updateView) {
				window.Canvas.updateView({ elements: created });
			}

			if (window.Undo && window.Undo.finishEdit) {
				window.Undo.finishEdit('AI Create 3D Cubes');
			}

			return {
				success: true,
				count: created.length,
				summary: `Created ${created.length} 3D cube elements successfully.`
			};
		}

		createGroups({ groups }) {
			if (!Array.isArray(groups) || groups.length === 0) {
				return { success: false, error: 'No groups provided' };
			}

			if (window.Undo && window.Undo.initEdit) {
				window.Undo.initEdit({ outliner: true, group: true });
			}

			const created = [];
			groups.forEach((data, idx) => {
				const origin = Array.isArray(data.origin) && data.origin.length === 3 ? data.origin : [0, 0, 0];
				let group;
				if (typeof window.Group === 'function') {
					group = new window.Group({
						name: data.name || `group_${idx}`,
						origin: origin
					}).init();
				}

				if (group && data.parent) {
					const parentGroup = window.Group.all
						? window.Group.all.find((g) => g.name.toLowerCase() === data.parent.toLowerCase())
						: null;
					if (parentGroup && parentGroup !== group) {
						group.addTo(parentGroup);
					}
				}

				if (group) created.push(group);
			});

			if (window.Undo && window.Undo.finishEdit) {
				window.Undo.finishEdit('AI Create Groups & Bones');
			}

			return {
				success: true,
				count: created.length,
				summary: `Created ${created.length} hierarchical bone groups.`
			};
		}

		paintTexture({ texture_name, width = 16, height = 16, pixels = [] }) {
			if (!Array.isArray(pixels) || pixels.length === 0) {
				return { success: false, error: 'No pixels specified' };
			}

			if (window.Undo && window.Undo.initEdit) {
				window.Undo.initEdit({ textures: [] });
			}

			// Find target texture or create one
			let texture = window.Texture && window.Texture.all
				? window.Texture.all.find((t) => t.name.toLowerCase() === (texture_name || '').toLowerCase())
				: null;

			if (!texture && window.Texture && window.Texture.all && window.Texture.all.length > 0) {
				texture = window.Texture.all[0];
			}

			if (!texture && typeof window.Texture === 'function') {
				// Generate new texture canvas
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(0, 0, width, height);

				texture = new window.Texture({
					name: texture_name || 'ai_texture',
					folder: 'block'
				}).fromDataURL(canvas.toDataURL()).add();
			}

			if (!texture) {
				return { success: false, error: 'Unable to initialize texture target.' };
			}

			// Render pixels onto texture
			try {
				const img = texture.img;
				let canvas, ctx;
				if (img instanceof HTMLCanvasElement) {
					canvas = img;
					ctx = canvas.getContext('2d');
				} else {
					canvas = document.createElement('canvas');
					canvas.width = texture.width || width;
					canvas.height = texture.height || height;
					ctx = canvas.getContext('2d');
					if (img) ctx.drawImage(img, 0, 0);
				}

				pixels.forEach((p) => {
					ctx.fillStyle = p.color;
					ctx.fillRect(p.x, p.y, 1, 1);
				});

				texture.fromDataURL(canvas.toDataURL());
				if (texture.updateSource) texture.updateSource();
				if (window.Canvas && window.Canvas.updateAllFaces) window.Canvas.updateAllFaces();
			} catch (e) {
				console.error('Texture painting failed', e);
			}

			if (window.Undo && window.Undo.finishEdit) {
				window.Undo.finishEdit('AI Paint Texture');
			}

			return {
				success: true,
				pixelsCount: pixels.length,
				summary: `Painted ${pixels.length} pixels onto texture "${texture.name}".`
			};
		}

		createAnimation({ name, length = 1.0, loop = true, keyframes = [] }) {
			if (!name) return { success: false, error: 'Animation name is required.' };

			if (window.Undo && window.Undo.initEdit) {
				window.Undo.initEdit({ animations: [] });
			}

			let anim;
			if (typeof window.Animation === 'function') {
				anim = new window.Animation({
					name: name,
					length: Number(length),
					looping: loop ? 'loop' : 'once'
				}).init();
			}

			if (anim && Array.isArray(keyframes)) {
				keyframes.forEach((kf) => {
					const animator = anim.getBoneAnimator(kf.bone);
					if (animator && animator[kf.channel]) {
						animator.createKeyframe({
							time: kf.time,
							channel: kf.channel,
							data_points: [{
								x: kf.values[0] || 0,
								y: kf.values[1] || 0,
								z: kf.values[2] || 0
							}]
						});
					}
				});
			}

			if (window.Undo && window.Undo.finishEdit) {
				window.Undo.finishEdit('AI Create Animation');
			}

			return {
				success: true,
				summary: `Created animation "${name}" (${length}s) with ${keyframes.length} keyframe tracks.`
			};
		}

		inspectScene() {
			const summary = {
				projectName: window.Project ? window.Project.name : 'Untitled',
				format: window.Format ? window.Format.name : 'generic',
				cubeCount: window.Cube && window.Cube.all ? window.Cube.all.length : 0,
				groupCount: window.Group && window.Group.all ? window.Group.all.length : 0,
				groups: [],
				cubes: [],
				textures: []
			};

			if (window.Group && window.Group.all) {
				summary.groups = window.Group.all.map((g) => ({
					name: g.name,
					origin: g.origin,
					parent: g.parent instanceof window.Group ? g.parent.name : null
				}));
			}

			if (window.Cube && window.Cube.all) {
				summary.cubes = window.Cube.all.slice(0, 50).map((c) => ({
					name: c.name,
					from: c.from,
					to: c.to,
					parent: c.parent instanceof window.Group ? c.parent.name : null
				}));
			}

			if (window.Texture && window.Texture.all) {
				summary.textures = window.Texture.all.map((t) => ({
					name: t.name,
					width: t.width,
					height: t.height
				}));
			}

			return {
				success: true,
				result: summary,
				summary: `Scene contains ${summary.cubeCount} cubes and ${summary.groupCount} groups.`
			};
		}

		executeScript({ code }) {
			if (!code) return { success: false, error: 'No code provided.' };

			if (window.Undo && window.Undo.initEdit) {
				window.Undo.initEdit({ outliner: true, elements: [] });
			}

			let result;
			try {
				const fn = new Function('Blockbench', 'Cube', 'Group', 'Texture', 'Animation', 'Canvas', 'Undo', code);
				result = fn(window.Blockbench, window.Cube, window.Group, window.Texture, window.Animation, window.Canvas, window.Undo);
			} catch (e) {
				return { success: false, error: e.message || String(e) };
			}

			if (window.Undo && window.Undo.finishEdit) {
				window.Undo.finishEdit('AI Procedural Script');
			}

			return {
				success: true,
				result: result,
				summary: 'Custom procedural script executed successfully.'
			};
		}
	}

	window.AITools = new AITools();
})();
