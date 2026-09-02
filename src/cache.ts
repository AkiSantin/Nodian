import { MetadataCache, TFile, Vault } from "obsidian";
import { RelationPair } from "./types";
import { extractTargets } from "./wikilink-utils";

export class RelationCache {
	/** Map<filePath, Map<fieldName, targetFileNames[]>> */
	private relations: Map<string, Map<string, string[]>> = new Map();

	/** Map<fileName (no .md), displayName | null> */
	private displayNames: Map<string, string | null> = new Map();

	/**
	 * Build the full cache by scanning all markdown files in the vault.
	 */
	buildFullCache(
		vault: Vault,
		metadataCache: MetadataCache,
		watchedFields: Set<string>
	): void {
		this.relations.clear();
		this.displayNames.clear();

		const files = vault.getMarkdownFiles();
		for (const file of files) {
			const cache = metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (fm) {
				this.updateFileRelations(file.path, fm, watchedFields);
			}
			const fileName = file.basename;
			this.displayNames.set(fileName, this.resolveDisplayNameFromFm(fm));
		}
	}

	/**
	 * Update relation cache for a single file.
	 */
	updateFileRelations(
		filePath: string,
		frontmatter: Record<string, unknown> | undefined,
		watchedFields: Set<string>
	): void {
		const fieldMap = new Map<string, string[]>();
		if (frontmatter) {
			for (const field of watchedFields) {
				if (field in frontmatter) {
					fieldMap.set(field, extractTargets(frontmatter[field]));
				}
			}
		}
		this.relations.set(filePath, fieldMap);
	}

	/**
	 * Get cached relation targets for a file and field.
	 */
	getTargets(filePath: string, fieldName: string): string[] {
		return this.relations.get(filePath)?.get(fieldName) ?? [];
	}

	/**
	 * Get all cached relations for a file.
	 */
	getFileRelations(filePath: string): Map<string, string[]> | undefined {
		return this.relations.get(filePath);
	}

	/**
	 * Update cached targets for a specific field in a file.
	 * Used after plugin writes backlinks to keep cache in sync
	 * and prevent cascade triggers.
	 */
	setTargets(filePath: string, fieldName: string, targets: string[]): void {
		let fieldMap = this.relations.get(filePath);
		if (!fieldMap) {
			fieldMap = new Map();
			this.relations.set(filePath, fieldMap);
		}
		fieldMap.set(fieldName, targets);
	}

	/**
	 * Get display name for a file.
	 */
	getDisplayName(fileName: string): string | null {
		return this.displayNames.get(fileName) ?? null;
	}

	/**
	 * Update display name cache for a file.
	 */
	updateDisplayName(fileName: string, displayName: string | null): void {
		this.displayNames.set(fileName, displayName);
	}

	/**
	 * Find all files whose cached wikilinks resolve to the given target file.
	 * Falls back to basename/suffix matching when given a plain link target.
	 * Returns array of { filePath, fieldName }.
	 */
	findFilesLinkingTo(
		target: TFile | string,
		metadataCache?: MetadataCache
	): Array<{ filePath: string; fieldName: string }> {
		const results: Array<{ filePath: string; fieldName: string }> = [];
		if (typeof target === "string") {
			for (const [filePath, fieldMap] of this.relations) {
				for (const [fieldName, targets] of fieldMap) {
					if (targets.some((t) => t === target || t.endsWith("/" + target))) {
						results.push({ filePath, fieldName });
					}
				}
			}
			return results;
		}

		if (!metadataCache) return results;

		for (const [filePath, fieldMap] of this.relations) {
			for (const [fieldName, targets] of fieldMap) {
				for (const linkTarget of targets) {
					const resolved = metadataCache.getFirstLinkpathDest(
						linkTarget,
						filePath
					);
					if (resolved?.path === target.path) {
						results.push({ filePath, fieldName });
						break;
					}
				}
			}
		}
		return results;
	}

