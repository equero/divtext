import { formatHtml } from "@/fonts/format";
import { geoFont } from "@/fonts/geo";
import { pixelBlockFont } from "@/fonts/pixel-block";
import { pixelFont } from "@/fonts/pixel";
import { pixelShadowFont } from "@/fonts/pixel-shadow";
import { DEFAULT_COLOR, DEFAULT_DECOR } from "@/fonts/types";
import type { CodePart, CssStyle, Decor, ExportMode, Font } from "@/fonts/types";

export { DEFAULT_COLOR, DEFAULT_DECOR, LINE_STYLES, SIDES } from "@/fonts/types";
export type {
  CodePart,
  CodeLang,
  CssStyle,
  Decor,
  ExportMode,
  Font,
  LineStyle,
  RenderOptions,
  Side,
} from "@/fonts/types";

// Registry of available letter styles. Add new fonts here.
export const FONTS: Font[] = [pixelFont, pixelBlockFont, pixelShadowFont, geoFont];

export const DEFAULT_FONT = pixelFont;

export function getFont(id: string): Font {
  return FONTS.find((font) => font.id === id) ?? DEFAULT_FONT;
}

/** Everything that shapes a word, beyond the word itself. */
export interface WordStyle {
  font: Font;
  color: string;
  decor: Decor;
}

/** Build the display DOM for a word (self-contained inline styles). */
export function renderWord(word: string, style: WordStyle): HTMLElement {
  return style.font.render(word, {
    mode: "html",
    style: "bem",
    color: style.color,
    decor: style.decor,
  });
}

/** Copy-paste-ready code for a word, split into blocks per the chosen mode. */
export function exportParts(
  word: string,
  wordStyle: WordStyle,
  mode: ExportMode,
  style: CssStyle = "bem",
): CodePart[] {
  const { font, color, decor } = wordStyle;
  const opts = { mode, style, color, decor };
  const markup = formatHtml(font.render(word, opts));
  if (mode === "css" && font.stylesheet) {
    // CSS and HTML kept as separate blocks.
    return [
      { title: "styles.css", lang: "css", code: font.stylesheet(opts, word) },
      { title: "index.html", lang: "html", code: markup },
    ];
  }
  return [{ title: "index.html", lang: "html", code: markup }];
}
