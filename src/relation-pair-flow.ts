import {
	AbstractInputSuggest,
	App,
	ButtonComponent,
	ExtraButtonComponent,
	Modal,
	Setting,
	setIcon,
} from "obsidian";
import { RelationPair, isCompletePair } from "./types";
import { RelationCache } from "./cache";
import { t } from "./i18n";
import { getFrontmatterKeys, getFrontmatterTags } from "./frontmatter-utils";
import type { PairSuggestResult } from "./pair-suggest-modal";

const SYSTEM_FIELDS = new Set([
	"title",
	"aliases",
	"tags",
	"cssclasses",
	"publish",
	"permalink",
	"description",
	"image",
	"cover",
	"banner",
	"date",
	"created",
	"updated",
	"modified",
	"position",
]);

export function collectExistingFields(app: App, excludeField = ""): string[] {
	const fieldSet = new Set<string>();
	const files = app.vault.getMarkdownFiles();
	for (const file of files) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		for (const key of getFrontmatterKeys(fm)) {
			if (SYSTEM_FIELDS.has(key.toLowerCase())) continue;
			if (excludeField && key === excludeField) continue;
			fieldSet.add(key);
		}
	}
	return Array.from(fieldSet).sort();
}

export function collectExistingTags(app: App): string[] {
	const tagSet = new Set<string>();
	const files = app.vault.getMarkdownFiles();
	for (const file of files) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		for (const tag of getFrontmatterTags(fm)) {
			tagSet.add(tag);
		}
	}
	return Array.from(tagSet).sort();
}

/**
 * A pair as displayed from the perspective of `fieldName` (that side
 * first). `view` may be a swapped copy for display; any mutation
 * (deletion) must use `original` so object identity against
 * settings.pairs is preserved.
 */
interface PairView {
	original: RelationPair;
	view: RelationPair;
}

function asPairView(pair: RelationPair, fieldName: string): PairView {
	if (pair.fieldB === fieldName && pair.fieldA !== fieldName) {
		return {
			original: pair,
			view: {
				fieldA: pair.fieldB,
				fieldB: pair.fieldA,
				tagA: pair.tagB,
				tagB: pair.tagA,
			},
		};
	}
	return { original: pair, view: pair };
}

function blurActiveTextInput(container: HTMLElement): void {
	const active = container.ownerDocument.activeElement;
	if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
		active.blur();
	}
}

/**
 * Native autocomplete on a plain text input. Suggestions are the
 * existing tags / fields; the user can also type a new value.
 */
class StringInputSuggest extends AbstractInputSuggest<string> {
	constructor(
		app: App,
		private inputElRef: HTMLInputElement,
		private getItems: () => string[]
	) {
		super(app, inputElRef);
	}

	protected getSuggestions(query: string): string[] {
		const q = query.toLowerCase();
		return this.getItems().filter((item) => item.toLowerCase().includes(q));
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}
}

/**
 * A field group: muted label above, full-width text input below, with
 * native AbstractInputSuggest autocomplete. No placeholder (mockup).
 */
function addAutocompleteField(
	parent: HTMLElement,
	app: App,
	options: {
		label: string;
		value: string;
		getItems: () => string[];
		onChange: (value: string) => void;
	}
): HTMLInputElement {
	const group = parent.createDiv({ cls: "ybr-field" });
	group.createEl("label", { cls: "ybr-field-label", text: options.label });
	const input = group.createEl("input", {
		cls: "ybr-text-input",
		attr: { type: "text" },
	});
	input.value = options.value;

	const suggest = new StringInputSuggest(app, input, options.getItems);
	suggest.onSelect((value) => {
		suggest.setValue(value);
		input.value = value;
		options.onChange(value.trim());
		suggest.close();
	});

	input.addEventListener("input", () => {
		options.onChange(input.value.trim());
	});
	input.setAttribute("enterkeyhint", "done");
	input.addEventListener("keydown", (event: KeyboardEvent) => {
		if (event.key !== "Enter") return;
		event.preventDefault();
		input.blur();
	});

	return input;
}

/**
 * Native-style circular back button placed top-left of the modal,
 * mirroring Obsidian's native circular close (x). Obsidian has no
 * official Modal back API; the look uses official CSS variables only.
 * Any existing one is removed first so re-renders do not stack buttons.
 */
function setModalBackButton(modalEl: HTMLElement, onClick: (() => void) | null): void {
	modalEl.querySelectorAll(".ybr-modal-back").forEach((el) => el.remove());
	if (!onClick) return;
	const btn = modalEl.createEl("button", {
		cls: "ybr-modal-back",
		attr: { "aria-label": t("modal.back") },
	});
	setIcon(btn, "arrow-left");
	btn.addEventListener("click", onClick);
}

