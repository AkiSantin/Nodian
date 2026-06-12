export default {
	// コマンド
	"cmd.syncAll": "すべての双方向リレーションを同期",
	"ribbon.syncAll": "すべての双方向リレーションを同期",

	// 通知
	"notice.syncComplete": "同期完了：{0} 件のファイルを更新しました",
	"notice.pairCreated": "✅ ペア：{0} ↔ {1}",
	"notice.fileNotFound": "⚠️ ファイルが見つかりません：{0}.md",
	"notice.backlinkAdded": "✅ {0} → {1}：{2}",
	"notice.backlinksCreated": "✅ {0}：{1} 件のファイルからバックリンクを作成しました",
	"notice.pairRemoved": "{0} のペアを解除しました",
	"notice.fieldUpdate": "Nodian：{0} →「{1}」プロパティに書き込み中：{2}",

	// 設定
	"settings.fullSync": "フル同期",
	"settings.fullSync.desc": "⚠️ フル同期は保管庫全体をスキャンし、設定済みのペアに不足しているバックリンクを補完します。既存の YAML frontmatter が変更される可能性があります。実行前にペア設定をご確認ください。",
	"settings.fullSync.button": "フル同期を実行",
	"settings.autoSync": "自動同期",
	"settings.autoSync.desc": "ファイル変更時に双方向リレーションを自動同期する",
	"settings.useDisplayName": "title を表示名として使用",
	"settings.useDisplayName.desc": "バックリンクの表示名に title プロパティを使用します（例: [[ファイル名|title]]）。オフの場合はファイル名のみ。変更後はフル同期を実行してください。",
	"settings.debug": "デバッグモード",
	"settings.debug.desc": "開発者コンソールに詳細ログを出力する",
	"settings.relationPairs": "リレーションペア",
	"settings.fieldA": "フィールド A",
	"settings.fieldB": "フィールド B",
	"settings.deletePair": "ペアを削除",
	"settings.addPair": "+ ペアを追加",
	"settings.showRibbonSyncButton": "リボン同期ボタンを表示",
	"settings.showRibbonSyncButton.desc": "左側のリボンにフル同期ボタンを表示します。ノートをコピーして作成した場合など、自動同期が働かないときに便利です。",

	// モーダル
	"modal.title": "新しいリレーションフィールドを検出",
	"modal.hasField": "「{0}」に wikilink を含む「{1}」フィールドがあります。",
	"modal.question": "「{0}」が別のファイルにリンクしている場合、そのファイルのどのフィールドにバックリンクを追加しますか？",
	"modal.currentPairs": "現在のペア（{0}）",
	"modal.backlinkField": "バックリンクフィールド",
	"modal.backlinkField.desc": "バックリンクを受け取るターゲットファイルのフィールド",
	"modal.sameField": "{0}（同名フィールド）",
	"modal.newFieldName": "または新しいフィールド名を入力",
	"modal.newFieldPlaceholder": "空欄の場合は上の選択を使用",
	"modal.save": "保存",
	"modal.ignore": "無視",
	"modal.editTitle": "双方向リレーション設定",
	"modal.currentlyPaired": "「{0}」は現在「{1}」とペアになっています。",
	"modal.removePair": "ペアを解除",
	"modal.close": "閉じる",
	"modal.addAnother": "このプロパティに別のペアを追加：",
	"modal.pairTag": "ソースタグが「{0}」の場合",
	"modal.pairTagAny": "任意のタグ（フォールバック）",
	"modal.active": "適用中",
	"modal.context": "タグ：{0} → フィールド：{1}",
	"modal.noPairForTag": "⚠️ タグ「{0}」に対応するペアがありません。このページではこのプロパティは同期されません。下でペアを追加してください。",

	// 設定：タグフィールド
	"settings.tagA": "タグ A",
	"settings.tagB": "タグ B",

	// モーダル：タグ関連
	"modal.counterpartTag": "ターゲットタグ",
	"modal.counterpartTag.desc": "このペアの対象ファイルを識別するタグ",
	"modal.counterpartTag.field": "ターゲットプロパティ",
	"modal.counterpartTag.placeholder": "タグを入力",
	"modal.sourceTag": "このページのタグ",
	"modal.sourceTag.required": "このページにタグがありません。ペアを作成するにはタグが必要です。",
	"modal.existingPairs": "既存のペア",

	// ネイティブ風カード UI（モバイル）
	"modal.addTitle": "双方向リレーションを追加",
	"modal.editPairTitle": "双方向リレーションを編集",
	"modal.activePair": "適用中のペア",
	"modal.currentPageProperty": "このページのプロパティ",
	"modal.sourceProperty": "このプロパティ",
	"modal.targetProperty": "ターゲットプロパティ",
	"modal.setRelationTag": "リレーションタグを設定",
	"modal.setRelationField": "リレーションプロパティを設定",
	"modal.relationHelp": "タグとプロパティの組み合わせが一致するページだけを、双方向リレーションとして同期します。\nこのプロパティを追加・変更すると、リレーション先のページ側も自動更新されます。\n誤判定を防ぐため、tags は 1 つだけにすることをおすすめします。",
	"modal.back": "戻る",
	"modal.cancel": "キャンセル",
	"settings.editPair": "ペアを編集",

	// プロパティボタン
	"property.paired": "ペア設定済み：{0} ↔ {1}",
	"property.clickToSetup": "双方向リレーションを設定",

	// コンテキストメニュー
	"menu.configurePair": "双方向リレーションを設定",
	"menu.editPair": "双方向リレーションを編集",
} as Record<string, string>;
