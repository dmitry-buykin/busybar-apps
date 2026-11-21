import { Painter, runApp, txt, rect, bitmap, anim, xpm, rand, shade, deferSound, stopSound, terminal, textWidth, readSettings, load, save, type Element, type Font, type AppHandle } from "@shared/painter";
import manifest from "./appmeta/manifest.json";

const APP = manifest.id;
const ANIM_MS = 80;
const IDLE_MS = 1000;
const TICK_GAP_MS = 150;
const BOUNCE_MS = 520;
const OVERSHOOT_PX = 7;

const FLASH_TICKS = 2;
const GLITCH_TICKS = 4;
const RACE_FILE = "race.anim";
const RACE_STEPS = 18;
const RACE_MS = 1600;
const RACE_Z = 8;
const RACE_LEAD_MS = 180;
const GUARD_MS = 1000;
const HISTORY = 5;
const STORE = "wheel";
const GREY = "#A0A0A0FF";

const DEFAULTS = { sound: true, ticks: true, light_cues: true };
let settings = DEFAULTS;

interface Deck {
  name: string;
  label: string;
  color: string;
  options: string[];
  weights?: number[];
  fast?: boolean;
  colors?: string[];
  say?: string;
  dice?: boolean;
}

const PALETTE = ["#FF5A5A", "#FFB347", "#FFE066", "#7CFF7C", "#5AD8FF", "#7C9CFF", "#C88CFF", "#FF7CD8"];

const DECKS: Deck[] = [
  { name: "decide", label: "DECIDE", color: "#E8C060", options: ["YES", "NO", "NOT YET", "SLEEP ON IT", "TRY SMALL", "ASK", "SHIP IT"], weights: [2, 2, 1, 1, 1, 1, 1],
    colors: ["#4CFF6A", "#FF4040", "#FFB020", "#9A7CFF", "#5AD8FF", "#5A8CFF", "#FF8A1F"] },
  { name: "yes/no", label: "YES / NO", color: "#7CFF7C", options: ["YES", "NO"], fast: true, colors: ["#4CFF6A", "#FF4040"] },
  { name: "coin", label: "COIN", color: "#FFD21F", options: ["HEADS", "TAILS"], fast: true, colors: ["#FFD21F", "#C8D0E0"] },
  { name: "d6", label: "DICE", color: "#F2F6FF", options: ["1", "2", "3", "4", "5", "6"], dice: true },
  { name: "who pays", label: "WHO PAYS", color: "#FF8A1F", options: ["A", "B", "C"], fast: true, colors: ["#FF5A5A", "#5AD8FF", "#FFE066"], say: "% PAYS" },
  { name: "move", label: "MOVE", color: "#FF6A5A", options: ["GYM", "WALK", "STRETCH", "PUSH-UPS", "STAIRS", "BREATHE"] },
  { name: "break", label: "BREAK", color: "#5AB4FF", options: ["V60", "WATER", "TEA", "FRESH AIR", "SNACK", "NOTHING"] },
  { name: "focus", label: "FOCUS", color: "#7CFFC8", options: ["DEEP WORK", "INBOX", "REVIEW", "WRITE", "PROTOTYPE", "PLAN"] },

  { name: "drinks", label: "COFFEE", color: "#C8823C", options: ["V60", "FILTER", "CAPPUCCINO", "ESPRESSO", "FLAT WHITE", "LATTE", "AMERICANO"] },
  { name: "lunch", label: "LUNCH", color: "#FFC857", options: ["SALAD", "SOUP", "SUSHI", "BOWL", "EGGS", "BLINI"] },
];

type Phase = "ready" | "spin" | "bounce" | "result";

interface Saved {
  deck: number;
  hist: Record<string, number[]>;
  tally: Record<string, number[]>;
}

const painter = new Painter(APP, { hold: true, onAccepted: acceptedEffect, onInvalidated: invalidatedEffect });
let app: AppHandle | null = null;
let state: Saved = { deck: 0, hist: {}, tally: {} };

