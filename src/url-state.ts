import { DEFAULT_COLOR, DEFAULT_DECOR, LINE_STYLES, MAX_SIZE, MIN_SIZE, getFont } from "@/fonts";
import type { Decor, LineStyle } from "@/fonts";

/**
 * Shareable snapshot of a rendered word, mirrored in the query string so a
 * URL round-trips the terminal state
 * (?w=word&f=fontId&c=rrggbb&bt=1&br=1&bb=1&bl=1&ls=dashed&ss=solid&s=25).
 *
 * Every field is driven by one entry in SCHEMA below: to add a complement
 * (border, border style, background…) add the field here plus its spec there —
 * nothing else in the app touches the query string.
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
  /** Render a value for the query string. */
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

/** Read the current URL into a state, or null when no word is present. */
export function readState(): UrlState | null {
  const params = new URLSearchParams(location.search);
  const state = {} as Record<keyof UrlState, unknown>;
  for (const field of FIELDS) {
    const { key, fallback, parse } = spec(field);
    const raw = params.get(key)?.trim();
    state[field] = raw ? (parse(raw) ?? fallback) : fallback;
  }
  const result = state as UrlState;
  return result.word ? result : null;
}

/** Mirror a state into the query string without adding history entries. */
export function writeState(state: UrlState): void {
  const params = new URLSearchParams();
  for (const field of FIELDS) {
    const { key, fallback, serialize } = spec(field);
    const value = state[field];
    // Defaults stay implicit so shared URLs carry only what was customised.
    if (field !== "word" && value === fallback) continue;
    params.set(key, serialize(value));
  }
  history.replaceState(null, "", `${location.pathname}?${params}`);
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
