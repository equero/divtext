import { cssRule } from "@/fonts/format";
import { GLYPHS } from "@/fonts/glyphs";
import { inlineStyle, wordDecls as boxDecls } from "@/fonts/word-box";
import type { Font, RenderOptions } from "@/fonts/types";

const CELL = 8; // px per cell, unless the spec sets its own size
const SPACE = 24; // px width of a blank space

/** What separates one grid font from another: glyphs, spacing and cell shape. */
export interface GridFontSpec {
  /** Stable id used in URLs / storage. */
  id: string;
  /** Human-readable name for pickers. */
  label: string;
  /** CSS block name, root of the BEM class names. */
  block: string;
  /** Glyph matrices ("#" lit, "." empty); all the same height. Default: GLYPHS. */
  glyphs?: Record<string, string[]>;
  /** px size of a cell. Default: 8 × 8. */
  cellWidth?: number;
  cellHeight?: number;
  /** px between cells; 0 welds the cells into solid strokes. */
  gap: number;
  /** px between letters. */
  letterGap: number;
  /** px corner radius of a lit cell. */
  radius: number;
}

// Minimal convention: only two classes; everything else is structural.
const MIN_ON = "on";

/**
 * Visit a glyph column by column. Letters fill their grid in this order
 * (grid-auto-flow: column), so each glyph takes its own width without any
 * per-letter CSS.
 */
function forEachCell(rows: string[], visit: (r: number, c: number) => void): void {
  for (let c = 0; c < rows[0].length; c++) {
    for (let r = 0; r < rows.length; r++) visit(r, c);
  }
}

/** Build a grid font (glyph matrices) from its spec. */
export function createGridFont(spec: GridFontSpec): Font {
  const {
    block,
    glyphs = GLYPHS,
    cellWidth = CELL,
    cellHeight = CELL,
    gap,
    letterGap,
    radius,
  } = spec;
  const rowCount = glyphs.A.length;
  // A blank in minimal mode is an empty letter as wide as "A".
  const emptyRows = Array.from({ length: rowCount }, () => ".".repeat(glyphs.A[0].length));

  // BEM class names.
  const BEM = {
    word: block,
    letter: `${block}__letter`,
    cell: `${block}__cell`,
    cellOn: `${block}__cell--on`,
    space: `${block}__space`,
  };

  const gridDecls: Record<string, string> = {
    display: "grid",
    "grid-template-rows": `repeat(${rowCount}, ${cellHeight}px)`,
    "grid-auto-flow": "column",
    "grid-auto-columns": `${cellWidth}px`,
    ...(gap > 0 ? { gap: `${gap}px` } : {}),
  };
  const letterDecls: Record<string, string> = {
    ...gridDecls,
    flex: "0 0 auto",
  };
  const letterInline = inlineStyle(letterDecls).replaceAll(", ", ",");

  const cellSize = { width: `${cellWidth}px`, height: `${cellHeight}px` };

  const onDecls = (color: string): Record<string, string> => ({
    background: color,
    ...(radius > 0 ? { "border-radius": `${radius}px` } : {}),
  });

  // Container declarations, shared by both class conventions and inline mode.
  const wordDecls = (opts: RenderOptions): Record<string, string> =>
    boxDecls(opts, letterGap);

  // BEM: one class per role. Five classes, no structural coupling.
  function bemStylesheet(opts: RenderOptions): string {
    return [
      cssRule(`.${BEM.word}`, wordDecls(opts)),
      cssRule(`.${BEM.letter}`, letterDecls),
      cssRule(`.${BEM.cell}`, cellSize),
      cssRule(`.${BEM.cellOn}`, onDecls(opts.color)),
      cssRule(`.${BEM.space}`, { width: `${SPACE}px`, flex: "0 0 auto" }),
    ].join("\n\n");
  }

  // Minimal: one container class + one modifier. Letters/cells matched by
  // structure; blank spaces are just empty letter grids (no extra class).
  function minimalStylesheet(opts: RenderOptions): string {
    return [
      cssRule(`.${block}`, wordDecls(opts)),
      cssRule(`.${block} > div`, letterDecls),
      cssRule(`.${block} > div > div`, cellSize),
      cssRule(`.${block} > div > div.${MIN_ON}`, onDecls(opts.color)),
    ].join("\n\n");
  }

  function stylesheet(opts: RenderOptions): string {
    return opts.style === "minimal" ? minimalStylesheet(opts) : bemStylesheet(opts);
  }

  function makeCell(on: boolean, opts: RenderOptions): HTMLElement {
    const dot = document.createElement("div");
    if (opts.mode !== "css") {
      dot.style.cssText = inlineStyle({ ...cellSize, ...(on ? onDecls(opts.color) : {}) });
    } else if (opts.style === "minimal") {
      if (on) dot.className = MIN_ON;
    } else {
      dot.className = on ? `${BEM.cell} ${BEM.cellOn}` : BEM.cell;
    }
    return dot;
  }

  function makeGlyph(rows: string[], opts: RenderOptions): HTMLElement {
    const letter = document.createElement("div");
    if (opts.mode !== "css") {
      letter.style.cssText = letterInline;
    } else if (opts.style === "bem") {
      letter.className = BEM.letter;
    }
    forEachCell(rows, (r, c) => letter.appendChild(makeCell(rows[r][c] === "#", opts)));
    return letter;
  }

  function render(word: string, opts: RenderOptions): HTMLElement {
    const line = document.createElement("div");
    if (opts.mode !== "css") {
      line.style.cssText = inlineStyle(wordDecls(opts));
    } else {
      line.className = block; // same container class for both conventions
    }

    for (const char of word.toUpperCase()) {
      const glyph = glyphs[char];
      if (glyph) {
        line.appendChild(makeGlyph(glyph, opts));
      } else if (char === " ") {
        if (opts.mode === "css" && opts.style === "minimal") {
          // A blank is an empty letter grid, so no dedicated class is needed.
          line.appendChild(makeGlyph(emptyRows, opts));
        } else {
          const space = document.createElement("div");
          if (opts.mode === "css") space.className = BEM.space;
          else space.style.cssText = `width:${SPACE}px;flex:0 0 auto`;
          line.appendChild(space);
        }
      }
    }
    return line;
  }

  return { id: spec.id, label: spec.label, render, stylesheet };
}