let deck = 0;
let phase: Phase = "ready";
let pos = 0;
let vel = 0;
let from = 0;
let dist = 0;
let target = 0;
let t0 = 0;
let dur = 0;
let result = -1;
let landAt = 0;
let celebrate = -1;
let effectSerial = 0;
let effectAccepted = -1;
let effectAt = 0;
let landSeen = true;
let raceSec = "";
let raceK = 0;
let raceAt = 0;
const effectId = () => `effect${effectSerial}`;
const effectColor = () => `#000000${("0" + (celebrate + 1).toString(16)).slice(-2)}`;
function acceptedEffect(elements: Element[], at: number): void {

  if (!lampSeen || (raceSec && !raceAt)) {
    for (let i = 0; i < elements.length; i++) {
      const e = elements[i] as {id: string; data?: string; section?: string};
      if (e.id === "ft" && e.data === lampTop) lampSeen = true;
      if (e.id === "fx" && raceSec && !raceAt && e.section === raceSec) { syncClock(at); raceAt = at; }
    }
  }
  if (phase !== "result" || celebrate < 0 || effectAccepted === celebrate || !elements.some(e => e.id === effectId() && (e as {fill_colors?: string[]}).fill_colors?.[0] === effectColor())) return;
  syncClock(at);
  effectAccepted = celebrate;
  effectAt = at;
  if (!landSeen) { landSeen = true; landAt = at; cue("ding"); }
}
function invalidatedEffect(): void { effectAccepted = -1; raceAt = 0; }
function guarded(): boolean { return phase === "result" && (!landSeen || Date.now() - landAt < GUARD_MS); }

let lampPh = 0;
let travel = 0;
let lampTop = "";
let lampSeen = true;
let lastSlot = 0;
let lastTickAt = 0;
let flapUntil = 0;
let tickTake = false;
let stamp = 0;
let saveAt = 0;
let clockAt = Date.now();

const d = () => DECKS[deck];
const n = () => d().options.length;
const wrapIdx = (i: number) => ((i % n()) + n()) % n();

const hue = (i: number) => {
  const k = wrapIdx(i);
  const c = d().colors;
  return c && c[k] ? c[k] : PALETTE[k % PALETTE.length];
};
const easeOutCubic = (u: number) => 1 - (1 - u) * (1 - u) * (1 - u);

let clickAt = 0;

function click(): void {
  if (!settings.sound) return;
  const now = Date.now();
  if (now - clickAt < 200) return;
  clickAt = now;
  deferSound(APP, "click");
}

function cue(name: string): void {
  if (settings.sound) deferSound(APP, name);
}

let spacing = 20;
let labelColors: string[][] = [];
let labelHalf: number[] = [];
let built = -1;
function buildDeck(): void {
  if (built === deck) return;
  built = deck;
  let widest = 1;
  for (const o of d().options) widest = Math.max(widest, textWidth(o) - 1);
  spacing = Math.max(20, widest + 14);
  labelHalf = d().options.map((o) => (textWidth(o) >> 1) + 1);
  labelColors = d().options.map((_, k) => [1, 0.62, 0.38, 0.22].map((f) => shade(hue(k), f) + "FF"));
}

function totalWeight(): number {
  const w = d().weights;
  if (!w) return n();
  let total = 0;
  for (const x of w) total += x;
  return total;
}

function pickIndex(): number {
  const w = d().weights;
  if (!w) return rand(0, n() - 1);
  let r = Math.random() * totalWeight();
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r < 0) return i;
  }
  return w.length - 1;
}

function spin(): void {
  if (phase !== "ready" && phase !== "result") return;
  if (guarded()) return;
  buildDeck();
  const fast = !!d().fast;
  const base = rand(14, 20);
  const minDist = fast ? Math.round(base * 0.6) : base;
  const cur = Math.round(pos);
  const want = pickIndex();

  dist = minDist + ((((want - wrapIdx(cur) - minDist) % n()) + n()) % n());
  from = cur;
  pos = cur;
  target = cur + dist;
  dur = rand(2300, 3000) * (fast ? 0.65 : 1);
  t0 = Date.now();
  phase = "spin";
  result = -1;
  endRace();
  vel = 0;
  travel = 0;
  lastSlot = cur;
}

function racePhase(now: number): number {
  const f = raceAt ? ((now - raceAt + RACE_LEAD_MS) / ANIM_MS) | 0 : 0;
  return raceK + (f < 2 ? 0 : f - 1 > RACE_STEPS ? RACE_STEPS : f - 1);
}

