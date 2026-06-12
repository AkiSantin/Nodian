export interface RelationPair {
	fieldA: string;
	fieldB: string;
	tagA: string;
	tagB: string;
}

export interface PluginSettings {
	pairs: RelationPair[];
	autoSync: boolean;
	useDisplayName: boolean;
	showRibbonSyncButton: boolean;
	debug: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	pairs: [],
	autoSync: true,
	useDisplayName: false,
	showRibbonSyncButton: true,
	debug: false,
};

export function isCompletePair(pair: RelationPair): boolean {
	return (
		pair.fieldA.trim().length > 0 &&
		pair.fieldB.trim().length > 0 &&
		pair.tagA.trim().length > 0 &&
		pair.tagB.trim().length > 0
	);
}

export interface ParsedWikilink {
	target: string;
	display: string | null;
}

export interface RelationChange {
	sourceFile: string;
	sourceFileName: string;
	fieldName: string;
	targetFieldName: string;
	added: string[];
	removed: string[];
	autoTag?: string;
}
