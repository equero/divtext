import { cssRule } from "@/fonts/format";
import { GLYPHS } from "@/fonts/glyphs";
import { inlineStyle, wordDecls as boxDecls } from "@/fonts/word-box";
import { SIDES } from "@/fonts/types";
import type { Font, RenderOptions, Side } from "@/fonts/types";

const CELL = 8; // px per cell, unless the spec sets its own size
const SPACE = 24; // px width of a blank space
const EDGE = 3; // px stroke of the shadow outline (3 is the minimum for double)
const SIDE_CLASS = { top: "t", right: "r", bottom: "b", left: "l" } as const;

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
  /**
   * Draw an outline of the glyph half a cell down-right, behind the cells,
   * in the decor line style (ANSI Shadow look). Needs gap 0: the solid
   * cells are what hide the inner part of the outline.
   */
  shadow?: boolean;
}

// Minimal convention: only two classes; everything else is structural.
// The shadow layer adds its own class plus one per outlined side.
const MIN_ON = "on";
const MIN_SHADOW = "sh";

const EMPTY_SIDES: Record<Side, boolean> = { top: false, right: false, bottom: false, left: false };

/** Sides of a lit cell that face an unlit cell: the glyph's outline. */
function outlineSides(rows: string[], r: number, c: number): Record<Side, boolean> {
  const lit = (rr: number, cc: number) => rows[rr]?.[cc] === "#";
  return {
    top: !lit(r - 1, c),
    right: !lit(r, c + 1),
    bottom: !lit(r + 1, c),
    left: !lit(r, c - 1),
  };
}

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
    shadow = false,
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
    shadow: `${block}__shadow`,
    edge: `${block}__edge`,
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
    // Own stacking context, so the shadow layer sits behind the cells only.
    ...(shadow ? { position: "relative", isolation: "isolate" } : {}),
  };
  const letterInline = inlineStyle(letterDecls).replaceAll(", ", ",");

  // Shadow layer: same grid, shifted half a cell down-right, behind the cells.
  const shadowDecls: Record<string, string> = {
    ...gridDecls,
    position: "absolute",
    top: `${cellHeight / 2}px`,
    left: `${cellWidth / 2}px`,
    "z-index": "-1",
  };
  const edgeDecls = (side: Side, opts: RenderOptions): Record<string, string> => ({
    [`border-${side}`]: `${EDGE}px ${opts.decor.lineStyle} ${opts.color}`,
  });
  const cellSize = { width: `${cellWidth}px`, height: `${cellHeight}px` };
  const edgeCellSize = { ...cellSize, "box-sizing": "border-box" };

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
      cssRule(`.${BEM.cell}`, shadow ? edgeCellSize : cellSize),
      cssRule(`.${BEM.cellOn}`, onDecls(opts.color)),
      cssRule(`.${BEM.space}`, { width: `${SPACE}px`, flex: "0 0 auto" }),
      ...(shadow
        ? [
            cssRule(`.${BEM.shadow}`, shadowDecls),
            ...SIDES.map((side) => cssRule(`.${BEM.edge}--${side}`, edgeDecls(side, opts))),
          ]
        : []),
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
      ...(shadow
        ? [
            // The layer also matches the cell rule above; undo its size.
            cssRule(`.${block} > div > .${MIN_SHADOW}`, {
              ...shadowDecls,
              width: "auto",
              height: "auto",
            }),
            cssRule(`.${block} .${MIN_SHADOW} > div`, edgeCellSize),
            ...SIDES.map((side) =>
              cssRule(`.${block} .${MIN_SHADOW} > .${SIDE_CLASS[side]}`, edgeDecls(side, opts)),
            ),
          ]
        : []),
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
    if (shadow && rows.some((row) => row.includes("#"))) {
      letter.appendChild(makeShadow(rows, opts));
    }
    return letter;
  }

  // Outline of the glyph: each lit cell keeps only the sides facing an unlit
  // cell, so neighbours join into one continuous line.
  function makeShadow(rows: string[], opts: RenderOptions): HTMLElement {
    const layer = document.createElement("div");
    if (opts.mode !== "css") {
      layer.style.cssText = inlineStyle(shadowDecls).replaceAll(", ", ",");
    } else {
      layer.className = opts.style === "minimal" ? MIN_SHADOW : BEM.shadow;
    }
    forEachCell(rows, (r, c) => {
      const sides = rows[r][c] === "#" ? outlineSides(rows, r, c) : EMPTY_SIDES;
      const active = SIDES.filter((side) => sides[side]);
      const edge = document.createElement("div");
      if (opts.mode !== "css") {
        edge.style.cssText = inlineStyle({
          ...(active.length > 0 ? edgeCellSize : cellSize),
          ...Object.assign({}, ...active.map((side) => edgeDecls(side, opts))),
        });
      } else if (opts.style === "minimal") {
        if (active.length > 0) edge.className = active.map((s) => SIDE_CLASS[s]).join(" ");
      } else {
        edge.className = [BEM.cell, ...active.map((side) => `${BEM.edge}--${side}`)].join(" ");
      }
      layer.appendChild(edge);
    });
    return layer;
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
