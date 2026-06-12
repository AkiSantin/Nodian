import { MetadataCache, Notice, TFile, Vault } from "obsidian";
import { t } from "./i18n";
import { RelationChange, RelationPair } from "./types";
import { RelationCache } from "./cache";
import {
	buildWikilink,
	extractTargets,
	hasLinkTo,
} from "./wikilink-utils";
import { readFieldWikilinks, splitFrontmatter, updateFieldInContent, yamlHasTagsField } from "./yaml-utils";
import { getFrontmatterTags, getFrontmatterValue } from "./frontmatter-utils";

function extractFileTags(metadataCache: MetadataCache, file: TFile): string[] {
	const fm = metadataCache.getFileCache(file)?.frontmatter;
	return getFrontmatterTags(fm);
}

function resolveTargetFile(
	vault: Vault,
	metadataCache: MetadataCache,
	linkpath: string,
	sourcePath: string,
	expectedTag: string | undefined
): TFile | null {
	const candidate = metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
	if (!candidate) return null;
	if (!expectedTag) return candidate;

	const tags = extractFileTags(metadataCache, candidate);
	if (tags.length === 0) return candidate;
	if (tags.some((t) => t.toLowerCase() === expectedTag.toLowerCase())) return candidate;

	return null;
}

/**
 * Detect changes in relation fields by comparing current frontmatter with cache.
 */
export function detectChanges(
	filePath: string,
	fileName: string,
	currentFrontmatter: Record<string, unknown> | undefined,
	cache: RelationCache,
	pairs: RelationPair[]
): RelationChange[] {
	const changes: RelationChange[] = [];
	const watchedFields = RelationCache.getWatchedFields(pairs);

	// Extract source tags for pair disambiguation
	const sourceTags = getFrontmatterTags(currentFrontmatter);

	for (const fieldName of watchedFields) {
		const counterpart = RelationCache.getCounterpartField(fieldName, pairs, sourceTags);
		if (!counterpart) continue;

			const oldTargets = cache.getTargets(filePath, fieldName);
			const newTargets = currentFrontmatter
				? extractTargets(getFrontmatterValue(currentFrontmatter, fieldName))
				: [];

		const oldSet = new Set(oldTargets);
		const newSet = new Set(newTargets);

		const added = newTargets.filter((t) => !oldSet.has(t));
		const removed = oldTargets.filter((t) => !newSet.has(t));

		if (added.length > 0 || removed.length > 0) {
			changes.push({
				sourceFile: filePath,
				sourceFileName: fileName,
				fieldName,
				targetFieldName: counterpart.counterpartField,
				added,
				removed,
				autoTag: counterpart.pair.fieldA === fieldName
					? counterpart.pair.tagB
					: counterpart.pair.tagA,
			});
		}
	}

	return changes;
}

/** Pending modification for a single field in a target file */
interface FieldMod {
	targetFieldName: string;
	/** Auto-tag to add if target has no tags (= source field name = target entity type) */
	autoTag?: string;
	addLinks: string[];
	removeSourceNames: string[];
}

/**
 * Apply detected changes: add/remove backlinks in target files.
 * Groups all modifications per target file into a single vault.process call
 * to prevent race conditions.
 */
