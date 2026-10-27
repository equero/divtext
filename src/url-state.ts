import { DEFAULT_COLOR, DEFAULT_DECOR, LINE_STYLES, MAX_SIZE, MIN_SIZE, getFont } from "@/fonts";
import type { Decor, LineStyle } from "@/fonts";

/**
 * Snapshot of a rendered word, encoded as query parameters
 * (?w=word&f=fontId&c=rrggbb&bt=1&br=1&bb=1&bl=1&ls=dashed&ss=solid&s=25).
 *
 * The same encoding serves two places: localStorage, which keeps one design
 * per terminal window across reloads, and share links, which open as an
 * extra window without touching the saved ones. The address bar itself is
 * never updated while editing, so it stays clean.
 *
 * Every field is driven by one entry in SCHEMA below: to add a complement
 * (border, border style, background…) add the field here plus its spec there —
 * nothing else in the app touches the encoding.
 */
export interface UrlState extends Decor {
  word: string;
  fontId: string;
  color: string;
}

/** How one field maps to and from a query parameter. */
interface ParamSpec<T> {
  /** Query-string key. Keep it short and stable — URLs are shared. */
  key: string;
  /** Used when the parameter is missing, malformed or out of range. */
  fallback: T;
  /** Parse an untrusted raw value; return null to fall back to the default. */
  parse(raw: string): T | null;
  /** Render a value as a parameter. */
  serialize(value: T): string;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Free text, kept as typed (URLSearchParams handles the encoding). */
function text(key: string, fallback = ""): ParamSpec<string> {
  return { key, fallback, parse: (raw) => raw || null, serialize: (value) => value };
}

/** A #rrggbb color, accepted with or without the leading hash. */
function color(key: string, fallback: string): ParamSpec<string> {
  return {
    key,
    fallback,
    parse: (raw) => {
      const hex = raw.startsWith("#") ? raw : `#${raw}`;
      return HEX.test(hex) ? hex.toLowerCase() : null;
    },
    // The hash is dropped: it would have to be percent-encoded otherwise.
    serialize: (value) => value.replace(/^#/, ""),
  };
}

/** A boolean flag: `1`/`0` out, and a few friendly spellings in. */
function flag(key: string, fallback: boolean): ParamSpec<boolean> {
  const TRUE = ["1", "true", "yes", "on"];
  const FALSE = ["0", "false", "no", "off"];
  return {
    key,
    fallback,
    parse: (raw) => {
      const value = raw.toLowerCase();
      if (TRUE.includes(value)) return true;
      if (FALSE.includes(value)) return false;
      return null;
    },
    serialize: (value) => (value ? "1" : "0"),
  };
}

/** One of a fixed set of string values. */
function choice<T extends string>(
  key: string,
  values: readonly T[],
  fallback: T,
): ParamSpec<T> {
  return {
    key,
    fallback,
    parse: (raw) => values.find((value) => value === raw.toLowerCase()) ?? null,
    serialize: (value) => value,
  };
}

/** A whole number within a range; anything else falls back. */
function integer(key: string, min: number, max: number, fallback: number): ParamSpec<number> {
  return {
    key,
    fallback,
    parse: (raw) => {
      const value = Number(raw);
      return Number.isInteger(value) && value >= min && value <= max ? value : null;
    },
    serialize: (value) => String(value),
  };
}

/** A registered font id; unknown ids fall back to the default font. */
function fontId(key: string): ParamSpec<string> {
  return {
    key,
    fallback: getFont("").id,
    parse: (raw) => getFont(raw).id, // getFont clamps to a known id
    serialize: (value) => value,
  };
}

type Schema = { [K in keyof UrlState]: ParamSpec<UrlState[K]> };

const SCHEMA: Schema = {
  word: text("w"),
  fontId: fontId("f"),
  color: color("c", DEFAULT_COLOR),
  top: flag("bt", DEFAULT_DECOR.top),
  right: flag("br", DEFAULT_DECOR.right),
  bottom: flag("bb", DEFAULT_DECOR.bottom),
  left: flag("bl", DEFAULT_DECOR.left),
  lineStyle: choice<LineStyle>("ls", LINE_STYLES, DEFAULT_DECOR.lineStyle),
  shadowStyle: choice<LineStyle>("ss", LINE_STYLES, DEFAULT_DECOR.shadowStyle),
  size: integer("s", MIN_SIZE, MAX_SIZE, DEFAULT_DECOR.size),
};

const FIELDS = Object.keys(SCHEMA) as Array<keyof UrlState>;

function spec(field: keyof UrlState): ParamSpec<unknown> {
  return SCHEMA[field] as ParamSpec<unknown>;
}

const STORAGE_KEY = "divtext:designs";

/** One saved design: the window slot it belongs to and its encoded state. */
interface SavedDesign {
  id: string;
  params: string;
}

/** Parse parameters into a state, or null when no word is present. */
function fromParams(params: URLSearchParams): UrlState | null {
  const state = {} as Record<keyof UrlState, unknown>;
  for (const field of FIELDS) {
    const { key, fallback, parse } = spec(field);
    const raw = params.get(key)?.trim();
    state[field] = raw ? (parse(raw) ?? fallback) : fallback;
  }
  const result = state as UrlState;
  return result.word ? result : null;
}

/**
 * Encode a state. Share links drop default values to stay short; storage
 * keeps every field, so a saved design never shifts when a default changes.
 */
function toParams(state: UrlState, keepDefaults: boolean): URLSearchParams {
  const params = new URLSearchParams();
  for (const field of FIELDS) {
    const { key, fallback, serialize } = spec(field);
    const value = state[field];
    if (!keepDefaults && field !== "word" && value === fallback) continue;
    params.set(key, serialize(value));
  }
  return params;
}

// Storage can be blocked (private mode, disabled site data) or hold junk:
// reads fall back to nothing, writes are skipped.
function readSaved(): SavedDesign[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(list)
      ? list.filter(
          (item): item is SavedDesign =>
            typeof item?.id === "string" && typeof item?.params === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function writeSaved(list: SavedDesign[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: designs just won't survive a reload.
  }
}

/** A fresh slot id for a new terminal window. */
export function newDesignId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Designs saved in this browser, one per window, in the order they were made. */
export function loadSavedDesigns(): Array<{ id: string; state: UrlState }> {
  return readSaved().flatMap(({ id, params }) => {
    const state = fromParams(new URLSearchParams(params));
    return state ? [{ id, state }] : [];
  });
}

/**
 * The design in a shared link, if the page was opened from one. The address
 * bar goes back to clean, so a reload doesn't open it a second time.
 */
export function takeSharedState(): UrlState | null {
  const shared = fromParams(new URLSearchParams(location.search));
  if (location.search) history.replaceState(null, "", location.pathname);
  return shared;
}

/** Save a window's design in its own slot (added on first save). */
export function saveDesign(id: string, state: UrlState): void {
  const params = toParams(state, true).toString();
  const list = readSaved();
  const slot = list.find((item) => item.id === id);
  if (slot) slot.params = params;
  else list.push({ id, params });
  writeSaved(list);
}

/** Drop a window's design, when the window is closed. */
export function forgetDesign(id: string): void {
  writeSaved(readSaved().filter((item) => item.id !== id));
}

/** A link that opens this exact design for anyone. */
export function shareUrl(state: UrlState): string {
  return `${location.origin}${location.pathname}?${toParams(state, false)}`;
}

/** The decoration slice of a state, ready to hand to a renderer. */
export function decorOf(state: UrlState): Decor {
  return {
    top: state.top,
    right: state.right,
    bottom: state.bottom,
    left: state.left,
    lineStyle: state.lineStyle,
    shadowStyle: state.shadowStyle,
    size: state.size,
  };
}