function stopRace(now: number): void {
  if (!raceSec) return;
  lampPh = racePhase(now);
  raceSec = "";
}

function endRace(): void {
  stopRace(Date.now());
  celebrate = -1;
  effectAccepted = -1;
}

function ready(): void {
  phase = "ready";
  result = -1;
  endRace();
  pos = 0;
  vel = 0;
  lastSlot = 0;
}

function cleanList(v: unknown, size: number, maxLen: number, isCount: boolean): number[] {
  const out: number[] = [];
  if (isCount) {

    for (let i = 0; i < size; i++) {
      const x: unknown = Array.isArray(v) ? v[i] : 0;
      out.push(typeof x === "number" && x >= 0 && x < 1e9 && x === Math.floor(x) ? x : 0);
    }
  } else if (Array.isArray(v)) {
    for (let i = 0; i < v.length && out.length < maxLen; i++) {
      const x = v[i];
      if (typeof x === "number" && x >= 0 && x < size && x === Math.floor(x)) out.push(x);
    }
  }
  return out;
}

function restore(): void {
  const raw = load<Saved>(STORE, { deck: 0, hist: {}, tally: {} });
  const hist: Record<string, number[]> = {};
  const tally: Record<string, number[]> = {};
  for (const dk of DECKS) {
    const size = dk.options.length;
    hist[dk.name] = cleanList(raw.hist ? raw.hist[dk.name] : null, size, HISTORY, false);
    tally[dk.name] = cleanList(raw.tally ? raw.tally[dk.name] : null, size, size, true);
  }
  deck = typeof raw.deck === "number" && raw.deck >= 0 && raw.deck < DECKS.length ? Math.floor(raw.deck) : 0;
  state = { deck, hist, tally };
}

function persist(): void {
  state.deck = deck;
  save(STORE, state);
}

function record(idx: number): void {
  if (idx < 0 || idx >= n() || idx !== Math.floor(idx)) return;
  saveAt = 0;
  const name = d().name;
  state.hist[name] = [idx].concat(state.hist[name]).slice(0, HISTORY);
  state.tally[name][idx] += 1;
  stamp += 1;
  persist();
}

function syncClock(now: number): void {
  const correction = now - clockAt;
  if (correction < 0) {
    t0 += correction;
    if (landAt) landAt += correction;
    if (effectAt) effectAt += correction;
    if (raceAt) raceAt += correction;
    if (flapUntil) flapUntil += correction;
    if (lastTickAt) lastTickAt += correction;
    if (saveAt) saveAt += correction;
  }
  clockAt = now;
}

function step(now: number): void {
  syncClock(now);
  if (phase !== "spin" && phase !== "bounce") return;
  const t = now - t0;
  const over = OVERSHOOT_PX / spacing;
  const before = pos;
  if (phase === "spin") {
    const u = Math.max(0, Math.min(1, t / dur));
    pos = from + (dist + over) * easeOutCubic(u);
    if (u >= 1) {
      phase = "bounce";
      t0 = now;
    }
  } else {
    const v = Math.max(0, Math.min(1, t / BOUNCE_MS));

    pos = target + over * Math.cos(1.5 * Math.PI * v) * (1 - v) * (1 - v);
    if (v >= 1) {
      pos = target;
      phase = "result";
      result = wrapIdx(target);
      landAt = now;
      landSeen = false;
      celebrate = 0;
      effectSerial++;
      effectAccepted = -1;
      raceK = lampPh;
      raceSec = hue(result).slice(1).toUpperCase() + (((lampPh % 3) + 3) % 3);
      raceAt = 0;
      record(result);
      if (settings.light_cues) painter.led(hue(result));
    }
  }
  vel = (pos - before) * spacing;

  if (vel > 0) travel += vel;
  if (travel >= 4 && lampSeen) {
    lampPh += 1;
    lampSeen = false;
    travel = travel - 4 > 3 ? 3 : travel - 4;
  }
  const slot = Math.round(pos);
  if (slot !== lastSlot && phase !== "result") {
    lastSlot = slot;
    flapUntil = now + ANIM_MS;
    if (settings.ticks && now - lastTickAt >= TICK_GAP_MS) {
      lastTickAt = now;
      tickTake = !tickTake;
      cue(tickTake ? "tick2" : "tick");
    }
  }
}

