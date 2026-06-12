export default {
	// Command
	"cmd.syncAll": "Sync all bidirectional relations",
	"ribbon.syncAll": "Sync all bidirectional relations",

	// Notices
	"notice.syncComplete": "Sync complete: updated {0} files",
	"notice.pairCreated": "✅ Pair: {0} ↔ {1}",
	"notice.fileNotFound": "⚠️ File not found: {0}.md",
	"notice.backlinkAdded": "✅ {0} → {1}: {2}",
	"notice.backlinksCreated": "✅ {0}: backlinks created from {1} file(s)",
	"notice.pairRemoved": "Pair removed for {0}",
	"notice.fieldUpdate": "Nodian: {0} → writing to \"{1}\" property: {2}",

	// Settings
	"settings.fullSync": "Full sync",
	"settings.fullSync.desc": "⚠️ Full sync scans the whole vault and fills in missing backlinks for all configured pairs. This may modify existing YAML frontmatter — review your pairs before running.",
	"settings.fullSync.button": "Run full sync",
	"settings.autoSync": "Auto sync",
	"settings.autoSync.desc": "Automatically sync bidirectional relations when a file changes",
	"settings.useDisplayName": "Use title as display name",
	"settings.useDisplayName.desc": "Use the title property as display text in backlinks (e.g. [[filename|title]]). When off, backlinks use the filename only. Run full sync after changing.",
	"settings.debug": "Debug mode",
	"settings.debug.desc": "Output detailed logs to the developer console",
	"settings.relationPairs": "Relation pairs",
	"settings.fieldA": "Field A",
	"settings.fieldB": "Field B",
	"settings.deletePair": "Delete pair",
	"settings.addPair": "+ Add pair",
	"settings.showRibbonSyncButton": "Show ribbon sync button",
	"settings.showRibbonSyncButton.desc": "Show a button in the left ribbon for running a full sync. Useful after creating notes by copying or in other ways that do not trigger automatic sync.",

	// Modal
	"modal.title": "New relation field detected",
	"modal.hasField": "\"{0}\" has a \"{1}\" field with wikilinks.",
	"modal.question": "When \"{0}\" links to another file, what field in THAT file should get the backlink?",
	"modal.currentPairs": "Current pairs ({0})",
	"modal.backlinkField": "Backlink field",
	"modal.backlinkField.desc": "The field in the TARGET file that will receive the backlink",
	"modal.sameField": "{0} (same field)",
	"modal.newFieldName": "Or type a new field name",
	"modal.newFieldPlaceholder": "leave empty to use selection above",
	"modal.save": "Save",
	"modal.ignore": "Ignore",
	"modal.editTitle": "Bidirectional relation",
	"modal.currentlyPaired": "\"{0}\" is currently paired with \"{1}\".",
	"modal.removePair": "Remove pair",
	"modal.close": "Close",
	"modal.addAnother": "Add another pair for this property:",
	"modal.pairTag": "When source tag is \"{0}\"",
	"modal.pairTagAny": "Any tag (fallback)",
	"modal.active": "Active",
	"modal.context": "Tag: {0} → Field: {1}",
	"modal.noPairForTag": "⚠️ No pair configured for tag \"{0}\". Sync is inactive for this property on this page. Add a pair below.",

	// Settings: tag fields
	"settings.tagA": "Tag A",
	"settings.tagB": "Tag B",

	// Modal: tag-related
	"modal.counterpartTag": "Target tag",
	"modal.counterpartTag.desc": "The tag that identifies target files for this pair",
	"modal.counterpartTag.field": "Target property",
	"modal.counterpartTag.placeholder": "Enter tag",
	"modal.sourceTag": "Tag for this page",
	"modal.sourceTag.required": "This page has no tag. A tag is required to create a pair.",
	"modal.existingPairs": "Existing pairs",

	// Native-style card UI (mobile)
	"modal.addTitle": "Add bidirectional relation",
	"modal.editPairTitle": "Edit bidirectional relation",
	"modal.activePair": "Active pair",
	"modal.currentPageProperty": "This page's property",
	"modal.sourceProperty": "This property",
	"modal.targetProperty": "Target property",
	"modal.setRelationTag": "Relation tag",
	"modal.setRelationField": "Relation property",
	"modal.relationHelp": "Only pages whose tag and property both match this pair are synced as a bidirectional relation.\nWhen you add or change links in this property, Nodian automatically updates the matching property on the related page.\nTo avoid ambiguous matches, keep only one tag in the tags property on pages that use bidirectional relations.",
	"modal.back": "Back",
	"modal.cancel": "Cancel",
	"settings.editPair": "Edit pair",

	// Property buttons
	"property.paired": "Paired: {0} ↔ {1}",
	"property.clickToSetup": "Set up bidirectional relation",

	// Context menu
	"menu.configurePair": "Configure bidirectional relation",
	"menu.editPair": "Edit bidirectional relation",
} as Record<string, string>;
