import { cssRule } from "@/fonts/format";
import { SIDES } from "@/fonts/types";
import type { RenderOptions } from "@/fonts/types";

export const LINE = 4; // px thickness of the decoration border
export const LINE_GAP = 8; // px between the word and a decoration line

/**
 * Declarations for the word container: a wrapping row of letters plus the
 * optional decoration borders. Shared by every font so decor behaves the
 * same regardless of how the letters themselves are drawn. `height` is the
 * font's own letter height, which a custom size scales from; `lineWidth` is
 * the widest line of a multi-line word (see widestLine).
 */
export function wordDecls(
  opts: RenderOptions,
  letterGap: number,
  height: number,
  lineWidth?: number,
): Record<string, string> {
  const decor = opts.decor;
  const decls: Record<string, string> = {
    display: "flex",
    "align-items": "flex-start",
    gap: `${letterGap}px`,
    "flex-wrap": "wrap",
  };
  if (decor.size > 0 && decor.size !== height) {
    decls.zoom = String(Math.round((decor.size / height) * 1000) / 1000);
  }
  const sides = SIDES.filter((side) => decor[side]);
  if (sides.length === 0) return decls;

  // Shrink to the word so the lines stop at the last letter.
  if (lineWidth === undefined) {
    decls.width = "max-content";
  } else {
    // The width is the letters alone: keep padding and border outside it,
    // whatever box-sizing the page sets (Tailwind's reset uses border-box).
    decls["box-sizing"] = "content-box";
    decls.width = `${lineWidth}px`;
  }
  decls["max-width"] = "100%";
  const stroke = `${LINE}px ${decor.lineStyle} ${opts.color}`;
  for (const side of sides) {
    decls[`border-${side}`] = stroke;
    decls[`padding-${side}`] = `${LINE_GAP}px`;
  }
  return decls;
}

// A full-width, zero-height flex item: everything after it wraps to a new
// line. Minimal mode needs a class here, since empty letters (blanks) would
// match any structural selector.
const BREAK_DECLS = { "flex-basis": "100%", height: "0" };
const MIN_BREAK = "br";

/** Element for a "\n" in the word. */
export function makeBreak(opts: RenderOptions, block: string): HTMLElement {
  const br = document.createElement("div");
  if (opts.mode !== "css") br.style.cssText = inlineStyle(BREAK_DECLS);
  else br.className = opts.style === "minimal" ? MIN_BREAK : `${block}__break`;
  return br;
}

/** The line-break rule, only when the word spans several lines. */
export function breakRules(opts: RenderOptions, block: string, word: string): string[] {
  if (!word.includes("\n")) return [];
  const selector = opts.style === "minimal" ? `.${block} > .${MIN_BREAK}` : `.${block}__break`;
  return [cssRule(selector, BREAK_DECLS)];
}

/**
 * px width of the widest line of a word with line breaks, or undefined for a
 * single line. A wrapping flex row's max-content puts every item on one
 * line, so a bordered multi-line word would stretch to its whole text; this
 * width fits the longest line instead. `letterWidth` returns null for
 * characters the font skips.
 */
export function widestLine(
  word: string,
  letterGap: number,
  letterWidth: (char: string) => number | null,
): number | undefined {
  if (!word.includes("\n")) return undefined;
  const widths = word
    .toUpperCase()
    .split("\n")
    .map((line) => {
      const items = [...line].map(letterWidth).filter((w): w is number => w !== null);
      return items.reduce((sum, w) => sum + w, 0) + Math.max(0, items.length - 1) * letterGap;
    });
  return Math.max(...widths);
}

/** Collapse declarations into a style attribute value. */
export function inlineStyle(decls: Record<string, string>): string {
  return Object.entries(decls)
    .map(([prop, value]) => `${prop}:${value}`)
    .join(";");
}