function renderEndpointLabel(parent: HTMLElement, text: string, icon: string): HTMLElement {
	const label = parent.createDiv({ cls: "ybr-endpoint-label" });
	const iconEl = label.createSpan({ cls: "ybr-endpoint-label-icon" });
	setIcon(iconEl, icon);
	label.createSpan({ text });
	return label;
}

function renderEndpoint(
	parent: HTMLElement,
	options: {
		labelText: string;
		labelIcon: string;
		tag: string;
		field: string;
		fieldRole: "source" | "target";
	}
): void {
	const block = parent.createDiv({ cls: "ybr-endpoint" });
	renderEndpointLabel(block, options.labelText, options.labelIcon);

	const value = block.createDiv({ cls: "ybr-endpoint-value" });
	value.createSpan({ cls: "ybr-endpoint-tag", text: options.tag || "—" });
	value.createSpan({
		cls: `ybr-endpoint-field is-${options.fieldRole}`,
		text: options.field || "—",
	});
}

/**
 * Pair card per the mockup: source endpoint, divider, target endpoint;
 * action icons (trash / optional pencil) top-right; active pair carries
 * the theme-accent border.
 */
export function renderPairCard(
	parent: HTMLElement,
	pair: RelationPair,
	options: {
		sourceLabel: string;
		targetLabel: string;
		active?: boolean;
		onEdit?: () => void;
		onDelete?: () => void;
	}
): void {
	const card = parent.createDiv({
		cls: "ybr-pair-card" + (options.active ? " is-active" : ""),
	});

	if (options.onEdit || options.onDelete) {
		const actions = card.createDiv({ cls: "ybr-pair-actions" });
		if (options.onEdit) {
			new ExtraButtonComponent(actions)
				.setIcon("pencil")
				.setTooltip(t("settings.editPair"))
				.onClick(options.onEdit);
		}
		if (options.onDelete) {
			new ExtraButtonComponent(actions)
				.setIcon("trash-2")
				.setTooltip(t("settings.deletePair"))
				.onClick(options.onDelete);
		}
	}

	renderEndpoint(card, {
		labelText: options.sourceLabel,
		labelIcon: "arrow-down-left",
		tag: pair.tagA,
		field: pair.fieldA,
		fieldRole: "source",
	});

	card.createDiv({ cls: "ybr-pair-divider" });

	renderEndpoint(card, {
		labelText: options.targetLabel,
		labelIcon: "arrow-up-right",
		tag: pair.tagB,
		field: pair.fieldB,
		fieldRole: "target",
	});
}

/**
 * Full-width stacked Save / Cancel buttons (mockup screen 2).
 */
function addActionButtons(
	parent: HTMLElement,
	options: { onSave: () => void; onCancel: () => void }
): ButtonComponent {
	const col = parent.createDiv({ cls: "ybr-action-col" });
	const save = new ButtonComponent(col)
		.setButtonText(t("modal.save"))
		.setCta()
		.onClick(options.onSave);
	new ButtonComponent(col)
		.setButtonText(t("modal.cancel"))
		.onClick(options.onCancel);
	return save;
}

/**
 * Phone relation modal (two screens, per the user's mockup):
 *   list view — active pair + other pairs for this field, as cards
 *   add view  — fixed source endpoint, target tag/property inputs
 * Resolves with the same PairSuggestResult contract as the desktop
 * modal, so main.ts wiring (and sync semantics) is untouched.
 */
export class PropertyRelationModal extends Modal {
	private counterpartValue = "";
	private counterpartTagValue = "";
	private sourceTagValue = "";

	constructor(
		app: App,
		private fieldName: string,
		_fileName: string,
		private existingPairs: RelationPair[],
		private sourceTags: string[],
		_pageFields: string[],
		private resolve: (result: PairSuggestResult) => void
	) {
		super(app);
		this.sourceTagValue = sourceTags[0] || "";
	}

	onOpen(): void {
		this.containerEl.addClass("ybr-relation-native-container");
		this.modalEl.addClass("ybr-relation-native-modal");

		if (this.getFieldPairs().length === 0) {
			this.renderAddView();
		} else {
			this.renderListView();
		}
	}

	private getFieldPairs(): PairView[] {
		return this.existingPairs
			.filter((pair) => pair.fieldA === this.fieldName || pair.fieldB === this.fieldName)
			.map((pair) => asPairView(pair, this.fieldName));
	}

	private getActivePairView(): PairView | null {
		const activeResult = RelationCache.getCounterpartField(
			this.fieldName,
			this.existingPairs,
			this.sourceTags
		);
		return activeResult ? asPairView(activeResult.pair, this.fieldName) : null;
	}

