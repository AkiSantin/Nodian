import { Notice, Plugin, TFile, addIcon } from "obsidian";
import { DEFAULT_SETTINGS, PluginSettings, RelationPair, isCompletePair } from "./types";
import { RelationCache } from "./cache";
import { YBRSettingTab } from "./settings";
import { detectChanges, applyChanges, fullSync } from "./sync";
import { resolveDisplayName } from "./display-name";
import { buildWikilink, extractTargets, hasLinkTo } from "./wikilink-utils";
import { readFieldWikilinks, splitFrontmatter, updateFieldInContent, yamlHasTagsField } from "./yaml-utils";
import { showPairSuggestModal } from "./pair-suggest-modal";
import { t } from "./i18n";
import MenuManager from "./menu-manager";
import { getFrontmatterKeys, getFrontmatterTags, getFrontmatterValue, isRecord } from "./frontmatter-utils";
import { NODIAN_SYNC_ICON, NODIAN_SYNC_ICON_ID } from "./icons";

function extractYaml(content: string): string {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	return match ? match[1] : "";
}

function readStringSetting(record: Record<string, unknown>, key: string, fallback = ""): string {
	const value = record[key];
	return typeof value === "string" ? value : fallback;
}

function readBooleanSetting(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
	const value = record[key];
	return typeof value === "boolean" ? value : fallback;
}

function normalizeRelationPair(value: unknown): { pair: RelationPair; migrated: boolean } | null {
	if (!isRecord(value)) return null;

	const fieldA = readStringSetting(value, "fieldA");
	const fieldB = readStringSetting(value, "fieldB");
	const tagAValue = value.tagA;
	const tagBValue = value.tagB;
	const tagA = typeof tagAValue === "string" ? tagAValue : fieldB;
	const tagB = typeof tagBValue === "string" ? tagBValue : fieldA;

	return {
		pair: { fieldA, fieldB, tagA, tagB },
		migrated: typeof tagAValue !== "string" || typeof tagBValue !== "string",
	};
}

export default class YBRPlugin extends Plugin {
	settings: PluginSettings = DEFAULT_SETTINGS;
	cache: RelationCache = new RelationCache();
	syncing: Set<string> = new Set();
	private debounceTimers: Map<string, number> = new Map();
	private layoutReady = false;
	private menuManager!: MenuManager;
	private ribbonSyncEl: HTMLElement | null = null;

	/** Frontmatter fields that should never show the relation button */
	private static SYSTEM_FIELDS = new Set([
		"title", "aliases", "tags", "cssclasses", "publish",
		"permalink", "description", "image", "cover", "banner",
		"date", "created", "updated", "modified", "position",
	]);

