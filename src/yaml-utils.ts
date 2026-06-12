/**
 * YAML frontmatter utilities.
 *
 * Uses line-by-line parsing for WRITES to avoid regex edge cases
 * with wikilinks (unquoted [[X]] is technically a YAML flow sequence).
 * Relies on Obsidian's metadataCache for READS.
 */

export interface FrontmatterSplit {
	yaml: string;
	body: string;
}

/**
 * Split file content into frontmatter YAML string and body.
 */
export function splitFrontmatter(content: string): FrontmatterSplit | null {
	if (!content.startsWith("---")) return null;

	// Find closing ---
	const closingIndex = content.indexOf("\n---", 3);
	if (closingIndex === -1) return null;

	const yaml = content.slice(content.indexOf("\n") + 1, closingIndex);
	const afterClosing = closingIndex + 4; // skip \n---
	const body = content.slice(afterClosing);

	return { yaml, body };
}

/**
 * Format field value as YAML block list (Obsidian-safe).
 * Inline flow arrays with wikilinks are broken in Obsidian Properties UI,
 * so we always emit block form: "  - value" per line.
 */
function formatFieldValue(values: string[]): string {
	if (values.length === 0) return "[]";
	return "\n" + values.map((v) => `  - ${JSON.stringify(v)}`).join("\n");
}

/**
 * Check if a line is a continuation of a multi-line value (indented).
 */
function isContinuationLine(line: string): boolean {
	return /^\s+/.test(line) && line.trim().length > 0;
}

/**
 * Find a field in yaml lines. Returns { startIndex, endIndex (exclusive) }
 * covering the field line and all its continuation lines (multi-line arrays).
 */
function findFieldRange(
	lines: string[],
	fieldName: string
): { start: number; end: number } | null {
	const prefix = `${fieldName}:`;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line.startsWith(prefix)) continue;
		// Ensure exact match: after "fieldName:" should be space, tab, or end of line
		if (line.length > prefix.length) {
			const next = line[prefix.length];
			if (next !== " " && next !== "\t") continue;
		}

		// Find where this field's value ends (multi-line continuation)
		let end = i + 1;
		while (end < lines.length && isContinuationLine(lines[end])) {
			end++;
		}

		return { start: i, end };
	}
	return null;
}

/**
 * Validate YAML structure. Catches:
 * 1. Two fields glued on same line ("]FieldName:")
 * 2. Orphaned continuation lines after inline values
 */
function validateYaml(yamlStr: string): boolean {
	const lines = yamlStr.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === "") continue;

		if (isContinuationLine(line)) {
			// Continuation line must follow either another continuation line
			// or a field line with EMPTY inline value (e.g., "field:" or "field:  ")
			let prev = i - 1;
			while (prev >= 0 && lines[prev].trim() === "") prev--;
			if (prev >= 0 && !isContinuationLine(lines[prev])) {
				const colonIdx = lines[prev].indexOf(":");
				if (colonIdx >= 0) {
					const afterColon = lines[prev].slice(colonIdx + 1).trim();
					if (afterColon !== "") {
						// Previous field has an inline value — this continuation is orphaned!
						return false;
					}
				}
			}
			continue;
		}

		// Non-continuation, non-empty line must be a valid field
		if (!line.includes(":")) return false;
		// Check no two fields glued on same line
		if (/\][A-Za-z]/.test(line)) return false;
	}
	return true;
}

/**
 * Update a specific field in file content's frontmatter.
 * Line-by-line approach: find the field lines, replace them, reconstruct.
 *
 * SAFETY: validates output before returning. If output would be corrupt,
 * returns original content unchanged and logs error.
 */
export function updateFieldInContent(
	content: string,
	fieldName: string,
	newValues: string[]
): string {
	const split = splitFrontmatter(content);

	if (!split) {
		const value = formatFieldValue(newValues);
		return `---\n${fieldName}: ${value}\n---\n${content}`;
	}

	const { yaml, body } = split;
	const lines = yaml.split("\n");

	const range = findFieldRange(lines, fieldName);

	let newLines: string[];

	if (range) {
		const value = formatFieldValue(newValues);
		const newFieldLine = `${fieldName}: ${value}`;
		newLines = [
			...lines.slice(0, range.start),
			newFieldLine,
			...lines.slice(range.end),
		];
	} else {
		const value = formatFieldValue(newValues);
		newLines = [...lines, `${fieldName}: ${value}`];
	}

	// Remove trailing empty lines
	while (newLines.length > 0 && newLines[newLines.length - 1].trim() === "") {
		newLines.pop();
	}

	const newYaml = newLines.join("\n");

	// SAFETY CHECK: validate output before returning
	if (!validateYaml(newYaml)) {
		console.error(
			`[YBR] BLOCKED corrupt YAML write for field "${fieldName}".`,
			`rangeFound=${!!range}`,
			`valueCount=${newValues.length}`
		);
		return content; // Return original, don't corrupt
	}

	return `---\n${newYaml}\n---${body}`;
}

/**
 * Read all wikilink strings from a specific field in raw YAML text.
 * Line-by-line parsing to handle both inline and multi-line formats.
 */
export function readFieldWikilinks(
	yamlString: string,
	fieldName: string
): string[] {
	const lines = yamlString.split("\n");
	const range = findFieldRange(lines, fieldName);
	if (!range) return [];

	const fieldLines = lines.slice(range.start, range.end);
	const allText = fieldLines.join(" ");

	const links: string[] = [];
	const linkRegex = /\[\[[^\]]+\]\]/g;
	let m;
	while ((m = linkRegex.exec(allText)) !== null) {
		links.push(m[0]);
	}
	return links;
}

/**
 * Check whether raw YAML text contains a top-level `tags` field.
 * Single predicate shared by every auto-tag write site, so all of them
 * recognize the same spelling variants (e.g. "tags:" and "tags :").
 */
export function yamlHasTagsField(yamlString: string): boolean {
	return yamlString.split("\n").some((line) => /^tags\s*:/.test(line));
}
