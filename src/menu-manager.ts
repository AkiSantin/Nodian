// Adapted from Iconic / Pretty Properties plugins
// https://github.com/gfxholo/iconic
// https://github.com/anareaty/pretty-properties

import { Menu, MenuItem, MenuPositionDef } from "obsidian";

type ShowAtPosition = (this: Menu, position: MenuPositionDef, doc?: Document) => Menu;

/**
 * Intercepts context menus via Menu.prototype.showAtPosition
 * to add custom items to native Obsidian menus (e.g. property menu).
 */
export default class MenuManager {
	private menu: Menu | null = null;
	private queuedActions: Array<() => void> = [];
	private originalShowAtPosition: ShowAtPosition;
	private patchedShowAtPosition: ShowAtPosition;

	constructor() {
		const originalShowAtPosition = Reflect.get(Menu.prototype, "showAtPosition") as unknown;
		if (typeof originalShowAtPosition !== "function") {
			throw new Error("Menu.showAtPosition is unavailable");
		}
		this.originalShowAtPosition = originalShowAtPosition as ShowAtPosition;
		const getManager = () => this;

		this.patchedShowAtPosition = function (
			this: Menu,
			position: MenuPositionDef,
			doc?: Document
		): Menu {
			const manager = getManager();
			manager.menu = this;
			if (manager.queuedActions.length > 0) {
				manager.runQueuedActions();
			}
			return manager.originalShowAtPosition.call(this, position, doc) as Menu;
		};
		Menu.prototype.showAtPosition = this.patchedShowAtPosition;
	}

	private runQueuedActions(): void {
		const actions = this.queuedActions;
		this.queuedActions = [];
		for (const action of actions) action();
	}

	addItem(callback: (item: MenuItem) => void): this {
		if (this.menu) {
			this.menu.addItem(callback);
		} else {
			this.queuedActions.push(() => this.addItem(callback));
		}
		return this;
	}

	flush(): void {
		this.queuedActions.length = 0;
	}

	closeAndFlush(): void {
		this.menu?.close();
		this.menu = null;
		this.flush();
	}

	restore(): void {
		// Only restore if our patch is still the active one. Another plugin
		// (e.g. Iconic, Pretty Properties) may have wrapped showAtPosition
		// after us — resetting to our saved original would wipe its patch.
		if (Menu.prototype.showAtPosition === this.patchedShowAtPosition) {
			Menu.prototype.showAtPosition = this.originalShowAtPosition;
		}
		this.closeAndFlush();
	}
}