	async onload() {
		await this.loadSettings();
		addIcon(NODIAN_SYNC_ICON_ID, NODIAN_SYNC_ICON);

		// Initialize menu manager — intercepts Obsidian's native menus
		this.menuManager = new MenuManager();

		this.addSettingTab(new YBRSettingTab(this.app, this));

		// Register command: full sync (same method as ribbon + settings)
		this.addCommand({
			id: "sync-all-bidirectional-relations",
			name: t("cmd.syncAll"),
			callback: async () => {
				await this.runFullSync();
			},
		});

		this.updateRibbonSyncButton();

		// Build cache when layout is ready (vault files are loaded)
		this.app.workspace.onLayoutReady(() => {
			this.rebuildCache();
			// Mark ready AFTER a short delay so initial file events are ignored
			window.setTimeout(() => {
				this.layoutReady = true;
				if (this.settings.debug) {
					console.log("[YBR] Layout ready, accepting file events");
				}
			}, 2000);
		});

		// Hook into Obsidian's property icon click — queues our menu items
		// that will be added to the native property menu when it shows.
		this.registerDomEvent(activeDocument, "click", (evt) => {
			const target = evt.target as HTMLElement;
			if (!target) return;
			if (target.closest(".metadata-property-icon")) {
				this.queuePropertyMenuItems(target);
			}
		}, true);
		this.registerDomEvent(activeDocument, "contextmenu", (evt) => {
			const target = evt.target as HTMLElement;
			if (!target) return;
			if (target.closest(".metadata-property-icon") || target.closest(".metadata-property")) {
				this.queuePropertyMenuItems(target);
			}
		}, true);

		// Listen for file modifications
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					this.debouncedOnFileModify(file);
				}
			})
		);

		// Listen for file creation
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					this.onFileCreate(file);
				}
			})
		);

		// Listen for file rename
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile && file.extension === "md") {
					const oldName = oldPath
						.split("/")
						.pop()
						?.replace(/\.md$/, "");
					if (oldName) {
						this.cache.handleRename(
							oldPath,
							file.path,
							oldName,
							file.basename
						);
						if (this.settings.debug) {
							console.log(
								`[YBR] Renamed: ${oldPath} → ${file.path}`
							);
						}
					}
				}
			})
		);

		// Listen for file deletion
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					this.cache.handleDelete(file.path, file.basename);
					if (this.settings.debug) {
						console.log(`[YBR] Deleted from cache: ${file.path}`);
					}
				}
			})
		);
	}

	onunload() {
		this.menuManager.restore();
		this.removeRibbonSyncButton();
		// Clear all debounce timers
		for (const timer of this.debounceTimers.values()) {
			window.clearTimeout(timer);
		}
		this.debounceTimers.clear();
	}

	async loadSettings() {
		const rawData = (await this.loadData()) as unknown;
		const data = isRecord(rawData) ? rawData : {};
		const rawPairs = Array.isArray(data.pairs) ? data.pairs : [];
		const normalizedPairs = rawPairs
			.map(normalizeRelationPair)
			.filter((item): item is { pair: RelationPair; migrated: boolean } => item !== null);
		const migrated =
			normalizedPairs.some((item) => item.migrated) ||
			"autoUpdateDisplayName" in data;

		this.settings = {
			pairs: normalizedPairs.map((item) => item.pair),
			autoSync: readBooleanSetting(data, "autoSync", DEFAULT_SETTINGS.autoSync),
			useDisplayName: readBooleanSetting(data, "useDisplayName", DEFAULT_SETTINGS.useDisplayName),
			showRibbonSyncButton: readBooleanSetting(data, "showRibbonSyncButton", DEFAULT_SETTINGS.showRibbonSyncButton),
			debug: readBooleanSetting(data, "debug", DEFAULT_SETTINGS.debug),
		};

		if (migrated) {
			await this.saveData(this.settings);
		}
	}

	async saveSettings() {
		await this.saveData({
			...this.settings,
			pairs: this.getActivePairs(),
		});
	}

	getActivePairs(): RelationPair[] {
		return this.settings.pairs.filter(isCompletePair);
	}

	/** Shared by the command palette, the settings button and the ribbon. */
	async runFullSync(): Promise<number> {
		const count = await fullSync(
			this.app.vault,
			this.app.metadataCache,
			this.cache,
			this.getActivePairs(),
			this.syncing,
			this.settings.debug,
			this.settings.useDisplayName
		);
		new Notice(t("notice.syncComplete", String(count)));
		return count;
	}

	updateRibbonSyncButton(): void {
		if (!this.settings.showRibbonSyncButton) {
			this.removeRibbonSyncButton();
			return;
		}
		if (this.ribbonSyncEl) return;

		this.ribbonSyncEl = this.addRibbonIcon(
			NODIAN_SYNC_ICON_ID,
			t("ribbon.syncAll"),
			() => {
				void this.runFullSync();
			}
		);
	}

	private removeRibbonSyncButton(): void {
		this.ribbonSyncEl?.remove();
		this.ribbonSyncEl = null;
	}

	/**
	 * Rebuild the in-memory cache. Called on startup and when settings change.
	 */
	rebuildCache() {
		const activePairs = this.getActivePairs();
		const watchedFields = RelationCache.getWatchedFields(
			activePairs
		);
		this.cache.buildFullCache(
			this.app.vault,
			this.app.metadataCache,
			watchedFields
		);
	}

	// ─── Property Buttons ───────────────────────────────────────

	// ─── Context menu on properties ──────────────────────────────

	/**
	 * Queue a menu item to be added to Obsidian's native property menu.
	 * The MenuManager's Menu.showAtPosition hook will add it when
	 * the native menu is about to open.
	 */
	private queuePropertyMenuItems(target: HTMLElement) {
		const propEl = target.closest(".metadata-property");
		if (!propEl) return;

		const fieldName = propEl.getAttribute("data-property-key");
		if (!fieldName) return;

		if (YBRPlugin.SYSTEM_FIELDS.has(fieldName.toLowerCase())) return;

		// Use case-correct field name from frontmatter if available
		const activeFile = this.app.workspace.getActiveFile();
		const fm = activeFile
			? this.app.metadataCache.getFileCache(activeFile)?.frontmatter
			: null;
		const caseCorrectFieldName = fm
			? Object.keys(fm).find((k) => k.toLowerCase() === fieldName.toLowerCase()) || fieldName
			: fieldName;

		const isInAnyPair = RelationCache.isFieldInPairs(
			caseCorrectFieldName,
			this.getActivePairs()
		);

		this.menuManager.closeAndFlush();
		this.menuManager.addItem((item) =>
			item
				.setTitle(isInAnyPair ? t("menu.editPair") : t("menu.configurePair"))
				.setIcon("link")
				.onClick(() => {
					void this.onPropertyButtonClick(caseCorrectFieldName);
				})
		);
	}

	/**
	 * Handle click on a property relation button.
	 */
	private async onPropertyButtonClick(fieldName: string) {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return;

		// Get current file's tags for highlighting active pair
		const currentFm = this.app.metadataCache.getFileCache(activeFile)?.frontmatter;
		const currentTags = getFrontmatterTags(currentFm);

		// Get current page's field names to filter relevant pairs
		const pageFields = getFrontmatterKeys(currentFm).filter(
			(k) => !YBRPlugin.SYSTEM_FIELDS.has(k.toLowerCase()) && k !== "position"
		);

		const activePairs = this.getActivePairs();
		const result = await showPairSuggestModal(
			this.app,
			fieldName,
			activeFile.basename,
			activePairs,
			currentTags,
			pageFields
		);

		if (result.action === "save" && result.counterpartField) {
			const counterpartField = result.counterpartField;

			const newPair: RelationPair = {
				fieldA: fieldName,
				fieldB: counterpartField,
				tagA: currentTags[0] || "",
				tagB: result.counterpartTag || counterpartField,
			};

			// Only add if this exact pair doesn't already exist — a pair is
			// the same only when both endpoints (tag + field) match; the
			// two sides may be swapped.
			const alreadyExists = this.settings.pairs.some(
				(p) =>
					(p.fieldA === newPair.fieldA && p.tagA === newPair.tagA &&
						p.fieldB === newPair.fieldB && p.tagB === newPair.tagB) ||
					(p.fieldA === newPair.fieldB && p.tagA === newPair.tagB &&
						p.fieldB === newPair.fieldA && p.tagB === newPair.tagA)
			);
			if (!alreadyExists) {
				this.settings.pairs.push(newPair);
				await this.saveSettings();
				new Notice(t("notice.pairCreated", fieldName, counterpartField));
			}

			// Sync backlinks immediately — same code path as auto-sync, so
			// target resolution (tag check + auto-tag) stays consistent.
			const fm = this.app.metadataCache.getFileCache(activeFile)?.frontmatter;
			if (fm) {
				const targets = extractTargets(getFrontmatterValue(fm, fieldName));
				if (targets.length > 0) {
					await applyChanges(
						[{
							sourceFile: activeFile.path,
							sourceFileName: activeFile.basename,
							fieldName,
							targetFieldName: counterpartField,
							added: targets,
							removed: [],
							autoTag: newPair.tagB,
						}],
						this.app.vault,
						this.app.metadataCache,
						this.cache,
						this.syncing,
						this.settings.debug,
						this.settings.useDisplayName
					);
				}
			}

			this.rebuildCache();
			// Button re-attach no longer needed — using context menu
		} else if (result.action === "remove" && result.pair) {
			// Remove exactly the clicked pair (object identity). Pairs that
			// share the same field names under different tags must stay.
			const removePair = result.pair;
			const before = this.settings.pairs.length;
			this.settings.pairs = this.settings.pairs.filter((p) => p !== removePair);
			if (this.settings.pairs.length !== before) {
				await this.saveSettings();
				this.rebuildCache();
				new Notice(t("notice.pairRemoved", fieldName));
			}
			// Button re-attach no longer needed — using context menu
		}
	}

	// ─── File Event Handlers ────────────────────────────────────

	/**
	 * Debounced file modify handler (300ms per file).
	 */
	private debouncedOnFileModify(file: TFile) {
		const existing = this.debounceTimers.get(file.path);
		if (existing) window.clearTimeout(existing);

		const timer = window.setTimeout(() => {
			this.debounceTimers.delete(file.path);
			void this.onFileModify(file);
		}, 300);

		this.debounceTimers.set(file.path, timer);
	}

	/**
	 * Handle file modification: detect relation changes and sync.
	 */
	private async onFileModify(file: TFile) {
		// Skip if this file is being written by the plugin
		if (this.syncing.has(file.path)) return;

		// Skip if auto-sync is disabled or no pairs configured
		const activePairs = this.getActivePairs();
		if (!this.settings.autoSync || activePairs.length === 0) return;

		const fm =
			this.app.metadataCache.getFileCache(file)?.frontmatter;
		const watchedFields = RelationCache.getWatchedFields(
			activePairs
		);

		// Detect relation changes
		const changes = detectChanges(
			file.path,
			file.basename,
			fm,
			this.cache,
			activePairs
		);

		if (changes.length > 0) {
			if (this.settings.debug) {
				console.log(`[YBR] Changes detected in ${file.path}:`, changes);
			}
			await applyChanges(
				changes,
				this.app.vault,
				this.app.metadataCache,
				this.cache,
				this.syncing,
				this.settings.debug,
				this.settings.useDisplayName
			);
		}

		// Check for display name changes
		// Update cache for this file
		this.cache.updateFileRelations(file.path, fm, watchedFields);
		this.cache.updateDisplayName(
			file.basename,
			resolveDisplayName(fm)
		);

		// Re-attach property buttons if this is the active file
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile && activeFile.path === file.path) {
			// Button re-attach no longer needed — using context menu
		}
	}

	/**
	 * Handle new file creation.
	 */
	private onFileCreate(file: TFile): void {
		if (!this.settings.autoSync) return;
		if (!this.layoutReady) return; // Skip initial vault scan on startup

		// Delay to let metadataCache index the new file
		window.setTimeout(() => {
			void this.processNewFile(file);
		}, 800);
	}

	private async processNewFile(file: TFile) {
		const activePairs = this.getActivePairs();
		const watchedFields = RelationCache.getWatchedFields(
			activePairs
		);
		const fm =
			this.app.metadataCache.getFileCache(file)?.frontmatter;

		// Update cache
		this.cache.updateFileRelations(file.path, fm, watchedFields);
		this.cache.updateDisplayName(
			file.basename,
			resolveDisplayName(fm)
		);

		// Find all files that link to this new file and write backlinks
		const newFileName = file.basename;
		const linkingFiles = this.cache.findFilesLinkingTo(
			file,
			this.app.metadataCache
		);

		if (linkingFiles.length > 0) {
			this.syncing.add(file.path);
			try {
				let autoTag: string | null = null;

				await this.app.vault.process(file, (content) => {
					let result = content;

					for (const { filePath: srcPath, fieldName: srcField } of linkingFiles) {
						const srcFile = this.app.vault.getAbstractFileByPath(srcPath);
						if (!(srcFile instanceof TFile)) continue;
						const srcFm = this.app.metadataCache.getFileCache(srcFile)?.frontmatter;
						const srcTags = getFrontmatterTags(srcFm);

						const counterpart = RelationCache.getCounterpartField(
							srcField, activePairs, srcTags
						);
						if (!counterpart) continue;

						// Same rule as resolveTargetFile in sync.ts: if this new
						// file already carries tags, it must carry the pair's
						// target tag; only untagged files may be initialized
						// (auto-tag below).
						const expectedTag = counterpart.pair.fieldA === srcField
							? counterpart.pair.tagB
							: counterpart.pair.tagA;
						const ownTags = getFrontmatterTags(fm);
						if (
							ownTags.length > 0 &&
							!ownTags.some((tg) => tg.toLowerCase() === expectedTag.toLowerCase())
						) {
							continue;
						}

						const yaml = extractYaml(result);
						const existing = readFieldWikilinks(yaml, counterpart.counterpartField);
						const srcBasename = srcFile.basename;

						if (!hasLinkTo(existing, srcBasename)) {
							const srcDisplay = this.settings.useDisplayName ? this.cache.getDisplayName(srcBasename) : null;
							const newLink = buildWikilink(srcBasename, srcDisplay);
							const updated = [...existing, newLink];
							result = updateFieldInContent(result, counterpart.counterpartField, updated);

							if (this.settings.debug) {
								console.log(
									`[YBR] New file ${newFileName}: added ${counterpart.counterpartField}: ${newLink} (from ${srcBasename}.${srcField})`
								);
							}
						}

						if (!autoTag) {
							// Use the pair's target tag instead of the source field name
							autoTag = expectedTag;
						}
					}

					if (autoTag) {
						const split = splitFrontmatter(result);
						if (split) {
							if (!yamlHasTagsField(split.yaml)) {
								result = result.replace(
									/^(---\n)/,
									`---\ntags:\n  - ${autoTag}\n`
								);
							}
						}
					}

					return result;
				});

				const updatedFm = this.app.metadataCache.getFileCache(file)?.frontmatter;
				this.cache.updateFileRelations(file.path, updatedFm, watchedFields);
				this.cache.updateDisplayName(file.basename, resolveDisplayName(updatedFm));

				new Notice(t("notice.backlinksCreated", newFileName, String(linkingFiles.length)));
			} finally {
				window.setTimeout(() => this.syncing.delete(file.path), 500);
			}
		}

		// Display name updates removed — Obsidian's native rename handles
		// bare [[filename]] links automatically, and custom aliases like
		// [[filename|custom]] should never be modified by the plugin.

		// Re-attach property buttons for the new file
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile && activeFile.path === file.path) {
			// Button re-attach no longer needed — using context menu
		}
	}
}