function moving(): boolean {
  return phase === "spin" || phase === "bounce" || (phase === "result" && celebrate >= 0);
}

function wake(): void {
  if (app) app.setTick(moving() ? ANIM_MS : IDLE_MS);
}

let lampCache: Record<string, Element[]> = {};
let lampCount = 0;
let INSIDE = "";
for (let x = 1; x <= 70; x++) INSIDE += "_";
function lamps(rgb: string, ph: number, dim: number, lit: string): Element[] {
  const k3 = ((ph % 3) + 3) % 3;
  const key = rgb + dim + lit + k3;
  const hit = lampCache[key];
  if (hit) return hit;

  const cell = (p: number) => (p % 2 ? "." : (p / 2 - k3) % 3 === 0 ? "b" : "d");
  let top = "";
  let bottom = "";
  for (let x = 0; x < 72; x++) {
    top += cell(x);
    bottom += cell(86 + 71 - x);
  }
  const rows: string[] = [top];
  for (let y = 1; y <= 14; y++) rows.push(cell(158 + 14 - y) + INSIDE + cell(71 + y));
  rows.push(bottom);
  const colors = `. c #000000\nd c ${shade(rgb, dim)}\nb c ${lit}\n_ c none`;
  const els = [bitmap("ft", 0, 0, xpm(rows, colors), 7)];
  if (lampCount >= 12) {
    lampCache = {};
    lampCount = 0;
  }
  lampCache[key] = els;
  lampCount += 1;
  return els;
}

const POINTER = ["kdxwwwxdk", "kkdxwxdkk", "kkkdxdkkk"];
let pointerFor = "";
let pointerData = "";
function pointer(rgb: string, dx: number): Element {
  if (pointerFor !== rgb) {
    const colors = `k c #000000\nd c ${shade(rgb, 0.3)}\nx c ${rgb}\nw c #FFFFFF\n_ c none`;
    const rows = POINTER.slice();
    for (let y = 3; y < 13; y++) rows.push("_________");
    rows.push(POINTER[2], POINTER[1], POINTER[0]);
    pointerData = xpm(rows, colors);
    pointerFor = rgb;
  }
  return bitmap("pt", 32 + dx, 0, pointerData, 8);
}

