export type ExportMode = "html" | "css";

/** CSS class convention used in "css" mode. */
export type CssStyle = "bem" | "minimal";

export type CodeLang = "html" | "css";

export const DEFAULT_COLOR = "#10b981";

/** Stroke style shared by every decoration line (and future borders). */
export const LINE_STYLES = ["solid", "dashed", "dotted", "double"] as const;
export type LineStyle = (typeof LINE_STYLES)[number];

/** Border sides, in CSS order. Top alone is an overline, bottom an underline. */
export const SIDES = ["top", "right", "bottom", "left"] as const;
export type Side = (typeof SIDES)[number];

/**
 * Optional extras drawn around a word: any combination of the four sides,
 * from a single underline to a full box. Grow this as new complements land
 * (radius, background…); every field needs a default here and a matching
 * entry in the URL schema (src/url-state.ts).
 */
export type Decor = Record<Side, boolean> & {
  lineStyle: LineStyle;
};

export const DEFAULT_DECOR: Decor = {
  top: false,
  right: false,
  bottom: false,
  left: false,
  lineStyle: "solid",
};

export interface RenderOptions {
  mode: ExportMode;
  /** CSS class convention (css mode only). */
  style: CssStyle;
  /** Fill color for the letters. */
  color: string;
  /** Extras drawn around the word. */
  decor: Decor;
}

export interface CodePart {
  title: string;
  lang: CodeLang;
  code: string;
}

/**
 * A letter style. Add a new file under src/fonts/ implementing this, then
 * register it in src/fonts/index.ts — nothing else needs to change.
 */
export interface Font {
  /** Stable id used in URLs / storage. */
  id: string;
  /** Human-readable name for pickers. */
  label: string;
  /** Build the DOM for a word with the given render options. */
  render(word: string, opts: RenderOptions): HTMLElement;
  /**
   * Stylesheet emitted alongside the markup in "css" mode. Omit for fonts
   * that are inline-only (no shared classes). Gets the word so rules for
   * optional parts (line breaks) appear only when used.
   */
  stylesheet?(opts: RenderOptions, word: string): string;
}