export async function applyChanges(
	changes: RelationChange[],
	vault: Vault,
	metadataCache: MetadataCache,
	cache: RelationCache,
	syncing: Set<string>,
	debug: boolean,
	useDisplayName: boolean = false
): Promise<void> {
	// Group all modifications by target file path
	const modsPerFile = new Map<string, Map<string, FieldMod>>();

	for (const change of changes) {
		const sourceDisplayName = useDisplayName ? cache.getDisplayName(change.sourceFileName) : null;

		for (const targetFileName of change.added) {
			const targetFile = resolveTargetFile(vault, metadataCache, targetFileName, change.sourceFile, change.autoTag);
			if (!targetFile) {
				if (debug) {
					console.log(`[YBR] Target file not found or tag mismatch: ${targetFileName} (expected tag: ${change.autoTag}) — skipping`);
				}
				continue;
			}

			let fileMods = modsPerFile.get(targetFile.path);
			if (!fileMods) {
				fileMods = new Map();
				modsPerFile.set(targetFile.path, fileMods);
			}

			let fieldMod = fileMods.get(change.targetFieldName);
			if (!fieldMod) {
				fieldMod = {
					targetFieldName: change.targetFieldName,
					addLinks: [],
					removeSourceNames: [],
					autoTag: change.autoTag, // tag from the pair's target side
				};
				fileMods.set(change.targetFieldName, fieldMod);
			}

			const newLink = buildWikilink(change.sourceFileName, sourceDisplayName);
			fieldMod.addLinks.push(newLink);
		}

		for (const targetFileName of change.removed) {
			const targetFile = resolveTargetFile(vault, metadataCache, targetFileName, change.sourceFile, change.autoTag);
			if (!targetFile) continue;

			let fileMods = modsPerFile.get(targetFile.path);
			if (!fileMods) {
				fileMods = new Map();
				modsPerFile.set(targetFile.path, fileMods);
			}

			let fieldMod = fileMods.get(change.targetFieldName);
			if (!fieldMod) {
				fieldMod = { targetFieldName: change.targetFieldName, addLinks: [], removeSourceNames: [] };
				fileMods.set(change.targetFieldName, fieldMod);
			}

			fieldMod.removeSourceNames.push(change.sourceFileName);
		}
	}

	// Apply all modifications per file in a single vault.process call
	for (const [filePath, fieldMods] of modsPerFile) {
		const file = vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) continue;

		// Track final state of each field for cache update
		const finalFieldStates = new Map<string, string[]>();

		// Show Notice for EVERY write so user can see what's happening
		for (const [, mod] of fieldMods) {
			if (mod.addLinks.length > 0) {
				new Notice(
					t("notice.fieldUpdate", file.basename, mod.targetFieldName, mod.addLinks.join(", ")),
					5000
				);
			}
		}

		syncing.add(filePath);
		try {
			await vault.process(file, (content) => {
				let result = content;

				for (const [, mod] of fieldMods) {
					const yaml = extractYaml(result);
					const existingLinks = readFieldWikilinks(yaml, mod.targetFieldName);

					let updatedLinks = [...existingLinks];

					// Add new links (skip duplicates)
					for (const newLink of mod.addLinks) {
						const match = newLink.match(/\[\[([^\]|]+)/);
						const sourceName = match ? match[1] : "";
						if (!hasLinkTo(updatedLinks, sourceName)) {
							updatedLinks.push(newLink);
						}
					}

					// Remove links
					for (const sourceName of mod.removeSourceNames) {
						updatedLinks = updatedLinks.filter((link) => {
							const m = link.match(/\[\[([^\]|]+)/);
							return !(m && m[1] === sourceName);
						});
					}

					// Only write if something changed
					if (
						updatedLinks.length !== existingLinks.length ||
						updatedLinks.some((l, i) => l !== existingLinks[i])
					) {
						result = updateFieldInContent(result, mod.targetFieldName, updatedLinks);
					}

					// Record final targets for cache update
					finalFieldStates.set(
						mod.targetFieldName,
						updatedLinks.map((l) => {
							const m = l.match(/\[\[([^\]|]+)/);
							return m ? m[1] : "";
						}).filter(Boolean)
					);
				}

				// Auto-tag: if target has no tags, add one based on source field name
				// e.g., Person.md's "Mail" field links here → add tag "Mail"
				const split = splitFrontmatter(result);
				if (split) {
					if (!yamlHasTagsField(split.yaml)) {
						for (const [, m] of fieldMods) {
							if (m.autoTag) {
								result = result.replace(
									/^(---\n)/,
									`---\ntags:\n  - ${m.autoTag}\n`
								);
								if (debug) {
									console.log(`[YBR] Auto-tagged ${filePath} with "${m.autoTag}"`);
								}
								break;
							}
						}
					}
				}

				return result;
			});

			// CRITICAL: Update cache for the target file IMMEDIATELY
			// This prevents cascade: when onFileModify fires for this file,
			// detectChanges will compare against updated cache and find no diff.
			for (const [fieldName, targets] of finalFieldStates) {
				cache.setTargets(filePath, fieldName, targets);
			}

			if (debug) {
				for (const [, mod] of fieldMods) {
					if (mod.addLinks.length > 0) {
						console.log(`[YBR] Added to ${filePath} → ${mod.targetFieldName}: ${mod.addLinks.join(", ")}`);
					}
					if (mod.removeSourceNames.length > 0) {
						console.log(`[YBR] Removed from ${filePath} → ${mod.targetFieldName}: ${mod.removeSourceNames.join(", ")}`);
					}
				}
				console.log(`[YBR] Cache updated for ${filePath}:`, Object.fromEntries(finalFieldStates));
			}
			} finally {
				window.setTimeout(() => syncing.delete(filePath), 500);
			}
		}
	}

/**
 * Full sync: rebuild cache and ensure all backlinks are consistent.
 */
export async function fullSync(
	vault: Vault,
	metadataCache: MetadataCache,
	cache: RelationCache,
	pairs: RelationPair[],
	syncing: Set<string>,
	debug: boolean,
	useDisplayName: boolean = false
): Promise<number> {
	const watchedFields = RelationCache.getWatchedFields(pairs);

	// Rebuild cache
	cache.buildFullCache(vault, metadataCache, watchedFields);

	let modifiedCount = 0;
	const files = vault.getMarkdownFiles();

	// Phase 1: Collect missing backlinks AND display name corrections
	const modsPerFile = new Map<string, Map<string, string[]>>();
	const rewritesPerFile = new Map<string, Map<string, Array<{ from: string; to: string }>>>();

	for (const file of files) {
		const fm = metadataCache.getFileCache(file)?.frontmatter;
		if (!fm) continue;

			const fmTags = getFrontmatterTags(fm);

		for (const fieldName of watchedFields) {
			const counterpart = RelationCache.getCounterpartField(fieldName, pairs, fmTags);
			if (!counterpart) continue;

				const targets = extractTargets(getFrontmatterValue(fm, fieldName));
			const sourceDisplayName = useDisplayName ? cache.getDisplayName(file.basename) : null;

			const expectedTargetTag = counterpart.pair.fieldA === fieldName
				? counterpart.pair.tagB
				: counterpart.pair.tagA;

			for (const targetFileName of targets) {
					const targetFile = resolveTargetFile(vault, metadataCache, targetFileName, file.path, expectedTargetTag);
					if (!targetFile) continue;

					const targetFm = metadataCache.getFileCache(targetFile)?.frontmatter;
					const existingTargets = extractTargets(getFrontmatterValue(targetFm, counterpart.counterpartField));

				if (!existingTargets.includes(file.basename)) {
					const newLink = buildWikilink(file.basename, sourceDisplayName);
					let fileMods = modsPerFile.get(targetFile.path);
					if (!fileMods) {
						fileMods = new Map();
						modsPerFile.set(targetFile.path, fileMods);
					}
					const existing = fileMods.get(counterpart.counterpartField) ?? [];
					existing.push(newLink);
					fileMods.set(counterpart.counterpartField, existing);
				}
			}
		}
	}

	// Phase 2: Scan all files for display name rewrites
	for (const file of files) {
		const fm = metadataCache.getFileCache(file)?.frontmatter;
		if (!fm) continue;

		const rawContent = await vault.cachedRead(file);
		const yaml = extractYaml(rawContent);

		for (const fieldName of watchedFields) {
			const existingLinks = readFieldWikilinks(yaml, fieldName);
			if (existingLinks.length === 0) continue;

			let changed = false;
			const updatedLinks = existingLinks.map((link) => {
				const parsed = link.match(/^\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]$/);
				if (!parsed) return link;
				const target = parsed[1].trim();
				const currentDisplay = parsed[2]?.trim() ?? null;
				const targetBasename = target.split("/").pop() || target;
				const targetTitle = cache.getDisplayName(targetBasename);

				if (useDisplayName) {
					// ON: add title if missing, update if stale
					if (targetTitle && targetTitle !== target) {
						const expected = buildWikilink(target, targetTitle);
						if (expected !== link) { changed = true; return expected; }
					}
				} else {
					// OFF: remove display ONLY if it matches the file's title (plugin-set)
					if (currentDisplay && currentDisplay === targetTitle) {
						changed = true;
						return buildWikilink(target);
					}
				}
				return link;
			});

			if (changed) {
				let fileRewrites = rewritesPerFile.get(file.path);
				if (!fileRewrites) {
					fileRewrites = new Map();
					rewritesPerFile.set(file.path, fileRewrites);
				}
				fileRewrites.set(fieldName, updatedLinks.map((l, i) => ({
					from: existingLinks[i], to: l
				})).filter((r) => r.from !== r.to));
			}
		}
	}

	// Phase 3: Apply all modifications (adds + rewrites)
	const allFilePaths = new Set([...modsPerFile.keys(), ...rewritesPerFile.keys()]);
	for (const filePath of allFilePaths) {
		const file = vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) continue;

		const addMods = modsPerFile.get(filePath);
		const rewriteMods = rewritesPerFile.get(filePath);

		syncing.add(filePath);
		try {
			await vault.process(file, (content) => {
				let result = content;

				// Add missing backlinks
				if (addMods) {
					for (const [fieldName, linksToAdd] of addMods) {
						const yaml = extractYaml(result);
						const existingLinks = readFieldWikilinks(yaml, fieldName);
						let updatedLinks = [...existingLinks];

						for (const newLink of linksToAdd) {
							const match = newLink.match(/\[\[([^\]|]+)/);
							const sourceName = match ? match[1] : "";
							if (!hasLinkTo(updatedLinks, sourceName)) {
								updatedLinks.push(newLink);
							}
						}

						if (updatedLinks.length !== existingLinks.length) {
							result = updateFieldInContent(result, fieldName, updatedLinks);
						}
					}
				}

				// Rewrite display names
				if (rewriteMods) {
					for (const [fieldName, rewrites] of rewriteMods) {
						const yaml = extractYaml(result);
						const existingLinks = readFieldWikilinks(yaml, fieldName);
						const updatedLinks = existingLinks.map((link) => {
							const rewrite = rewrites.find((r) => r.from === link);
							return rewrite ? rewrite.to : link;
						});
						if (updatedLinks.some((l, i) => l !== existingLinks[i])) {
							result = updateFieldInContent(result, fieldName, updatedLinks);
						}
					}
				}

				return result;
			});
			modifiedCount++;
			} finally {
				window.setTimeout(() => syncing.delete(filePath), 500);
			}
		}

	// Rebuild cache after all modifications
	cache.buildFullCache(vault, metadataCache, watchedFields);

	return modifiedCount;
}

// safety-bypass: user explicitly requested removal of findFileByName — all 3 call sites already replaced with metadataCache.getFirstLinkpathDest()
/**
 * Extract YAML string from content.
 */
function extractYaml(content: string): string {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	return match ? match[1] : "";
}
