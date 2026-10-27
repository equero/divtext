import { clamp } from "@/clamp";
import { emit, on, type WindowEventMap } from "@/events";
import { loadSavedDesigns, takeSharedState, type UrlState } from "@/url-state";
import type { BaseWindow } from "@/components/base-window";
import type { TerminalWindow } from "@/components/terminal-window";
import type { CodeWindow } from "@/components/code-window";

const WINDOW_WIDTH = 720;
const CODE_WIDTH = 560;
// Code windows open with a fixed height so their code blocks can flex to fill it.
const CODE_HEIGHT = 420;
const CASCADE = 28;

/**
 * Root window manager. Assumes a single instance per document: taskbar
 * events (spawn/restore/changed) travel over `document` to reach the taskbar,
 * which lives in a sibling subtree, so a second desktop would share that bus.
 */
export class WindowDesktop extends HTMLElement {
  private idSeq = 0;
  private zSeq = 10;
  private spawnCount = 0;
  private cleanups: Array<() => void> = [];

  connectedCallback(): void {
    // Window-scoped events bubble up from child windows; taskbar events cross
    // subtrees and so use `document`.
    this.cleanups.push(
      on(this, "wm:focus", (e) => this.raise(e.target as BaseWindow)),
      on(this, "wm:minimize", () => this.notifyChanged()),
      on(this, "wm:close", (e) => this.close(e.target as BaseWindow)),
      on(this, "wm:code", (e) => this.spawnCode(e.detail)),
      on(document, "wm:spawn", () => this.spawn()),
      on(document, "wm:restore", (e) => this.restore(e.detail.id)),
    );

    // Reopen every saved design in its own window; a shared link comes on
    // top as an extra one, leaving the saved designs untouched.
    const saved = loadSavedDesigns();
    const shared = takeSharedState();
    for (const { id, state } of saved) this.spawn(state, id);
    if (shared) this.spawn(shared);
    if (saved.length === 0 && !shared) this.spawn();
  }

  disconnectedCallback(): void {
    for (const off of this.cleanups) off();
    this.cleanups = [];
  }

  private spawn(seed: UrlState | null = null, designId?: string): void {
    const win = document.createElement("terminal-window") as TerminalWindow;
    win.windowId = ++this.idSeq;
    win.seed = seed;
    if (designId) win.designId = designId;

    this.placeCascaded(win, WINDOW_WIDTH);
    win.focusPrompt();
  }

  private spawnCode(source: WindowEventMap["wm:code"]): void {
    const win = document.createElement("code-window") as CodeWindow;
    win.windowId = ++this.idSeq;
    win.word = source.word;
    win.fontId = source.fontId;
    win.color = source.color;
    win.decor = source.decor;

    this.placeCascaded(win, CODE_WIDTH, CODE_HEIGHT);
  }

  /**
   * Append a window and lay it out centred, nudged by a cascading offset so
   * successive windows do not stack exactly on top of each other.
   */
  private placeCascaded(win: BaseWindow, preferredWidth: number, preferredHeight?: number): void {
    const width = Math.min(preferredWidth, this.clientWidth - 32);
    const baseLeft = Math.max(20, (this.clientWidth - width) / 2);
    const offset = (this.spawnCount++ % 8) * CASCADE;
    const top = clamp(56 + offset, 8, Math.max(8, this.clientHeight - 120));
    const height =
      preferredHeight === undefined
        ? undefined
        : Math.min(preferredHeight, Math.max(160, this.clientHeight - top - 16));

    this.appendChild(win);
    win.place(
      clamp(baseLeft + offset, 8, Math.max(8, this.clientWidth - width - 8)),
      top,
      width,
      height,
    );
    this.raise(win);
  }

  private raise(win: BaseWindow): void {
    win.raise(++this.zSeq);
  }

  private close(win: BaseWindow): void {
    win.remove();
    this.notifyChanged();
  }

  private restore(id: number): void {
    const win = this.windows().find((w) => w.windowId === id);
    if (!win) return;
    win.show();
    this.raise(win);
    this.notifyChanged();
  }

  private windows(): BaseWindow[] {
    return [...this.querySelectorAll<BaseWindow>("terminal-window, code-window")];
  }

  private notifyChanged(): void {
    const minimized = this.windows()
      .filter((w) => w.isMinimized)
      .map((w) => ({ id: w.windowId, title: w.taskbarTitle }));
    emit(document, "wm:changed", minimized);
  }
}

if (!customElements.get("window-desktop")) {
  customElements.define("window-desktop", WindowDesktop);
}