const PIPS: number[][] = [[4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const PIP_CELL = [-1, -1, 0, 0, -1, 1, 1, -1, 2, 2, -1, -1];
const dieCache: string[] = [];
function dieXpm(k: number): string {
  if (dieCache[k]) return dieCache[k];
  const rows: string[] = [];
  for (let y = 0; y < 12; y++) {
    let r = "";
    for (let x = 0; x < 12; x++) {
      const corner = (x === 0 || x === 11) && (y === 0 || y === 11);
      const cx = PIP_CELL[x];
      const cy = PIP_CELL[y];
      const inPip = cx >= 0 && cy >= 0 && PIPS[k].indexOf(cy * 3 + cx) >= 0;
      r += corner ? "." : inPip ? "k" : y === 0 || x === 11 ? "h" : y === 11 || x === 0 ? "d" : "x";
    }
    rows.push(r);
  }
  return (dieCache[k] = xpm(rows, ". c none\nk c #000000\nh c #FFFFFF\nx c #D4D8E2\nd c #8C94A6"));
}

function bigFont(word: string, room: number): { font: Font; y: number } {
  if (textWidth(word, "extra_large") - 1 <= room) return { font: "extra_large", y: 1 };
  if (textWidth(word, "bold") - 1 <= room) return { font: "bold", y: 2 };
  if (textWidth(word, "normal") - 1 <= room) return { font: "normal", y: 2 };
  return { font: "small", y: 3 };
}

const shown = (k: number) => {
  const s = d().say;
  return s ? s.replace("%", d().options[k]) : d().options[k];
};

const SLOTS = 7;
const FRONT_IDS = ["w", "w2", "al", "ar", "die", "split", "flash", "pt", "o0", "o1", "o2", "o3", "o4", "o5", "o6", "fx"];
const NONE = xpm(["."], ". c none");
function hidden(id: string): Element {
  if (id === "fx") return anim(id, 0, 0, RACE_FILE, { section: "off", loop: true }, RACE_Z);
  if (id === "die" || id === "pt") return bitmap(id, 0, 0, NONE, 0);
  if (id === "flash") return rect(id, 0, 0, 1, 1, "#000000FF", 0);
  return txt(id, 0, 0, " ", "small", "#000000FF", "top_left", 0);
}

function complete(els: Element[], lights: Element[]): Element[] {
  const seen: Record<string, true> = {};
  for (let i = 0; i < els.length; i++) seen[els[i].id] = true;
  for (let i = 0; i < lights.length; i++) els.push(lights[i]);
  for (let i = 0; i < FRONT_IDS.length; i++) if (!seen[FRONT_IDS[i]]) els.push(hidden(FRONT_IDS[i]));
  return els;
}

function readyScreen(): Element[] {
  const dk = d();
  const hint = "Press Start";
  return complete(
    [
      txt("w", (72 - (textWidth(dk.label) - 1)) >> 1, 0, dk.label, "small", dk.color + "FF"),
      txt("w2", (72 - (textWidth(hint) - 1)) >> 1, 7, hint, "small", GREY),
      txt("al", 3, 3, "<", "small", GREY),
      txt("ar", 66, 3, ">", "small", GREY),
    ],
    lamps(dk.color, lampPh, 0.16, shade(dk.color, 0.6)),
  );
}

function reel(now: number): Element[] {
  const dk = d();
  const sp = spacing;
  const c = Math.round(pos);
  const off = (pos - c) * sp;
  const k = (SLOTS - 1) >> 1;
  const els: Element[] = [];
  for (let i = -k; i <= k; i++) {
    const x = (36 - off + i * sp + 0.5) | 0;
    const o = wrapIdx(c + i);
    const half = labelHalf[o];
    if (x + half < 1 || x - half > 71) continue;
    const away = x > 36 ? x - 36 : 36 - x;
    els.push(txt(`o${i + k}`, x, 3, dk.options[o], "small", labelColors[o][away < 7 ? 0 : away < 18 ? 1 : away < 30 ? 2 : 3], "top_mid", 5));
  }
  els.push(pointer(dk.color, now < flapUntil ? (vel >= 0 ? -1 : 1) : 0));
  const lights = lamps(dk.color, lampPh, 0.14, shade(dk.color, 0.75));
  lampTop = (lights[0] as {data?: string}).data || "";
  return complete(els, lights);
}

function win(): Element[] {
  const rgb = hue(result);
  const word = shown(result);
  const race = celebrate >= 0;

  const lights = lamps(rgb, lampPh, 0.16, shade(rgb, 0.6));
  const die = d().dice;
  const f = bigFont(word, die ? 44 : 64);
  const ww = textWidth(word, f.font) - 1;
  const total = die ? 12 + 4 + ww : ww;
  const x = (72 - total) >> 1;
  const wx = die ? x + 16 : x;
  const els: Element[] = [];
  if (race && celebrate < FLASH_TICKS) {

    els.push(rect("flash", 1, 1, 70, 14, rgb + "FF", 2));
    els.push(txt("w", wx, f.y, word, f.font, "#000000FF"));
  } else if (race && celebrate < GLITCH_TICKS) {

    els.push(txt("w", wx + 1, f.y, word, f.font, "#FFFFFFFF"));
    els.push(txt("split", wx - 2, f.y, word, f.font, shade(rgb, 0.7) + "FF", "top_left", 4));
  } else els.push(txt("w", wx, f.y, word, f.font, rgb + "FF"));
  if (die) els.push(bitmap("die", x, 2, dieXpm(result), 4));
  if (race) els.push(rect(effectId(), 0, 0, 1, 1, effectColor(), 0));
  if (raceSec) els.push(anim("fx", 0, 0, RACE_FILE, { section: raceSec, loop: true }, RACE_Z));
  return complete(els, lights);
}

function front(): Element[] {
  if (phase === "spin" || phase === "bounce") return reel(Date.now());
  return phase === "result" ? win() : readyScreen();
}

const BODY_PX = 142;

function flow(items: string[]): string[] {
  const out: string[] = [];
  let line = "";
  for (let i = 0; i < items.length; i++) {
    const item = items[i] + (i < items.length - 1 ? "," : "");
    if (line && textWidth(line + " " + item) - 1 > BODY_PX) {
      out.push(line);
      line = item;
    } else line = line ? line + " " + item : item;
  }
  if (line) out.push(line);
  return out;
}

function oddsLine(): string {
  const dk = d();
  const w = dk.weights;
  if (!w) return "";
  const total = totalWeight();
  let low = w[0];
  for (const x of w) low = Math.min(low, x);
  const parts: string[] = [];
  let rest = 0;
  for (let i = 0; i < w.length; i++) {
    if (w[i] > low) parts.push(`${dk.options[i]} ${w[i]}/${total}`);
    else rest += 1;
  }
  if (rest) parts.push(`${parts.length ? "REST" : "EACH"} ${low}/${total}`);
  return "ODDS " + parts.join(", ");
}

let backKey = "";
let backEls: Element[] = [];

function backPanel(): Element[] {
  const spinning = phase === "spin" || phase === "bounce";
  const key = `${deck}|${spinning ? "s" : phase}|${stamp}`;
  if (key === backKey) return backEls;
  backKey = key;
  const dk = d();
  const hist = state.hist[dk.name];
  const tally = state.tally[dk.name];
  const lines = flow(dk.options).slice(0, 2);
  const odds = oddsLine();
  if (odds) lines.push(odds);
  if (dk.options.length === 2) lines.push(`> ${dk.options[0]} ${tally[0]} / ${dk.options[1]} ${tally[1]}`);

  let last = "";
  for (let i = 0; i < hist.length; i++) {
    const next = last + (i ? ", " : "") + dk.options[hist[i]];
    if (textWidth("LAST " + next) - 1 > BODY_PX) break;
    last = next;
  }
  lines.push(last ? "LAST " + last : "NO SPINS YET");
  backEls = terminal({
    title: dk.label,
    right: `DECK ${deck + 1}/${DECKS.length}`,
    big: spinning ? "SPINNING" : phase === "result" ? shown(result) : "READY",
    lines,
    keys: spinning ? "BACK stop" : phase === "result" ? "OK/START again WHEEL/BACK list" : "WHEEL deck OK/START spin BACK leave",
    keysFont: "small",
  });
  return backEls;
}

function frame(): Element[] {
  return front().concat(backPanel());
}

function main(): void {
  restore();
  buildDeck();

  const last = state.hist[d().name];
  if (last.length) {
    phase = "result";
    result = last[0];
    pos = result;
    lastSlot = result;
    landAt = 0;
  }
  app = runApp({
    app: APP,
    tickMs: IDLE_MS,
    painter,
    drawOnInput: true,
    frame,
    tick: () => {
      const now = Date.now();

      if (phase === "result" && celebrate >= 0 && effectAccepted === celebrate && now - effectAt >= ANIM_MS) {
        celebrate += 1;
        if (celebrate >= GLITCH_TICKS) {
          celebrate = -1;
          effectAccepted = -1;
        }
      }

      if (raceSec && raceAt && now - raceAt >= RACE_MS) stopRace(now);
      step(now);
      if (saveAt && now >= saveAt) {
        saveAt = 0;
        persist();
      }
      wake();
    },
    onExit: persist,
    onBack: () => {
      syncClock(Date.now());
      if (phase === "result") { ready(); wake(); return true; }
      if (phase !== "spin" && phase !== "bounce") return false;
      ready();
      if (settings.sound) stopSound(APP);
      wake();
      return true;
    },
    input: (e) => {
      syncClock(Date.now());
      if (phase === "spin" || phase === "bounce") return;
      if (guarded() && (e.key === "encoder" || e.key === "ok" || e.key === "start")) return;
      if (e.key === "encoder") {
        if (phase === "result") { ready(); wake(); return; }
        deck = (deck + (e.delta > 0 ? 1 : DECKS.length - 1)) % DECKS.length;
        buildDeck();
        ready();
        saveAt = Date.now() + 2000;
        click();
      } else if ((e.key === "ok" || e.key === "start") && e.action === "short") {
        if (guarded()) return;
        spin();
      }
      wake();
    },
  });
}

readSettings(APP, DEFAULTS).then((s) => {
  settings = s;
  main();
});
