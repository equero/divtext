import { cssRule } from "@/fonts/format";
import {
  GEO_GLYPHS,
  GEO_H,
  GEO_SPACE,
  GEO_T,
  type GeoGlyph,
  type GeoPart,
} from "@/fonts/geo-glyphs";
import { breakRules, inlineStyle, makeBreak, widestLine, wordDecls } from "@/fonts/word-box";
import { SIDES } from "@/fonts/types";
import type { Font, RenderOptions } from "@/fonts/types";

// Geometric font: letters are built from a few positioned boxes instead of a
// pixel matrix. Shape data lives in geo-glyphs.ts; this file only turns parts
// into DOM. Every part is absolutely placed, so the geometry has to stay
// inline even in "css" mode — the classes carry what parts share (position,
// color, border style), the style attribute carries what makes each unique.
const LETTER_GAP = 12;

const BLOCK = "divtext-geo";
const BEM = {
  word: BLOCK,
  letter: `${BLOCK}__letter`,
  part: `${BLOCK}__part`,
  ring: `${BLOCK}__part--ring`,
};
// Minimal convention: a single modifier class, everything else structural.
const MIN_RING = "ring";

// Width is per glyph (I is a stem, W is four strokes), so it stays inline.
const letterDecls: Record<string, string> = {
  position: "relative",
  height: `${GEO_H}px`,
  flex: "0 0 auto",
};

const partDecls = (color: string): Record<string, string> => ({
  position: "absolute",
  "box-sizing": "border-box",
  background: color,
});

const ringDecls = (color: string): Record<string, string> => ({
  background: "none",
  "border-style": "solid",
  "border-color": color,
});

/** Geometry of one part: what the class conventions cannot factor out. */
function partGeometry(part: GeoPart): Record<string, string> {
  const decls: Record<string, string> = {
    left: `${part.x}px`,
    top: `${part.y}px`,
    width: `${part.w}px`,
    height: `${part.h}px`,
  };
  if (part.sides) {
    decls["border-width"] = SIDES.map((side) =>
      part.sides?.includes(side) ? `${GEO_T}px` : "0",
    ).join(" ");
  }
  if (part.radius) decls["border-radius"] = part.radius;
  if (part.rot) decls.transform = `rotate(${part.rot}deg)`;
  return decls;
}

// Word container, sized to the widest line when the word has several.
function containerDecls(opts: RenderOptions, word: string): Record<string, string> {
  const letterWidth = (char: string) => GEO_GLYPHS[char]?.w ?? (char === " " ? GEO_SPACE : null);
  return wordDecls(opts, LETTER_GAP, widestLine(word, LETTER_GAP, letterWidth));
}

function bemStylesheet(opts: RenderOptions, word: string): string {
  return [
    cssRule(`.${BEM.word}`, containerDecls(opts, word)),
    cssRule(`.${BEM.letter}`, letterDecls),
    cssRule(`.${BEM.part}`, partDecls(opts.color)),
    cssRule(`.${BEM.ring}`, ringDecls(opts.color)),
    ...breakRules(opts, BLOCK, word),
  ].join("\n\n");
}

function minimalStylesheet(opts: RenderOptions, word: string): string {
  return [
    cssRule(`.${BLOCK}`, containerDecls(opts, word)),
    cssRule(`.${BLOCK} > div`, letterDecls),
    cssRule(`.${BLOCK} > div > div`, partDecls(opts.color)),
    cssRule(`.${BLOCK} > div > div.${MIN_RING}`, ringDecls(opts.color)),
    ...breakRules(opts, BLOCK, word),
  ].join("\n\n");
}

function stylesheet(opts: RenderOptions, word: string): string {
  return opts.style === "minimal" ? minimalStylesheet(opts, word) : bemStylesheet(opts, word);
}

function makePart(part: GeoPart, opts: RenderOptions): HTMLElement {
  const el = document.createElement("div");
  const geometry = partGeometry(part);
  if (opts.mode !== "css") {
    const paint = part.sides
      ? { ...partDecls(opts.color), ...ringDecls(opts.color) }
      : partDecls(opts.color);
    el.style.cssText = inlineStyle({ ...paint, ...geometry });
    return el;
  }
  if (opts.style === "minimal") {
    if (part.sides) el.className = MIN_RING;
  } else {
    el.className = part.sides ? `${BEM.part} ${BEM.ring}` : BEM.part;
  }
  el.style.cssText = inlineStyle(geometry);
  return el;
}

function makeLetter(glyph: GeoGlyph, opts: RenderOptions): HTMLElement {
  const letter = document.createElement("div");
  const width = { width: `${glyph.w}px` };
  if (opts.mode !== "css") {
    letter.style.cssText = inlineStyle({ ...letterDecls, ...width });
  } else {
    if (opts.style === "bem") letter.className = BEM.letter;
    letter.style.cssText = inlineStyle(width);
  }
  for (const part of glyph.parts) {
    letter.appendChild(makePart(part, opts));
  }
  return letter;
}

function render(word: string, opts: RenderOptions): HTMLElement {
  const line = document.createElement("div");
  if (opts.mode !== "css") {
    line.style.cssText = inlineStyle(containerDecls(opts, word));
  } else {
    line.className = BLOCK; // same container class for both conventions
  }

  for (const char of word.toUpperCase()) {
    const glyph = GEO_GLYPHS[char];
    if (glyph) line.appendChild(makeLetter(glyph, opts));
    else if (char === "\n") line.appendChild(makeBreak(opts, BLOCK));
    // A blank is an empty letter box, so it needs no dedicated class.
    else if (char === " ") line.appendChild(makeLetter({ w: GEO_SPACE, parts: [] }, opts));
  }
  return line;
}

export const geoFont: Font = {
  id: "geo",
  label: "Geometric",
  render,
  stylesheet,
};
