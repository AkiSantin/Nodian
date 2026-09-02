import { App, Modal, Platform, Setting } from "obsidian";
import { RelationPair } from "./types";
import { RelationCache } from "./cache";
import { t } from "./i18n";
import {
	PropertyRelationModal,
	collectExistingFields,
	collectExistingTags,
} from "./relation-pair-flow";

export interface PairSuggestResult {
	action: "save" | "ignore" | "remove";
	counterpartField?: string;
	counterpartTag?: string;
	sourceTag?: string;
	/** For "remove": the exact pair the user clicked (same object reference
	 *  as in settings.pairs) — pairs sharing field names but different tags
	 *  must not be removed together. */
	pair?: RelationPair;
}

export class PairSuggestModal extends Modal {
	private fieldName: string;
	private existingPairs: RelationPair[];
	private sourceTags: string[];
	private resolve: (result: PairSuggestResult) => void;
	private counterpartValue: string;
	private counterpartTagValue: string;
	private cleanupFns: Array<() => void> = [];

	constructor(
		app: App,
		fieldName: string,
		_fileName: string,
		existingPairs: RelationPair[],
		sourceTags: string[],
		_pageFields: string[],
		resolve: (result: PairSuggestResult) => void
	) {
		super(app);
		this.fieldName = fieldName;
		this.existingPairs = existingPairs;
		this.sourceTags = sourceTags;
		this.resolve = resolve;
		this.counterpartValue = fieldName;
		this.counterpartTagValue = "";
	}

	onOpen() {
		const { contentEl } = this;
		this.modalEl.addClass("ybr-modal-container");
		contentEl.addClass("ybr-modal");
		new Setting(contentEl).setName(t("modal.editTitle")).setHeading();

		const fieldPairs = this.existingPairs.filter(
			(pair) => pair.fieldA === this.fieldName || pair.fieldB === this.fieldName
		);
		const activeResult = RelationCache.getCounterpartField(
			this.fieldName,
			this.existingPairs,
			this.sourceTags
		);
		const activePair = activeResult?.pair ?? null;

		if (fieldPairs.length > 0) {
			contentEl.createEl("p", {
				text: t("modal.existingPairs"),
				cls: "ybr-modal-section-label",
			});

			for (const pair of fieldPairs) {
				const isActive = activePair === pair;
				const row = contentEl.createDiv({ cls: "ybr-pair-row" + (isActive ? " is-active" : "") });
				const left = row.createDiv({ cls: "ybr-pair-content" });

				if (pair.tagA) {
					left.createEl("span", { cls: "ybr-tag-badge", text: pair.tagA });
				}
				left.createEl("span", {
					cls: "ybr-field-name" + (isActive && pair.fieldA === this.fieldName ? " is-active" : ""),
					text: ` ${pair.fieldA} `,
				});
				left.createEl("span", { cls: "ybr-arrow", text: "↔" });
				left.createEl("span", {
					cls: "ybr-field-name" + (isActive && pair.fieldB === this.fieldName ? " is-active" : ""),
					text: ` ${pair.fieldB} `,
				});
				if (pair.tagB) {
					left.createEl("span", { cls: "ybr-tag-badge", text: pair.tagB });
				}

				if (isActive) {
					left.createEl("span", { cls: "ybr-active-badge", text: t("modal.active") });
				}

				const counterpart = pair.fieldA === this.fieldName ? pair.fieldB : pair.fieldA;
				const deleteBtn = row.createEl("button", { cls: "ybr-delete-btn", text: "×" });
				deleteBtn.addEventListener("click", () => {
					this.resolve({ action: "remove", counterpartField: counterpart, pair });
					this.close();
				});
			}
		}

		if (!activePair) {
			contentEl.createEl("p", {
				text: t("modal.noPairForTag", [...this.sourceTags, ""].join(", ")),
				cls: "ybr-modal-warning",
			});
		}

		contentEl.createEl("hr");
		contentEl.createEl("p", {
			text: t("modal.addAnother"),
			cls: "ybr-modal-section-label",
		});

		this.renderAddForm(contentEl);
	}

