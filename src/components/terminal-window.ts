import {
  DEFAULT_COLOR,
  DEFAULT_DECOR,
  DEFAULT_FONT,
  FONTS,
  LINE_STYLES,
  SIDES,
  MAX_SIZE,
  MIN_SIZE,
  SIZE_PRESETS,
  VIEWS,
  getFont,
  renderWord,
  type Decor,
  type Font,
  type LineStyle,
  type Side,
  type WordStyle,
} from "@/fonts";
import { emit } from "@/events";
import { oneLine } from "@/one-line";
import { decorOf, writeState, type UrlState } from "@/url-state";
import { BaseWindow } from "@/components/base-window";
import { terminalBodyTemplate } from "@/components/terminal-window.template";

export class TerminalWindow extends BaseWindow {
  windowTitle = "user@divtext: ~";

  /** Optional seed from the URL, applied on first render. */
  seed: UrlState | null = null;

  private input!: HTMLTextAreaElement;
  private output!: HTMLElement;
  private tools!: HTMLElement;
  private colorInput!: HTMLInputElement;
  private lineStyleInput!: HTMLSelectElement;
  private sizeInput!: HTMLInputElement;
  /** Absent while a single font is registered (the picker stays hidden). */
  private fontInput?: HTMLSelectElement;
  private currentWord = "";
  private font: Font = DEFAULT_FONT;
  private color = DEFAULT_COLOR;
  private decor: Decor = { ...DEFAULT_DECOR };