	/**
	 * Handle file rename: update cache keys.
	 */
	handleRename(oldPath: string, newPath: string, oldName: string, newName: string): void {
		const data = this.relations.get(oldPath);
		if (data) {
			this.relations.delete(oldPath);
			this.relations.set(newPath, data);
		}

		const dn = this.displayNames.get(oldName);
		if (dn !== undefined) {
			this.displayNames.delete(oldName);
			this.displayNames.set(newName, dn);
		}
	}

	/**
	 * Handle file deletion: remove from cache.
	 */
	handleDelete(filePath: string, fileName: string): void {
		this.relations.delete(filePath);
		this.displayNames.delete(fileName);
	}

	/**
	 * Resolve display name from frontmatter: title > aliases[0] > null.
	 */
	private resolveDisplayNameFromFm(
		fm: Record<string, unknown> | undefined | null
	): string | null {
		if (!fm) return null;
		if (typeof fm.title === "string" && fm.title.length > 0) {
			return fm.title;
		}
		return null;
	}

	// --- Static helpers ---

	/**
	 * Collect all unique field names from configured pairs.
	 */
	static getWatchedFields(pairs: RelationPair[]): Set<string> {
		const fields = new Set<string>();
		for (const pair of pairs) {
			fields.add(pair.fieldA);
			fields.add(pair.fieldB);
		}
		return fields;
	}

	/**
	 * Find the counterpart field for a given field name.
	 *
	 * When a field appears in multiple pairs, uses source file's tags
	 * to determine which pair to use:
	 *   - pair (fieldA, fieldB): applies when source tag = fieldB and source field = fieldA
	 *   - pair (fieldA, fieldB): applies when source tag = fieldA and source field = fieldB
	 *
	 * Example: Person.md (tag: Person) has Mail field
	 *   - Pair Mail↔Person: field=Mail=fieldA, tag=Person=fieldB → MATCH → counterpart=Person
	 *   - Pair Mail↔Domain: field=Mail=fieldA, tag=Person≠fieldB(Domain) → skip
	 */
	static getCounterpartField(
		fieldName: string,
		pairs: RelationPair[],
		sourceTags?: string[]
	): { counterpartField: string; pair: RelationPair } | null {
		const fieldLower = fieldName.toLowerCase();
		const matches: Array<{ counterpartField: string; pair: RelationPair; matchedSide: "A" | "B" }> = [];
		for (const pair of pairs) {
			if (pair.fieldA.toLowerCase() === fieldLower) {
				matches.push({ counterpartField: pair.fieldB, pair, matchedSide: "A" });
			} else if (pair.fieldB.toLowerCase() === fieldLower) {
				matches.push({ counterpartField: pair.fieldA, pair, matchedSide: "B" });
			}
		}

		if (matches.length === 0) return null;

		// Find pair with matching tag, using tagless matching pair as fallback
		let taglessCounterpart = null;
		const tagsLower = new Set(sourceTags?.map((t) => t.toLowerCase()) ?? []);
		for (const match of matches) {
			const relevantTag = match.matchedSide === "A"
				? match.pair.tagA
				: match.pair.tagB;
			if (relevantTag === "") {
				taglessCounterpart = { counterpartField: match.counterpartField, pair: match.pair };
			} else if (relevantTag && tagsLower.has(relevantTag.toLowerCase())) {
				return { counterpartField: match.counterpartField, pair: match.pair };
			}
		}
		if (taglessCounterpart) {
			return taglessCounterpart;
		}

		// No tag match — do not sync
		return null;
	}

	/**
	 * Check if a field name already appears in any configured pair.
	 */
	static isFieldInPairs(fieldName: string, pairs: RelationPair[]): boolean {
		const fieldLower = fieldName.toLowerCase();
		return pairs.some(
			(p) => p.fieldA.toLowerCase() === fieldLower || p.fieldB.toLowerCase() === fieldLower
		);
	}
}
