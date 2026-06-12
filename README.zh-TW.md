[English](README.md) | [中文](README.zh-TW.md) | [日本語](README.ja.md)

# Nodian

一個 [Obsidian](https://obsidian.md) 外掛，自動同步 YAML frontmatter 中的雙向關聯。

當你在一個檔案的屬性欄位中加入 wikilink，外掛會自動在目標檔案的對應屬性欄位寫入反向連結——刪除連結時也會自動移除。

![Nodian 總覽](https://github.com/user-attachments/assets/fc2675f3-85f6-44db-8186-7d780bdfbcdb)


## 範例

```
Person.md                          Mail.md
─────────                          ─────────
tags: [Person]                     tags: [Mail]
Mail: [[hello@example]]     →     Person: [[Alice]]        ← 自動產生
```

## 功能

- **自動同步** — 在一個檔案新增或移除連結，另一側即時更新
- **關聯配對** — 定義哪些屬性欄位是成對的（例如 `Mail ↔ Person`、`Artist ↔ Songs`）
- **標籤比對** — 每個配對都需要標籤；只有屬性欄位和標籤都符合時才會同步
- **顯示名稱** — 可選擇使用 `title` 屬性作為反向連結的顯示文字
- **新檔案支援** — 從 wikilink 建立檔案時，自動加上標籤和反向連結
- **完整同步** — 從功能區圖示、設定或命令面板一鍵執行
- **多語言** — 支援英文、日文、繁體中文
- **行動裝置支援** — 手機版提供專屬的卡片式配對管理介面

---

## 安裝

### 使用 BRAT（推薦）

1. 從 Community Plugins 安裝 [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. BRAT → Add Beta Plugin → `AkiSantin/Nodian`

### 手動安裝

將 `main.js`、`manifest.json` 和 `styles.css` 複製到：

```
<vault>/.obsidian/plugins/nodian/
```

重新啟動 Obsidian → 設定 → Community Plugins → 啟用 Nodian。

---

## 快速開始

### 步驟一：建立第一個配對

打開任意 `.md` 檔案，在 YAML 屬性欄位中加入 wikilink：

```yaml
---
tags: [Person]
Mail: "[[hello@example]]"
---
```

對屬性名稱按右鍵 → 選擇**設定雙向關聯**。

在彈出的視窗中設定對應屬性欄位（例如 `Person`）和標籤，然後按**儲存**。

### 步驟二：驗證

打開 `hello@example.md`——你應該會看到：

```yaml
---
tags: [Mail]
Person: "[[Alice]]"
---
```

完成。從現在起，任何檔案的 `Mail` 欄位都會自動與目標檔案的 `Person` 欄位同步。

### 步驟三：完整同步（既有儲存庫）

如果你的儲存庫已經有現成的關聯資料，用以下任一方式執行一次完整同步：

- 點選左側**功能區的同步圖示**
- 設定 → Nodian → **執行完整同步**
- 命令面板（`Cmd/Ctrl+P`）→ **同步所有雙向關聯**

這會掃描所有檔案，補上缺少的反向連結。

---

## 使用指南

### 新增連結

在任何已配對的屬性欄位中加入 wikilink，反向連結會自動出現在目標檔案。

```yaml
# 你在 Artist.md 中輸入：
Songs: "[[Blue Sky]]"

# 外掛自動在 Blue Sky.md 中產生：
Artist: "[[Artist Name]]"
```

### 移除連結

從屬性欄位中刪除 wikilink，目標檔案中的反向連結會自動移除。

### 多個連結

一個屬性欄位可以包含多個 wikilink：

```yaml
Songs:
  - "[[Blue Sky]]"
  - "[[Red Moon]]"
  - "[[Green Field]]"
```

每個目標檔案都會得到自己的反向連結。移除一個連結只會影響該目標。

### 自我關聯

屬性欄位可以與自己配對：

```
Related ↔ Related
```

在 A.md 中加入 `Related: [[B]]`，B.md 中會自動加入 `Related: [[A]]`。

### 顯示名稱

預設情況下，反向連結只使用檔案名稱：`[[my-artist-id]]`。

若要使用 `title` 屬性作為顯示文字，請在設定中啟用**使用 title 作為顯示名稱**。啟用後，反向連結會顯示為 `[[my-artist-id|Some Artist Name]]`（使用來源檔案 `title` frontmatter 屬性的值）。只有 `title` 屬性會被使用——不會讀取 `aliases`。

切換此設定不會自動更新既有的反向連結。變更後，請執行一次完整同步來更新所有反向連結。

### 新檔案建立

如果你連結到一個尚未存在的檔案：

```yaml
Mail: "[[new-contact]]"
```

當 `new-contact.md` 被建立時（例如在 Obsidian 中點選該連結），外掛會：
1. 自動為新檔案加上對應的標籤
2. 自動寫入反向連結

### 手機版

在手機上，Nodian 使用原生風格的卡片介面：

- 點一下屬性圖示 → **雙向關聯設定**畫面會以卡片列出目前生效的配對和此屬性的其他配對
- **＋** 按鈕會開啟專屬的新增畫面，標籤和屬性欄位都有自動完成建議
- 設定 → **關聯配對**以同樣的卡片顯示，可編輯／刪除

桌面版的版面不變。

---

## 標籤

每個關聯配對都有兩個標籤——**標籤 A** 和 **標籤 B**——分別對應屬性 A 和屬性 B。標籤是**必填**的，不可省略。

### 標籤的運作方式

外掛只在**同時**滿足以下兩個條件時才會同步：

1. 來源檔案有一個符合配對屬性名稱的屬性欄位
2. 來源檔案的標籤符合該配對對應的標籤

這可以防止錯誤的目標同步。例如，如果 `Release` 和 `Song` 兩種檔案都有 `Artist` 欄位，標籤可以確保每個配對只對正確的檔案類型生效——帶 `Release` 標籤的檔案使用 `Artist ↔ Release` 配對，帶 `Song` 標籤的檔案使用 `Artist ↔ Song` 配對。

### 自動標籤指派

- 透過選單建立配對時，會自動使用來源檔案的標籤。
- 從 wikilink 建立新檔案時，外掛會自動從配對定義中指派對應的標籤。

---

## 設定

前往設定 → Nodian。

### 關聯配對

新增、編輯或移除屬性配對。每個配對定義兩個屬性名稱和兩個標籤，構成雙向關聯。

| 設定 | 預設值 | 說明 |
|------|--------|------|
| 自動同步 | 開啟 | 編輯時自動同步反向連結 |
| 使用 title 作為顯示名稱 | 關閉 | 在反向連結中使用 `title` 屬性作為顯示文字。變更後請執行完整同步。 |
| 顯示功能區同步按鈕 | 開啟 | 在左側功能區顯示執行完整同步的按鈕 |
| 除錯模式 | 關閉 | 在開發者主控台輸出詳細記錄（`Cmd/Ctrl+Option+I`，篩選 `[YBR]`） |

![設定畫面](https://github.com/user-attachments/assets/979f514d-99eb-44be-8895-65b566552455)


---

## 配對範例

每個配對在設定中也會有對應的標籤 A 和標籤 B。以下表格只顯示屬性配對——標籤在建立配對時透過設定或選單指定。

音樂儲存庫：

| 屬性 A | ↔ | 屬性 B |
|--------|---|--------|
| Artist | ↔ | Release |
| Artist | ↔ | Tracks |
| Composer | ↔ | Works |
| Label | ↔ | Releases |
| Related | ↔ | Related |

公司/CRM 儲存庫：

| 屬性 A | ↔ | 屬性 B |
|--------|---|--------|
| Mail | ↔ | Person |
| Mail | ↔ | Domain |
| Mail | ↔ | Account |
| Service | ↔ | Account |

---

## 注意事項

- **首次使用前請備份你的儲存庫。** 此外掛會直接修改 YAML frontmatter。雖然只會觸碰配對中定義的屬性欄位，但如果你有複雜的自訂 YAML，可能會出現非預期的格式變更。
- **刪除檔案**不會移除指向它的反向連結——這些會成為未解析的連結（這是設計上的選擇，以防止意外資料遺失）。
- **重新命名檔案**由 Obsidian 內建的連結更新器處理——外掛不需要額外處理。
- **重複配對**（例如 `A ↔ B` 和 `B ↔ A`）是多餘的——一個配對就涵蓋了雙向。
- **重複的檔案名稱** — 不同資料夾中有相同名稱的檔案可能導致同步目標錯誤。請使用唯一的檔案名稱以避免混淆。
- **系統屬性**（`title`、`aliases`、`tags`、`cssclasses`、`publish` 等）不能作為關聯欄位使用。

---

## 授權

MIT