	/** Screen 1 — list. No back button here (native close only). */
	private renderListView(): void {
		this.contentEl.empty();
		this.setTitle(t("modal.editTitle"));
		setModalBackButton(this.modalEl, null);

		const fieldPairs = this.getFieldPairs();
		const activeView = this.getActivePairView();

		new Setting(this.contentEl)
			.setName(t("modal.activePair"))
			.setHeading()
			.addExtraButton((button) => {
				button
					.setIcon("plus")
					.setTooltip(t("settings.addPair"))
					.onClick(() => this.renderAddView());
			});

		const activeList = this.contentEl.createDiv({ cls: "ybr-pair-list" });
		if (activeView) {
			renderPairCard(activeList, activeView.view, {
				sourceLabel: t("modal.currentPageProperty"),
				targetLabel: t("modal.targetProperty"),
				active: true,
				onDelete: () => this.removePair(activeView),
			});
		} else if (this.sourceTags.length > 0) {
			this.contentEl.createDiv({
				cls: "ybr-help-text ybr-warning-text",
				text: t("modal.noPairForTag", this.sourceTags.join(", ")),
			});
		}

		const otherPairs = fieldPairs.filter(
			(pairView) => pairView.original !== activeView?.original
		);
		if (otherPairs.length === 0) return;

		new Setting(this.contentEl).setName(t("modal.existingPairs")).setHeading();

		const otherList = this.contentEl.createDiv({ cls: "ybr-pair-list" });
		for (const pairView of otherPairs) {
			renderPairCard(otherList, pairView.view, {
				sourceLabel: t("modal.sourceProperty"),
				targetLabel: t("modal.targetProperty"),
				onDelete: () => this.removePair(pairView),
			});
		}
	}

	/** Screen 2 — add pair (mockup screen 2). */
	private renderAddView(): void {
		this.contentEl.empty();
		this.setTitle(t("modal.addTitle"));

		this.counterpartValue = "";
		this.counterpartTagValue = "";

		const hasPairs = this.getFieldPairs().length > 0;
		const currentTag = this.sourceTags[0] || "";
		this.sourceTagValue = currentTag;

		setModalBackButton(
			this.modalEl,
			hasPairs ? () => this.renderListView() : null
		);

		const card = this.contentEl.createDiv({ cls: "ybr-pair-card ybr-add-card" });

		if (currentTag) {
			renderEndpoint(card, {
				labelText: t("modal.currentPageProperty"),
				labelIcon: "arrow-down-left",
				tag: currentTag,
				field: this.fieldName,
				fieldRole: "source",
			});
		} else {
			// Page has no tag yet (case not drawn in the mockup): keep the
			// existing semantics — ask for the source tag, main.ts writes it.
			renderEndpointLabel(card, t("modal.currentPageProperty"), "arrow-down-left");
			card.createDiv({
				cls: "ybr-help-text ybr-warning-text",
				text: t("modal.sourceTag.required"),
			});
			addAutocompleteField(card, this.app, {
				label: t("modal.sourceTag"),
				value: "",
				getItems: () => collectExistingTags(this.app),
				onChange: (value) => {
					this.sourceTagValue = value;
					this.refreshSaveState();
				},
			});
			const value = card.createDiv({ cls: "ybr-endpoint-value" });
			value.createSpan({ cls: "ybr-endpoint-field is-source", text: this.fieldName });
		}

		renderEndpointLabel(card, t("modal.targetProperty"), "arrow-up-right");

		addAutocompleteField(card, this.app, {
			label: t("modal.setRelationTag"),
			value: "",
			getItems: () => collectExistingTags(this.app),
			onChange: (value) => {
				this.counterpartTagValue = value;
				this.refreshSaveState();
			},
		});

		addAutocompleteField(card, this.app, {
			label: t("modal.setRelationField"),
			value: "",
			getItems: () => collectExistingFields(this.app, this.fieldName),
			onChange: (value) => {
				this.counterpartValue = value;
				this.refreshSaveState();
			},
		});

		this.contentEl.createDiv({ cls: "ybr-help-text", text: t("modal.relationHelp") });

		this.saveButton = addActionButtons(this.contentEl, {
			onSave: () => this.saveNewPair(currentTag),
			onCancel: () => {
				if (hasPairs) {
					this.renderListView();
				} else {
					this.resolve({ action: "ignore" });
					this.close();
				}
			},
		});
		this.refreshSaveState();
	}

	private saveButton: ButtonComponent | null = null;

	private canSave(): boolean {
		if (!this.counterpartValue) return false;
		if (!this.counterpartTagValue) return false;
		if (this.sourceTags.length === 0 && !this.sourceTagValue) return false;
		return true;
	}

