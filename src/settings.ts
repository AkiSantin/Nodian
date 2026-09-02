import { App, ButtonComponent, Platform, PluginSettingTab, Setting } from "obsidian";
import type YBRPlugin from "./main";
import { RelationPair } from "./types";
import { t } from "./i18n";
import {
	collectExistingFields,
	collectExistingTags,
	renderPairCard,
	showRelationPairEditModal,
} from "./relation-pair-flow";

export class YBRSettingTab extends PluginSettingTab {
	plugin: YBRPlugin;

	constructor(app: App, plugin: YBRPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName(t("settings.fullSync"))
			.setDesc(t("settings.fullSync.desc"))
			.addButton((btn) =>
				btn
					.setButtonText(t("settings.fullSync.button"))
					.onClick(() => {
						void this.runFullSync(btn);
					})
			);

		new Setting(containerEl)
			.setName(t("settings.autoSync"))
			.setDesc(t("settings.autoSync.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoSync).onChange((value) => {
					this.plugin.settings.autoSync = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName(t("settings.useDisplayName"))
			.setDesc(t("settings.useDisplayName.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useDisplayName).onChange((value) => {
					this.plugin.settings.useDisplayName = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName(t("settings.showRibbonSyncButton"))
			.setDesc(t("settings.showRibbonSyncButton.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showRibbonSyncButton).onChange((value) => {
					this.plugin.settings.showRibbonSyncButton = value;
					this.plugin.updateRibbonSyncButton();
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName(t("settings.debug"))
			.setDesc(t("settings.debug.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.debug).onChange((value) => {
					this.plugin.settings.debug = value;
					void this.plugin.saveSettings();
				})
			);

		const pairsHeading = new Setting(containerEl).setName(t("settings.relationPairs")).setHeading();

		if (Platform.isPhone) {
			// Phone: card list (mockup vocabulary) with pencil / trash, and
			// a plus button on the heading that opens the add/edit modal.
			// Desktop and tablet keep the inline rows below unchanged.
			const pairsContainer = containerEl.createDiv();
			const renderPhonePairs = () => {
				pairsContainer.empty();
				const list = pairsContainer.createDiv({ cls: "ybr-pair-list" });
				for (const pair of this.plugin.settings.pairs) {
					renderPairCard(list, pair, {
						sourceLabel: t("modal.sourceProperty"),
						targetLabel: t("modal.targetProperty"),
						onEdit: () => void this.editPairViaModal(pair, renderPhonePairs),
						onDelete: () => void this.removePairObject(pair, renderPhonePairs),
					});
				}
			};
			pairsHeading.addExtraButton((button) => {
				button
					.setIcon("plus")
					.setTooltip(t("settings.addPair"))
					.onClick(() => void this.addPairViaModal(renderPhonePairs));
			});
			renderPhonePairs();
			return;
		}

		const tags = collectExistingTags(this.app);
		const fields = collectExistingFields(this.app);
		const tagListId = "ybr-datalist-tags";
		const fieldListId = "ybr-datalist-fields";

		const tagList = containerEl.createEl("datalist", { attr: { id: tagListId } });
		for (const tag of tags) {
			tagList.createEl("option", { attr: { value: tag } });
		}

		const fieldList = containerEl.createEl("datalist", { attr: { id: fieldListId } });
		for (const field of fields) {
			fieldList.createEl("option", { attr: { value: field } });
		}

		const headerRow = containerEl.createDiv({ cls: "ybr-settings-pair-row ybr-settings-header" });
		headerRow.createEl("span", { cls: "ybr-settings-header-tag", text: "Tag" });
		headerRow.createEl("span", { cls: "ybr-settings-header-field", text: "Field" });
		headerRow.createEl("span", { cls: "ybr-settings-arrow", text: "" });
		headerRow.createEl("span", { cls: "ybr-settings-header-field", text: "Field" });
		headerRow.createEl("span", { cls: "ybr-settings-header-tag", text: "Tag" });
		headerRow.createEl("span", { cls: "ybr-settings-header-delete", text: "" });

		const pairsContainer = containerEl.createDiv();
		const renderPairs = () => {
			pairsContainer.empty();

			this.plugin.settings.pairs.forEach((pair, index) => {
				const row = pairsContainer.createDiv({ cls: "ybr-settings-pair-row" });

				const tagAInput = row.createEl("input", {
					cls: "ybr-settings-input ybr-settings-tag",
					attr: { type: "text", placeholder: "Tag", value: pair.tagA || "", list: tagListId },
				});
				tagAInput.addEventListener("change", () => {
					this.plugin.settings.pairs[index].tagA = tagAInput.value.trim();
					void this.saveSettingsAndRebuild();
				});

				const fieldAInput = row.createEl("input", {
					cls: "ybr-settings-input ybr-settings-field",
					attr: { type: "text", placeholder: "Field", value: pair.fieldA || "", list: fieldListId },
				});
				fieldAInput.addEventListener("change", () => {
					this.plugin.settings.pairs[index].fieldA = fieldAInput.value.trim();
					void this.saveSettingsAndRebuild();
				});

				row.createEl("span", { cls: "ybr-settings-arrow", text: "↔" });

				const fieldBInput = row.createEl("input", {
					cls: "ybr-settings-input ybr-settings-field",
					attr: { type: "text", placeholder: "Field", value: pair.fieldB || "", list: fieldListId },
				});
				fieldBInput.addEventListener("change", () => {
					this.plugin.settings.pairs[index].fieldB = fieldBInput.value.trim();
					void this.saveSettingsAndRebuild();
				});

				const tagBInput = row.createEl("input", {
					cls: "ybr-settings-input ybr-settings-tag",
					attr: { type: "text", placeholder: "Tag", value: pair.tagB || "", list: tagListId },
				});
				tagBInput.addEventListener("change", () => {
					this.plugin.settings.pairs[index].tagB = tagBInput.value.trim();
					void this.saveSettingsAndRebuild();
				});

				const deleteBtn = row.createEl("button", { cls: "ybr-settings-delete", text: "×" });
				deleteBtn.setAttribute("aria-label", t("settings.deletePair"));
				deleteBtn.addEventListener("click", () => {
					this.plugin.settings.pairs.splice(index, 1);
					void this.saveSettingsAndRebuild(renderPairs);
				});
			});

			const addRow = pairsContainer.createDiv({ cls: "ybr-settings-add-row" });
			const addBtn = addRow.createEl("button", { cls: "mod-cta", text: t("settings.addPair") });
			addBtn.addEventListener("click", () => {
				this.plugin.settings.pairs.push({ fieldA: "", fieldB: "", tagA: "", tagB: "" });
				void this.saveSettings(renderPairs);
			});
		};

		renderPairs();
	}

	private async runFullSync(btn: ButtonComponent): Promise<void> {
		btn.setDisabled(true);
		btn.setButtonText("...");
		try {
			// Same plugin method as the command palette and the ribbon button.
			await this.plugin.runFullSync();
		} finally {
			btn.setDisabled(false);
			btn.setButtonText(t("settings.fullSync.button"));
		}
	}

	private async saveSettingsAndRebuild(afterSave?: () => void): Promise<void> {
		await this.plugin.saveSettings();
		this.plugin.rebuildCache();
		afterSave?.();
	}

	private async addPairViaModal(rerender: () => void): Promise<void> {
		const created = await showRelationPairEditModal(this.app, null);
		if (!created) return;
		this.plugin.settings.pairs.push(created);
		await this.saveSettingsAndRebuild(rerender);
	}

	private async editPairViaModal(pair: RelationPair, rerender: () => void): Promise<void> {
		const updated = await showRelationPairEditModal(this.app, pair);
		if (!updated) return;
		const index = this.plugin.settings.pairs.indexOf(pair);
		if (index === -1) return;
		this.plugin.settings.pairs[index] = updated;
		await this.saveSettingsAndRebuild(rerender);
	}

	private async removePairObject(pair: RelationPair, rerender: () => void): Promise<void> {
		const index = this.plugin.settings.pairs.indexOf(pair);
		if (index === -1) return;
		this.plugin.settings.pairs.splice(index, 1);
		await this.saveSettingsAndRebuild(rerender);
	}

	private async saveSettings(afterSave?: () => void): Promise<void> {
		await this.plugin.saveSettings();
		afterSave?.();
	}
}
