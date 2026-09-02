[English](README.md) | [中文](https://github.com/AkiSantin/Nodian/blob/main/README.zh-TW.md) | [日本語](https://github.com/AkiSantin/Nodian/blob/main/README.ja.md)

# Nodian

An [Obsidian](https://obsidian.md) plugin that automatically syncs bidirectional relations in YAML frontmatter.

When you add a wikilink to a property in one file, the plugin writes a backlink in the target file's corresponding property — and removes it when you delete the link.

![Nodian overview](https://github.com/user-attachments/assets/92f5e2b4-2633-4374-b64f-5725a8c032e9)


## Example

```
Person.md                          Mail.md
─────────                          ─────────
tags: [Person]                     tags: [Mail]
Mail: [[hello@example]]     →     Person: [[Alice]]        ← auto-generated
```


![Relation modal](https://github.com/user-attachments/assets/d7b0725f-295f-4bc2-a718-3aa7654148d3)


## Features

- **Auto sync** — add or remove a link in one file, the other side updates instantly
- **Relation pairs** — define which properties are paired (e.g. `Mail ↔ Person`, `Artist ↔ Songs`)
- **Tag-based matching** — each pair supports tags; when set, sync only fires when both property and tag match
- **Display names** — optionally use the `title` property as display text in backlinks
- **New file support** — creating a file from a wikilink auto-adds tags and backlinks
- **Full sync** — one click from the ribbon icon, settings, or Command Palette
- **Localized** — English, Japanese, Traditional Chinese
- **Mobile support** — phone-optimized card UI for managing pairs

## Works well with Obsidian Bases

Nodian can connect different Bases through typed YAML relations.

For example, you can have one Base filtered by `#Person` and another Base filtered by `#Mail`. When a `Person` note links to a `Mail` note through the `Mail` property, Nodian automatically writes the reverse `Person` property in the Mail note.

Because relation pairs support tags on both sides, the same property name can safely be used in different Bases without triggering the wrong relation.

---

## Install

### With BRAT (recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins
2. BRAT → Add Beta Plugin → `AkiSantin/Nodian`

### Manual

Copy `main.js`, `manifest.json`, and `styles.css` to:

```
<vault>/.obsidian/plugins/nodian/
```

Restart Obsidian → Settings → Community Plugins → Enable Nodian.

---

## Getting Started

### Step 1: Set up your first pair

Open any `.md` file and add a wikilink to a YAML property:

```yaml
---
tags: [Person]
Mail: "[[hello@example]]"
---
```

Right-click the property name → select **Configure bidirectional relation**.

In the modal, set the counterpart property (e.g. `Person`) and tags, then press **Save**.

### Step 2: Verify

Open `hello@example.md` — you should see:

```yaml
---
tags: [Mail]
Person: "[[Alice]]"
---
```

That's it. From now on, any file's `Mail` property will automatically sync with the target file's `Person` property.

### Step 3: Run full sync (existing vaults)

If your vault already has existing relations, run a one-time full sync in any of these ways:

- Click the **sync icon** in the left ribbon
- Settings → Nodian → **Run full sync**
- Command Palette (`Cmd/Ctrl+P`) → **Sync all bidirectional relations**

This scans every file and backfills any missing backlinks.

---

## Usage Guide

### Adding a link

Add a wikilink to any paired property. The backlink appears in the target file automatically.

```yaml
# You type this in Artist.md:
Songs: "[[Blue Sky]]"

# Plugin auto-generates this in Blue Sky.md:
Artist: "[[Artist Name]]"
```

### Removing a link

Delete the wikilink from the property. The backlink in the target file is removed automatically.

### Multiple links

A property can hold multiple wikilinks:

```yaml
Songs:
  - "[[Blue Sky]]"
  - "[[Red Moon]]"
  - "[[Green Field]]"
```

Each target file gets its own backlink. Removing one link only affects that specific target.

### Self-relations

A property can be paired with itself:

```
Related ↔ Related
```

Adding `Related: [[B]]` in A.md will add `Related: [[A]]` in B.md.

### Display names

By default, backlinks use the plain filename: `[[my-artist-id]]`.

To use the `title` property as display text, enable **Use title as display name** in Settings. Backlinks will appear as `[[my-artist-id|Some Artist Name]]` (using the value of the source file's `title` frontmatter property). Only the `title` property is used — `aliases` are not checked.

Toggling this setting does not retroactively update existing backlinks. After changing it, run a full sync to update all backlinks across the vault.

### New file creation

If you link to a file that doesn't exist yet:

```yaml
Mail: "[[new-contact]]"
```

When `new-contact.md` is created (e.g. by clicking the link in Obsidian), the plugin will:
1. Add the appropriate tag to the new file
2. Write the backlink automatically

### On mobile

On phones, Nodian uses a native-style card UI:

- Tap a property icon → **Edit bidirectional relation** opens a screen that lists the active pair and the other pairs for that property as cards
- The **+** button opens a dedicated add screen with autocomplete for tags and properties
- Settings → **Relation pairs** shows the same cards with edit / delete actions

The desktop layout is unchanged.

---

## Tags

Every relation pair supports two tags — **Tag A** and **Tag B** — that correspond to Property A and Property B. Tags are optional.

### How tags work

When tags are used, the plugin only syncs when **both** conditions are met:

1. The source file has a property that matches a pair's property name
2. The source file's tag matches that pair's corresponding tag

This prevents wrong-target sync. For example, if both `Release` files and `Song` files have an `Artist` property, the tag ensures each pair only fires for the correct file type — a `Release`-tagged file uses the `Artist ↔ Release` pair, while a `Song`-tagged file uses the `Artist ↔ Song` pair.

### Automatic tag assignment

- When you set up a pair through the context menu, the source file's tag is used automatically.
- When a new file is created from a wikilink, the plugin auto-assigns the appropriate tag from the pair definition.

---

## Settings

Go to Settings → Nodian.

### Relation pairs

Add, edit, or remove property pairs. Each pair defines two property names and two optional tags that are bidirectionally linked.

| Setting | Default | Description |
|---------|---------|-------------|
| Auto sync | ON | Sync backlinks automatically when editing |
| Use title as display name | OFF | Use the `title` property as display text in backlinks. Run a full sync after changing. |
| Show ribbon sync button | ON | Show a button in the left ribbon for running a full sync |
| Debug mode | OFF | Log detailed info to the developer console (`Cmd/Ctrl+Option+I`, filter by `[YBR]`) |


![Settings](https://github.com/user-attachments/assets/82d94f65-ce9f-4014-88f2-10b204fd80c5)



---

## Pair Examples

Each pair also has Tag A and Tag B configured alongside the properties in Settings. The tables below show the property pairings only — tags are assigned through the settings or context menu when you create each pair.

A music vault:

| Property A | ↔ | Property B |
|------------|---|------------|
| Artist | ↔ | Release |
| Artist | ↔ | Tracks |
| Composer | ↔ | Works |
| Label | ↔ | Releases |
| Related | ↔ | Related |

A company/CRM vault:

| Property A | ↔ | Property B |
|------------|---|------------|
| Mail | ↔ | Person |
| Mail | ↔ | Domain |
| Mail | ↔ | Account |
| Service | ↔ | Account |

---

## Important Notes

- **Back up your vault before first use.** This plugin modifies YAML frontmatter directly. While it only touches properties defined in your pairs, unexpected formatting changes are possible if you have complex custom YAML.
- **Deleting a file** does not remove backlinks pointing to it — those become unresolved links (by design, to prevent accidental data loss).
- **Renaming a file** is handled by Obsidian's built-in link updater — the plugin doesn't need to do anything extra.
- **Duplicate pairs** (e.g. `A ↔ B` and `B ↔ A`) are redundant — one pair covers both directions.
- **Duplicate basenames** — files with the same name in different folders may cause incorrect sync targets. Use unique filenames to avoid ambiguity.
- **System properties** (`title`, `aliases`, `tags`, `cssclasses`, `publish`, etc.) cannot be used as relation properties.
- **Not using tags** risks wrong-target sync. Take care when leaving tags empty.

---

## License

MIT