	private refreshSaveState(): void {
		this.saveButton?.setDisabled(!this.canSave());
	}

	private saveNewPair(currentTag: string): void {
		blurActiveTextInput(this.contentEl);
		if (!this.canSave()) return;

		this.resolve({
			action: "save",
			counterpartField: this.counterpartValue,
			counterpartTag: this.counterpartTagValue,
			sourceTag: currentTag ? undefined : this.sourceTagValue,
		});
		this.close();
	}

	private removePair(pairView: PairView): void {
		// Resolve with the ORIGINAL object (identity against settings.pairs);
		// the view may be a swapped display copy.
		this.resolve({
			action: "remove",
			counterpartField: pairView.view.fieldB,
			pair: pairView.original,
		});
		this.close();
	}

	onClose(): void {
		setModalBackButton(this.modalEl, null);
		this.modalEl.removeClass("ybr-relation-native-modal");
		this.containerEl.removeClass("ybr-relation-native-container");
		this.contentEl.empty();
		this.resolve({ action: "ignore" });
	}
}

/**
 * Settings-page add / edit modal (phone): both endpoints editable.
 * Pure UI — returns a complete RelationPair (or null on cancel); the
 * caller persists it with the existing settings save path.
 */
class RelationPairEditModal extends Modal {
	private draft: RelationPair;
	private saveButton: ButtonComponent | null = null;

	constructor(
		app: App,
		initialPair: RelationPair | null,
		private resolve: (pair: RelationPair | null) => void
	) {
		super(app);
		this.draft = initialPair
			? { ...initialPair }
			: { fieldA: "", fieldB: "", tagA: "", tagB: "" };
		this.isNew = initialPair === null;
	}

	private isNew: boolean;

	onOpen(): void {
		this.containerEl.addClass("ybr-relation-native-container");
		this.modalEl.addClass("ybr-relation-native-modal");
		this.setTitle(this.isNew ? t("modal.addTitle") : t("modal.editPairTitle"));

		setModalBackButton(this.modalEl, () => {
			this.resolve(null);
			this.close();
		});

		const card = this.contentEl.createDiv({ cls: "ybr-pair-card ybr-add-card" });

		renderEndpointLabel(card, t("modal.sourceProperty"), "arrow-down-left");
		addAutocompleteField(card, this.app, {
			label: t("modal.setRelationTag"),
			value: this.draft.tagA,
			getItems: () => collectExistingTags(this.app),
			onChange: (value) => {
				this.draft.tagA = value;
				this.refreshSaveState();
			},
		});
		addAutocompleteField(card, this.app, {
			label: t("modal.setRelationField"),
			value: this.draft.fieldA,
			getItems: () => collectExistingFields(this.app),
			onChange: (value) => {
				this.draft.fieldA = value;
				this.refreshSaveState();
			},
		});

		renderEndpointLabel(card, t("modal.targetProperty"), "arrow-up-right");
		addAutocompleteField(card, this.app, {
			label: t("modal.setRelationTag"),
			value: this.draft.tagB,
			getItems: () => collectExistingTags(this.app),
			onChange: (value) => {
				this.draft.tagB = value;
				this.refreshSaveState();
			},
		});
		addAutocompleteField(card, this.app, {
			label: t("modal.setRelationField"),
			value: this.draft.fieldB,
			getItems: () => collectExistingFields(this.app),
			onChange: (value) => {
				this.draft.fieldB = value;
				this.refreshSaveState();
			},
		});

		this.contentEl.createDiv({ cls: "ybr-help-text", text: t("modal.relationHelp") });

		this.saveButton = addActionButtons(this.contentEl, {
			onSave: () => {
				blurActiveTextInput(this.contentEl);
				if (!isCompletePair(this.draft)) return;
				this.resolve({ ...this.draft });
				this.close();
			},
			onCancel: () => {
				this.resolve(null);
				this.close();
			},
		});
		this.refreshSaveState();
	}

	private refreshSaveState(): void {
		this.saveButton?.setDisabled(!isCompletePair(this.draft));
	}

	onClose(): void {
		setModalBackButton(this.modalEl, null);
		this.modalEl.removeClass("ybr-relation-native-modal");
		this.containerEl.removeClass("ybr-relation-native-container");
		this.contentEl.empty();
		this.resolve(null);
	}
}

export function showRelationPairEditModal(
	app: App,
	pair: RelationPair | null
): Promise<RelationPair | null> {
	return new Promise((resolve) => {
		let resolved = false;
		const wrappedResolve = (result: RelationPair | null) => {
			if (!resolved) {
				resolved = true;
				resolve(result);
			}
		};
		new RelationPairEditModal(app, pair, wrappedResolve).open();
	});
}
