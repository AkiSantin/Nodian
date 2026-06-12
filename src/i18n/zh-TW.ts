export default {
	// 指令
	"cmd.syncAll": "同步所有雙向關聯",
	"ribbon.syncAll": "同步所有雙向關聯",

	// 通知
	"notice.syncComplete": "同步完成：已更新 {0} 個檔案",
	"notice.pairCreated": "✅ 配對：{0} ↔ {1}",
	"notice.fileNotFound": "⚠️ 找不到檔案：{0}.md",
	"notice.backlinkAdded": "✅ {0} → {1}：{2}",
	"notice.backlinksCreated": "✅ {0}：已從 {1} 個檔案建立反向連結",
	"notice.pairRemoved": "已解除 {0} 的配對",
	"notice.fieldUpdate": "Nodian：{0} → 寫入「{1}」屬性欄位：{2}",

	// 設定
	"settings.fullSync": "完整同步",
	"settings.fullSync.desc": "⚠️ 完整同步會掃描整個儲存庫，為所有已設定的配對補齊缺少的反向連結，可能會修改既有筆記的 YAML frontmatter，執行前請先確認配對設定。",
	"settings.fullSync.button": "執行完整同步",
	"settings.autoSync": "自動同步",
	"settings.autoSync.desc": "檔案變更時自動同步雙向關聯",
	"settings.useDisplayName": "使用 title 作為顯示名稱",
	"settings.useDisplayName.desc": "反向連結使用 title 屬性作為顯示文字（例如 [[檔名|title]]）。關閉時只顯示檔名。變更後請執行完整同步。",
	"settings.debug": "除錯模式",
	"settings.debug.desc": "在開發者主控台輸出詳細記錄",
	"settings.relationPairs": "關聯配對",
	"settings.fieldA": "欄位 A",
	"settings.fieldB": "欄位 B",
	"settings.deletePair": "刪除配對",
	"settings.addPair": "+ 新增配對",
	"settings.showRibbonSyncButton": "顯示功能區同步按鈕",
	"settings.showRibbonSyncButton.desc": "在左側功能區顯示執行完整同步的按鈕。適合在複製筆記等不會觸發自動同步的情況下使用。",

	// 彈窗
	"modal.title": "偵測到新的關聯欄位",
	"modal.hasField": "「{0}」有一個包含 wikilink 的「{1}」欄位。",
	"modal.question": "當「{0}」連結到另一個檔案時，目標檔案的哪個欄位應該接收反向連結？",
	"modal.currentPairs": "目前的配對（{0}）",
	"modal.backlinkField": "反向連結欄位",
	"modal.backlinkField.desc": "目標頁面中要反向連結的欄位",
	"modal.sameField": "{0}（同名欄位）",
	"modal.newFieldName": "或輸入新的欄位名稱",
	"modal.newFieldPlaceholder": "留空則使用上方選擇的欄位",
	"modal.save": "儲存",
	"modal.ignore": "忽略",
	"modal.editTitle": "雙向關聯設定",
	"modal.currentlyPaired": "「{0}」目前與「{1}」配對中。",
	"modal.removePair": "解除配對",
	"modal.close": "關閉",
	"modal.addAnother": "為此屬性欄位新增配對：",
	"modal.pairTag": "來源標籤為「{0}」時",
	"modal.pairTagAny": "任何標籤（備用）",
	"modal.active": "生效中",
	"modal.context": "標籤：{0} → 欄位：{1}",
	"modal.noPairForTag": "⚠️ 標籤「{0}」沒有對應的配對，此頁面的這個屬性欄位不會同步。請在下方新增配對。",

	// 設定：標籤欄位
	"settings.tagA": "標籤 A",
	"settings.tagB": "標籤 B",

	// 彈窗：標籤相關
	"modal.counterpartTag": "目標標籤",
	"modal.counterpartTag.desc": "用來識別此配對目標頁面的標籤",
	"modal.counterpartTag.field": "目標屬性欄位",
	"modal.counterpartTag.placeholder": "輸入標籤",
	"modal.sourceTag": "此頁面的標籤",
	"modal.sourceTag.required": "此頁面沒有標籤，需要設定標籤才能建立配對。",
	"modal.existingPairs": "已設定的配對",

	// 原生風卡片 UI（行動版）
	"modal.addTitle": "新增雙向關聯",
	"modal.editPairTitle": "編輯雙向關聯",
	"modal.activePair": "目前生效的配對",
	"modal.currentPageProperty": "此頁面的屬性欄位",
	"modal.sourceProperty": "此屬性欄位",
	"modal.targetProperty": "目標屬性欄位",
	"modal.setRelationTag": "設定關聯標籤",
	"modal.setRelationField": "設定關聯屬性欄位",
	"modal.relationHelp": "只有標籤和屬性欄位都符合這組配對的頁面，才會作為雙向關聯同步。\n當你在這個屬性欄位新增或變更連結時，Nodian 會自動更新關聯頁面上的對應屬性欄位。\n為了避免判定錯誤，建議使用雙向關聯的頁面只在內建的 tags 屬性中設定一個標籤。",
	"modal.back": "返回",
	"modal.cancel": "取消",
	"settings.editPair": "編輯配對",

	// 屬性按鈕
	"property.paired": "已配對：{0} ↔ {1}",
	"property.clickToSetup": "設定雙向關聯",

	// 右鍵選單
	"menu.configurePair": "設定雙向關聯",
	"menu.editPair": "編輯雙向關聯",
} as Record<string, string>;