  protected renderBody(host: HTMLElement): void {
    host.innerHTML = terminalBodyTemplate();

    this.input = host.querySelector('[data-role="input"]') as HTMLTextAreaElement;
    this.output = host.querySelector('[data-role="output"]') as HTMLElement;
    this.tools = host.querySelector('[data-role="tools"]') as HTMLElement;

    this.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      // Never steal focus from another control: a select would close its
      // dropdown the moment the prompt took focus.
      if (target.closest("button, a, label, input, select, textarea")) return;
      if (window.getSelection()?.toString()) return;
      this.input.focus();
    });

    // Enter draws; Shift+Enter falls through and adds a line.
    this.input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      const text = this.input.value.trim();
      if (!text) return;
      this.render(text);
      this.input.value = "";
      this.fitInput();
    });
    this.input.addEventListener("input", () => this.fitInput());

    this.onAction("view-code", () => {
      if (this.currentWord) {
        emit(this, "wm:code", {
          word: this.currentWord,
          fontId: this.font.id,
          color: this.color,
          decor: { ...this.decor },
        });
      }
    });

    this.colorInput = host.querySelector('[data-role="color"]') as HTMLInputElement;
    this.colorInput.addEventListener("input", () => {
      this.color = this.colorInput.value;
      this.redraw();
    });

    this.buildFontPicker(host.querySelector('[data-role="fonts"]') as HTMLElement);
    this.buildDecorControls(host);

    if (this.seed) this.applySeed(this.seed);
  }

  private applySeed(seed: UrlState): void {
    this.font = getFont(seed.fontId);
    this.color = seed.color;
    this.colorInput.value = seed.color;
    this.decor = decorOf(seed);
    this.lineStyleInput.value = this.decor.lineStyle;
    this.showSize();
    if (this.fontInput) this.fontInput.value = this.font.id;
    this.highlightDecor();
    this.render(seed.word);
  }

  private get wordStyle(): WordStyle {
    return { font: this.font, color: this.color, decor: this.decor };
  }

  private syncUrl(): void {
    if (!this.currentWord) return;
    writeState({
      word: this.currentWord,
      fontId: this.font.id,
      color: this.color,
      ...this.decor,
    });
  }

  /** Repaint the current word after a style change (no-op before one exists). */
  private redraw(animate = false): void {
    if (!this.currentWord) return;
    this.output.replaceChildren(renderWord(this.currentWord, this.wordStyle));
    if (animate) this.animateCells();
    this.syncUrl();
  }

  private buildDecorControls(host: HTMLElement): void {
    // One border toggle per side: any combination, up to a full box.
    const sideRow = host.querySelector('[data-role="decor"]') as HTMLElement;
    for (const side of SIDES) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.decor = side;
      button.title = `Border ${side}`;
      button.textContent = side[0].toUpperCase() + side.slice(1);
      button.className =
        "px-3 py-1 cursor-pointer border-white/10 [&:not(:first-child)]:border-l";
      button.addEventListener("click", () => {
        this.decor = { ...this.decor, [side]: !this.decor[side] };
        this.highlightDecor();
        this.redraw();
      });
      sideRow.appendChild(button);
    }

    this.lineStyleInput = host.querySelector('[data-role="line-style"]') as HTMLSelectElement;
    for (const style of LINE_STYLES) {
      const option = document.createElement("option");
      option.value = style;
      option.textContent = style;
      this.lineStyleInput.appendChild(option);
    }
    this.lineStyleInput.value = this.decor.lineStyle;
    this.lineStyleInput.addEventListener("change", () => {
      this.decor = { ...this.decor, lineStyle: this.lineStyleInput.value as LineStyle };
      this.redraw();
    });

    // Any px value; the presets are only suggestions in the field's list.
    this.sizeInput = host.querySelector('[data-role="size"]') as HTMLInputElement;
    this.sizeInput.min = String(MIN_SIZE);
    this.sizeInput.max = String(MAX_SIZE);
    this.showSize();
    this.sizeInput.addEventListener("change", () => {
      const px = Math.round(this.sizeInput.valueAsNumber);
      // Empty or the font's own height means "natural size" (no zoom exported).
      const size =
        Number.isNaN(px) || px === this.font.height ? 0 : Math.min(MAX_SIZE, Math.max(MIN_SIZE, px));
      this.decor = { ...this.decor, size };
      this.showSize();
      this.redraw();
    });

    const viewInput = host.querySelector('[data-role="view"]') as HTMLSelectElement;
    for (const view of VIEWS) {
      const option = document.createElement("option");
      option.value = view;
      option.textContent = `${view}%`;
      viewInput.appendChild(option);
    }
    viewInput.value = "100";
    viewInput.addEventListener("change", () => {
      // On the output box, not the word: the export never sees it.
      this.output.style.zoom = String(Number(viewInput.value) / 100);
    });

    this.highlightDecor();
  }

  private highlightDecor(): void {
    for (const button of this.querySelectorAll<HTMLElement>("[data-decor]")) {
      const active = this.decor[button.dataset.decor as Side];
      button.classList.toggle("bg-primary", active);
      button.classList.toggle("text-black", active);
      button.classList.toggle("text-muted", !active);
    }
  }

  // A dropdown, not a button row: the registry is meant to keep growing.
  private buildFontPicker(host: HTMLElement): void {
    if (FONTS.length < 2) {
      host.classList.add("hidden"); // no point showing a one-option picker
      return;
    }
    const select = host.querySelector('[data-role="font"]') as HTMLSelectElement;
    for (const font of FONTS) {
      const option = document.createElement("option");
      option.value = font.id;
      option.textContent = font.label;
      select.appendChild(option);
    }
    select.value = this.font.id;
    select.addEventListener("change", () => this.setFont(getFont(select.value)));
    this.fontInput = select;
  }

  // The size field reads as a font size: the letter height in px. Presets
  // follow the current font, since each one has its own natural height.
  private showSize(): void {
    this.sizeInput.value = String(this.decor.size || this.font.height);
    const presets = this.querySelector('[data-role="size-presets"]') as HTMLDataListElement;
    presets.replaceChildren(
      ...SIZE_PRESETS.map((factor) => {
        const option = document.createElement("option");
        option.value = String(Math.round(this.font.height * factor));
        return option;
      }),
    );
  }

  private setFont(font: Font): void {
    if (this.font === font) return;
    this.font = font;
    this.showSize();
    this.redraw(true);
  }

  // Grow the prompt with its lines instead of scrolling inside it.
  private fitInput(): void {
    this.input.style.height = "auto";
    this.input.style.height = `${this.input.scrollHeight}px`;
  }

  override focusPrompt(): void {
    this.input.focus();
  }

  // Short label for the taskbar — the typed word, without the shell prefix.
  override get taskbarTitle(): string {
    return oneLine(this.currentWord) || "~";
  }

  private render(text: string): void {
    this.currentWord = text;
    this.setTitle(`user@divtext: ~/${oneLine(text)}`);
    this.collapseIntro();
    this.tools.classList.remove("hidden");
    this.redraw(true);
  }

  // Stagger a "draw" animation across every cell so the word builds up.
  private animateCells(): void {
    let i = 0;
    for (const cell of this.output.querySelectorAll<HTMLElement>("div div")) {
      if (cell.childElementCount > 0) continue; // only leaf cells
      cell.style.animationDelay = `${i++ * 6}ms`;
      cell.classList.add("divtext-draw");
    }
  }

  // Smoothly collapse the intro block the first time a word is rendered.
  private collapseIntro(): void {
    const intro = this.querySelector<HTMLElement>('[data-role="intro"]');
    if (!intro || intro.classList.contains("hidden")) return;
    intro.style.overflow = "hidden";
    intro.style.maxHeight = `${intro.scrollHeight}px`;
    requestAnimationFrame(() => {
      intro.style.transition = "max-height 300ms ease, opacity 300ms ease, margin 300ms ease";
      intro.style.maxHeight = "0";
      intro.style.opacity = "0";
      intro.style.marginBottom = "0";
    });
    intro.addEventListener("transitionend", () => intro.classList.add("hidden"), {
      once: true,
    });
  }
}

if (!customElements.get("terminal-window")) {
  customElements.define("terminal-window", TerminalWindow);
}
