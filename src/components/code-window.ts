import {
  DEFAULT_COLOR,
  DEFAULT_DECOR,
  exportParts,
  getFont,
  type CodePart,
  type CssStyle,
  type Decor,
  type ExportMode,
} from "@/fonts";
import { BaseWindow } from "@/components/base-window";
import { oneLine } from "@/one-line";

// Separate window that shows the exported code for a snapshot of a word.
export class CodeWindow extends BaseWindow {
  word = "";
  fontId = "";
  color = DEFAULT_COLOR;
  decor: Decor = { ...DEFAULT_DECOR };

  private mode: ExportMode = "html";
  private cssStyle: CssStyle = "bem";
  private styleRow!: HTMLElement;
  private codeBox!: HTMLElement;
  private codeSeq = 0;

  protected renderBody(host: HTMLElement): void {
    this.setTitle(`code — ${oneLine(this.word)}`);
    host.innerHTML = `
      <div class="px-5 py-4 flex flex-col gap-3 h-full min-h-0">
        <div data-role="mode" class="flex w-max rounded-md overflow-hidden border border-white/10 text-[13px]">
          <button data-mode="html" type="button" class="px-3 py-1 cursor-pointer">HTML Only</button>
          <button data-mode="css" type="button" class="px-3 py-1 cursor-pointer border-l border-white/10">HTML + CSS</button>
        </div>
        <div data-role="style" class="hidden flex w-max rounded-md overflow-hidden border border-white/10 text-[13px]">
          <button data-style="bem" type="button" class="px-3 py-1 cursor-pointer">BEM</button>
          <button data-style="minimal" type="button" class="px-3 py-1 cursor-pointer border-l border-white/10">Minimal</button>
        </div>
        <div data-role="code-box" class="flex flex-col gap-3 flex-1 min-h-0"></div>
      </div>
    `;

    this.styleRow = host.querySelector('[data-role="style"]') as HTMLElement;
    this.codeBox = host.querySelector('[data-role="code-box"]') as HTMLElement;
    this.onMode("html");
    this.onMode("css");
    this.onStyle("bem");
    this.onStyle("minimal");
    this.highlightMode();
    this.highlightStyle();
    this.refreshCode();
  }

  override get taskbarTitle(): string {
    return `${oneLine(this.word)} · code`;
  }

  private async refreshCode(): Promise<void> {
    const seq = ++this.codeSeq;
    this.styleRow.classList.toggle("hidden", this.mode !== "css");
    const parts = exportParts(
      this.word,
      { font: getFont(this.fontId), color: this.color, decor: this.decor },
      this.mode,
      this.cssStyle,
    );
    const slots = parts.map((part) => this.buildCodeBlock(part));
    this.codeBox.replaceChildren(...slots.map((s) => s.block));

    const { highlight } = await import("@/highlight");
    for (let i = 0; i < parts.length; i++) {
      const html = await highlight(parts[i].code, parts[i].lang);
      if (seq !== this.codeSeq) return; // a newer render superseded this one
      slots[i].slot.innerHTML = html;
    }
  }

  // Build one titled code block (label + copy button + highlight slot).
  private buildCodeBlock(part: CodePart): { block: HTMLElement; slot: HTMLElement } {
    const block = document.createElement("div");
    // Share the leftover body height between blocks; the slot does the scrolling.
    block.className = "flex flex-col min-h-0 flex-1";

    const header = document.createElement("div");
    header.className =
      "flex items-center justify-between px-1 pb-1 text-[11px] text-muted shrink-0";
    const label = document.createElement("span");
    label.textContent = part.title;
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy";
    copy.className =
      "px-2 py-0.5 rounded text-[11px] text-fg border border-white/10 hover:border-white/25 cursor-pointer";
    copy.addEventListener("click", () => this.copyCode(copy, part.code));
    header.append(label, copy);

    const slot = document.createElement("div");
    slot.className =
      "rounded-md border border-white/10 overflow-auto scroll-slim flex-1 min-h-[120px] font-mono text-[12px] leading-[1.5] [&_pre]:m-0 [&_pre]:p-3";

    block.append(header, slot);
    return { block, slot };
  }

  private async copyCode(button: HTMLElement, code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      const original = button.textContent;
      button.textContent = "Copied!";
      setTimeout(() => (button.textContent = original), 1200);
    } catch {
      // Clipboard blocked (e.g. insecure context) — nothing else to do.
    }
  }

  private setMode(mode: ExportMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.highlightMode();
    this.refreshCode();
  }

  private highlightMode(): void {
    for (const button of this.querySelectorAll<HTMLElement>("[data-mode]")) {
      const active = button.dataset.mode === this.mode;
      button.classList.toggle("bg-primary", active);
      button.classList.toggle("text-black", active);
      button.classList.toggle("text-muted", !active);
    }
  }

  private onMode(mode: ExportMode): void {
    const el = this.querySelector(`[data-mode="${mode}"]`) as HTMLElement;
    el.addEventListener("click", () => this.setMode(mode));
  }

  private setStyle(style: CssStyle): void {
    if (this.cssStyle === style) return;
    this.cssStyle = style;
    this.highlightStyle();
    this.refreshCode();
  }

  private highlightStyle(): void {
    for (const button of this.querySelectorAll<HTMLElement>("[data-style]")) {
      const active = button.dataset.style === this.cssStyle;
      button.classList.toggle("bg-primary", active);
      button.classList.toggle("text-black", active);
      button.classList.toggle("text-muted", !active);
    }
  }

  private onStyle(style: CssStyle): void {
    const el = this.querySelector(`[data-style="${style}"]`) as HTMLElement;
    el.addEventListener("click", () => this.setStyle(style));
  }
}

if (!customElements.get("code-window")) {
  customElements.define("code-window", CodeWindow);
}