	private renderAddForm(contentEl: HTMLElement) {
		const existingFields = collectExistingFields(this.app, this.fieldName);
		const existingTags = collectExistingTags(this.app);
		const currentTag = this.sourceTags[0] || "";
		const addRow = contentEl.createDiv({ cls: "ybr-add-row" });
		const leftSide = addRow.createDiv({ cls: "ybr-add-left" });

		if (currentTag) {
			leftSide.createEl("span", { cls: "ybr-tag-badge ybr-active-tag", text: currentTag });
		}
		leftSide.createEl("span", {
			cls: "ybr-field-name is-active",
			text: ` ${this.fieldName} `,
		});
		leftSide.createEl("span", { cls: "ybr-arrow", text: "↔" });

		const rightSide = addRow.createDiv({ cls: "ybr-add-right" });
		const fieldCol = rightSide.createDiv({ cls: "ybr-add-col" });
		this.createCombo(fieldCol, existingFields, t("modal.counterpartTag.field"), (value) => {
			this.counterpartValue = value;
		});
		fieldCol.createEl("span", { cls: "ybr-select-label", text: t("modal.counterpartTag.field") });

		const tagCol = rightSide.createDiv({ cls: "ybr-add-col" });
		this.createCombo(tagCol, existingTags, t("modal.counterpartTag"), (value) => {
			this.counterpartTagValue = value;
		});
		tagCol.createEl("span", { cls: "ybr-select-label", text: t("modal.counterpartTag") });

		contentEl.createEl("hr");
		const btnRow = contentEl.createDiv({ cls: "ybr-btn-row" });
		const saveBtn = btnRow.createEl("button", { cls: "mod-cta", text: t("modal.save") });
		saveBtn.addEventListener("click", () => {
			if (!this.counterpartValue) return;
			this.resolve({
				action: "save",
				counterpartField: this.counterpartValue,
				counterpartTag: this.counterpartTagValue,
			});
			this.close();
		});

		const closeBtn = btnRow.createEl("button", { text: t("modal.close") });
		closeBtn.addEventListener("click", () => {
			this.resolve({ action: "ignore" });
			this.close();
		});
	}

	private createCombo(
		container: HTMLElement,
		options: string[],
		placeholder: string,
		onChange: (value: string) => void
	) {
		const combo = container.createDiv({ cls: "ybr-combo" });
		const input = combo.createEl("input", {
			cls: "ybr-combo-input",
			attr: { type: "text", placeholder },
		});
		const doc = activeDocument;
		const arrow = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
		arrow.setAttribute("class", "ybr-combo-arrow");
		arrow.setAttribute("viewBox", "0 0 12 12");

		const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("d", "M3 5l3 3 3-3");
		path.setAttribute("fill", "none");
		path.setAttribute("stroke", "currentColor");
		path.setAttribute("stroke-width", "1.5");
		arrow.appendChild(path);
		combo.appendChild(arrow);

		const dropdown = combo.createDiv({ cls: "ybr-combo-dropdown" });
		const optionEls: HTMLElement[] = [];
		for (const option of options) {
			const optionEl = dropdown.createDiv({ cls: "ybr-combo-option", attr: { "data-value": option } });
			optionEl.textContent = option;
			optionEls.push(optionEl);
		}

		const filterOptions = (query: string) => {
			const normalizedQuery = query.toLowerCase();
			for (const optionEl of optionEls) {
				optionEl.classList.toggle(
					"is-hidden",
					!(optionEl.dataset.value || "").toLowerCase().includes(normalizedQuery)
				);
			}
		};

		combo.addEventListener("mousedown", (event: MouseEvent) => {
			if ((event.target as HTMLElement).closest(".ybr-combo-option")) return;
			event.preventDefault();
			input.focus();
			if (dropdown.classList.contains("is-open")) {
				dropdown.classList.remove("is-open");
			} else {
				dropdown.classList.add("is-open");
				filterOptions(input.value);
			}
		});

		input.addEventListener("input", () => {
			dropdown.classList.add("is-open");
			filterOptions(input.value);
			onChange(input.value.trim());
		});

		for (const optionEl of optionEls) {
			optionEl.addEventListener("mousedown", (event: MouseEvent) => {
				event.preventDefault();
				event.stopPropagation();
				input.value = optionEl.dataset.value || "";
				dropdown.classList.remove("is-open");
				onChange(input.value);
			});
		}

		const onDocMousedown = (event: MouseEvent) => {
			if (!combo.contains(event.target as Node)) {
				dropdown.classList.remove("is-open");
			}
		};
		doc.addEventListener("mousedown", onDocMousedown);
		this.cleanupFns.push(() => doc.removeEventListener("mousedown", onDocMousedown));
	}

	onClose() {
		this.modalEl.removeClass("ybr-modal-container");
		for (const fn of this.cleanupFns) fn();
		this.cleanupFns = [];
		this.contentEl.empty();
		this.resolve({ action: "ignore" });
	}
}

export function showPairSuggestModal(
	app: App,
	fieldName: string,
	fileName: string,
	existingPairs: RelationPair[],
	sourceTags: string[] = [],
	pageFields: string[] = []
): Promise<PairSuggestResult> {
	return new Promise((resolve) => {
		let resolved = false;
		const wrappedResolve = (result: PairSuggestResult) => {
			if (!resolved) {
				resolved = true;
				resolve(result);
			}
		};
		// Phones get the native-style two-screen flow (user mockup);
		// desktop and tablet keep the existing modal. Same result
		// contract either way — main.ts wiring is identical.
		if (Platform.isPhone) {
			new PropertyRelationModal(app, fieldName, fileName, existingPairs, sourceTags, pageFields, wrappedResolve).open();
		} else {
			new PairSuggestModal(app, fieldName, fileName, existingPairs, sourceTags, pageFields, wrappedResolve).open();
		}
	});
}
