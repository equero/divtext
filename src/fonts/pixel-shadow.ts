import { createGridFont } from "@/fonts/grid-font";
import { SHADOW_GLYPHS } from "@/fonts/shadow-glyphs";

/**
 * ANSI Shadow look: thick block letters with an outline cast half a cell
 * down-right. Cells are taller than wide, like the text characters the
 * figlet font is drawn with. The outline follows the line style ("double"
 * is the classic look).
 */
export const pixelShadowFont = createGridFont({
  id: "pixel-shadow",
  label: "Pixel Shadow",
  block: "divtext-pixel-shadow",
  glyphs: SHADOW_GLYPHS,
  cellWidth: 6,
  cellHeight: 10,
  gap: 0,
  letterGap: 9,
  radius: 0,
  shadow: true,
});
