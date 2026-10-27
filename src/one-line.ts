/** Titles are single-line: show a word's line breaks as spaces. */
export function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, " ");
}
