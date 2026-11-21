import { Painter, runApp, anim, back, bbitmap, countdown, segs, deferSound, stopSound, txt, xpm, terminal, textWidth, readSettings, load, save, shade, c, clamp, grey, NEON, type Element } from "@shared/painter";
import manifest from "./appmeta/manifest.json";

const APP = manifest.id;
const IDLE_MS = 1000;
const LEAD_MS = 60;
const GUARD_MS = 1000;

const GAP_MS = 15000;
const DOSE_MIN = 10;
const DOSE_MAX = 40;
const STORE = "pourover";

const DEFAULTS = { sound: true, count_beeps: true, light_cues: true, units: "celsius" };
let settings = DEFAULTS;

const painter = new Painter(APP, { hold: true });

type Tech = "center" | "spiral" | "circles" | "swirl" | "spin" | "stir" | "wait";

interface Step {
  name: string;
  end: number;
  to: number;
  bloomX?: number;
  tech: Tech;
  pourSec?: number;
}

interface Recipe {
  name: string;
  full: string; // Back
  ratio: number;
  ice?: number;
  temp: number;
  tempHi?: number;
  grind: string;
  steps: Step[];
}

function kasuya(first: number): Step[] {
  return [
    { name: "POUR 1/5", end: 45, to: first, tech: "circles", pourSec: 10 },
    { name: "POUR 2/5", end: 90, to: 0.4, tech: "circles", pourSec: 10 },
    { name: "POUR 3/5", end: 130, to: 0.6, tech: "circles", pourSec: 10 },
    { name: "POUR 4/5", end: 160, to: 0.8, tech: "circles", pourSec: 10 },
    { name: "POUR 5/5", end: 175, to: 1, tech: "circles", pourSec: 10 },
    { name: "DRAWDOWN", end: 210, to: 0, tech: "wait" },
  ];
}

const RECIPES: Recipe[] = [
  {

    name: "Copenhagen",
    full: "Coffee Collective, Kalita",
    ratio: 250 / 16,
    temp: 92,
    tempHi: 95,
    grind: "med-coarse",
    steps: [
      { name: "BLOOM", end: 30, to: 0.12, tech: "spiral", pourSec: 10 },
      { name: "POUR", end: 105, to: 1, tech: "spiral" },
      { name: "DRAWDOWN", end: 165, to: 0, tech: "wait" },
    ],
  },
  {

    name: "Hoffmann 1-cup",
    full: "Hoffmann 1-cup V60",
    ratio: 50 / 3,
    temp: 100,
    grind: "med-fine",
    steps: [
      { name: "BLOOM", end: 10, to: 0.2, tech: "circles" },
      { name: "SWIRL", end: 15, to: 0, tech: "swirl" },
      { name: "BLOOM", end: 45, to: 0, tech: "wait" },
      { name: "POUR 2/5", end: 70, to: 0.4, tech: "circles", pourSec: 15 },
      { name: "POUR 3/5", end: 90, to: 0.6, tech: "circles", pourSec: 10 },
      { name: "POUR 4/5", end: 110, to: 0.8, tech: "circles", pourSec: 10 },
      { name: "POUR 5/5", end: 120, to: 1, tech: "circles", pourSec: 10 },
      { name: "SWIRL", end: 125, to: 0, tech: "swirl" },
      { name: "DRAWDOWN", end: 180, to: 0, tech: "wait" },
    ],
  },
  {

    name: "Hoffmann V60",
    full: "Hoffmann Ultimate V60",
    ratio: 50 / 3,
    temp: 100,
    grind: "med-fine",
    steps: [
      { name: "BLOOM", end: 10, to: 0, bloomX: 2, tech: "spiral" },
      { name: "SWIRL", end: 15, to: 0, tech: "swirl" },
      { name: "BLOOM", end: 45, to: 0, tech: "wait" },
      { name: "POUR 1/2", end: 75, to: 0.6, tech: "spiral" },
      { name: "POUR 2/2", end: 105, to: 1, tech: "spiral" },
      { name: "STIR", end: 110, to: 0, tech: "stir" },
      { name: "SETTLE", end: 120, to: 0, tech: "wait" },
      { name: "SWIRL", end: 125, to: 0, tech: "swirl" },
      { name: "DRAWDOWN", end: 210, to: 0, tech: "wait" },
    ],
  },

  { name: "4:6 balanced", full: "Kasuya 4:6, balanced", ratio: 15, temp: 92, grind: "coarse", steps: kasuya(0.2) },

  { name: "4:6 sweet", full: "Kasuya 4:6, sweeter", ratio: 15, temp: 92, grind: "coarse", steps: kasuya(0.133) },
  { name: "4:6 bright", full: "Kasuya 4:6, brighter", ratio: 15, temp: 92, grind: "coarse", steps: kasuya(0.267) },
  {

    name: "4:6 light",
    full: "Kasuya 4:6, lighter",
    ratio: 15,
    temp: 92,
    grind: "coarse",
    steps: [
      { name: "POUR 1/4", end: 45, to: 0.2, tech: "circles", pourSec: 10 },
      { name: "POUR 2/4", end: 90, to: 0.4, tech: "circles", pourSec: 10 },
      { name: "POUR 3/4", end: 135, to: 0.7, tech: "circles", pourSec: 12 },
      { name: "POUR 4/4", end: 150, to: 1, tech: "circles", pourSec: 12 },
      { name: "DRAWDOWN", end: 210, to: 0, tech: "wait" },
    ],
  },
  {

    name: "4:6 strong",
    full: "Kasuya 4:6, stronger",
    ratio: 15,
    temp: 92,
    grind: "coarse",
    steps: [
      { name: "POUR 1/6", end: 45, to: 0.2, tech: "circles", pourSec: 10 },
      { name: "POUR 2/6", end: 90, to: 0.4, tech: "circles", pourSec: 10 },
      { name: "POUR 3/6", end: 120, to: 0.55, tech: "circles", pourSec: 8 },
      { name: "POUR 4/6", end: 150, to: 0.7, tech: "circles", pourSec: 8 },
      { name: "POUR 5/6", end: 180, to: 0.85, tech: "circles", pourSec: 8 },
      { name: "POUR 6/6", end: 190, to: 1, tech: "circles", pourSec: 8 },
      { name: "DRAWDOWN", end: 225, to: 0, tech: "wait" },
    ],
  },
  {

    name: "Rao V60",
    full: "Rao V60",
    ratio: 16.5,
    temp: 97,
    grind: "med-fine",
    steps: [
      { name: "BLOOM", end: 10, to: 0, bloomX: 3, tech: "spiral" },
      { name: "SPIN", end: 15, to: 0, tech: "spin" },
      { name: "BLOOM", end: 40, to: 0, tech: "wait" },
      { name: "POUR 1/2", end: 70, to: 0.6, tech: "spiral" },
      { name: "SPIN", end: 73, to: 0, tech: "spin" },
      { name: "DRAIN 70%", end: 105, to: 0, tech: "wait" },
      { name: "POUR 2/2", end: 135, to: 1, tech: "spiral" },
      { name: "SPIN", end: 140, to: 0, tech: "spin" },
      { name: "DRAWDOWN", end: 220, to: 0, tech: "wait" },
    ],
  },
  {

    name: "Winton 5 pours",
    full: "Winton five pours",
    ratio: 15,
    temp: 93,
    grind: "medium",
    steps: [
      { name: "POUR 1/5", end: 40, to: 0.2, tech: "spiral", pourSec: 10 },
      { name: "POUR 2/5", end: 80, to: 0.4, tech: "spiral", pourSec: 10 },
      { name: "POUR 3/5", end: 120, to: 0.6, tech: "spiral", pourSec: 10 },
      { name: "POUR 4/5", end: 160, to: 0.8, tech: "spiral", pourSec: 10 },
      { name: "POUR 5/5", end: 170, to: 1, tech: "spiral" },
      { name: "DRAWDOWN", end: 210, to: 0, tech: "wait" },
    ],
  },
  {

    name: "Iced flash",
    full: "Iced flash brew",
    ratio: 9.2,
    ice: 6.2,
    temp: 100,
    grind: "finer",
    steps: [
      { name: "BLOOM", end: 10, to: 0, bloomX: 2, tech: "spiral" },
      { name: "SWIRL", end: 15, to: 0, tech: "swirl" },
      { name: "BLOOM", end: 45, to: 0, tech: "wait" },
      { name: "POUR", end: 105, to: 1, tech: "spiral" },
      { name: "SWIRL", end: 110, to: 0, tech: "swirl" },
      { name: "DRAWDOWN", end: 165, to: 0, tech: "wait" },
    ],
  },
];

const POURS: Partial<Record<Tech, true>> = { center: true, spiral: true, circles: true };

const HOW: Record<Tech, string> = {
  center: "pour at the centre",
  spiral: "spiral out and back in",
  circles: "steady circles over the bed",
  swirl: "swirl the dripper gently",
  spin: "spin the dripper",
  stir: "stir one turn each way",
  wait: "hands off, wait",
};

const LOOP: Record<Tech, string> = { center: "ce", spiral: "sp", circles: "ci", swirl: "sw", spin: "sn", stir: "st", wait: "wt" };

const HOT = "#FF8A4C";
const waterRgb = (): string => (R().ice ? NEON.cyan : HOT);
const COFFEE = NEON.amber;
const DONE = "#FFCB7A";
const WHITE = c(NEON.white);
const GRAY = c("#A0A0A0");
const PIC_X = 2;
const X0 = 18;
const RX = 71;

// State

type Mode = "list" | "dose" | "brew" | "pause" | "done";

let mode: Mode = "list";
let recipe = 0;
let doseG = 16;
let brews = 0;
let actualMs = 0;
let skipped = false;
let completed = false;
let launchParent: "list" | "dose" = "list";
let brewMs = 0;
let lastTick = 0;
let wallStart = 0;
let brewSec = 0;
let doneAt = 0;
let doneClock = 0;
let lastStep = -1;
let lastCount = 0;
let stopCued = false;
let lastClick = 0;
let app: ReturnType<typeof runApp> | null = null;

const R = () => RECIPES[recipe];
const water = () => Math.round(doseG * R().ratio);
const ice = () => Math.round(doseG * (R().ice || 0));
const steps = () => R().steps;
const total = () => steps()[steps().length - 1].end;
const two = (n: number) => (n < 10 ? "0" : "") + n;
const mmss = (s: number) => `${Math.floor(s / 60)}:${two(Math.floor(s % 60))}`;
const ratio = () => `1:${Math.round(R().ratio * 10) / 10}`;
const hasTarget = (s: Step) => s.to > 0 || !!s.bloomX;
const target = (s: Step) => (s.bloomX ? doseG * s.bloomX : Math.round(water() * s.to));
const degrees = (cel: number) => (settings.units === "fahrenheit" ? Math.round((cel * 9) / 5 + 32) : cel);
const temp = () => `${degrees(R().temp)}${R().tempHi ? `-${degrees(R().tempHi || 0)}` : ""} ${settings.units === "fahrenheit" ? "F" : "C"}`;

const persist = () => save(STORE, { recipe: R().name, dose: doseG, brews, cc: 1 });

function pourCount(): number {
  let n = 0;
  for (const s of steps()) if (POURS[s.tech] && hasTarget(s)) n += 1;
  return n;
}

function stepAt(t: number): number {
  const s = steps();
  for (let i = 0; i < s.length; i++) if (t < s[i].end) return i;
  return s.length - 1;
}

function now() {
  const t = brewMs / 1000;
  const i = stepAt(t);
  const s = steps()[i];
  const start = i > 0 ? steps()[i - 1].end : 0;
  const win = s.tech === "wait" ? 0 : s.pourSec === undefined ? s.end - start : s.pourSec;
  const acting = t - start < win;
  return { t, i, s, start, win, acting, tech: acting ? s.tech : ("wait" as Tech), left: Math.max(0, (acting ? start + win : s.end) - t), next: steps()[i + 1] };
}

function word(n: ReturnType<typeof now>): string {
  if (n.acting) return n.tech === "swirl" ? "SWIRL" : n.tech === "spin" ? "SPIN" : n.tech === "stir" ? "STIR" : n.s.name === "BLOOM" ? "BLOOM" : "POUR";
  return n.s.name.charAt(0) === "D" ? "DRAIN" : "WAIT";
}

function nextTarget(i: number): number {
  const st = steps();
  for (let j = i + 1; j < st.length; j++) if (hasTarget(st[j])) return target(st[j]);
  return 0;
}

// Front

function pic(section: string, after = false): Element {
  return anim("pic", PIC_X, 0, "pour.anim", { section, loop: true, after });
}

const iced = (): string => (R().ice ? "i" : "");

function still(): string {
  for (const s of steps()) if (POURS[s.tech]) return `${iced()}g${LOOP[s.tech]}`;
  return "rdy";
}

function picture(section: string, after = false): Element[] {
  return [pic(section, after)];
}

function front(): Element[] {
  const r = R();
  if (mode === "list") {

    const d = `${doseG}g`;
    return picture(still()).concat([
      txt("l1", X0, 0, r.name, "small", WHITE),
      txt("dose", X0, 7, d, "small", WHITE),
      txt("water", X0 + textWidth(d) + 3, 7, `${water()}g`, "small", c(waterRgb())),
      txt("l2", RX, 7, mmss(total()), "small", GRAY, "top_right"),
    ]);
  }
  if (mode === "dose") {
    const d = String(doseG);
    return picture(still()).concat([
      segs("num", X0, 2, d, NEON.white, { ghost: 0 }),
      txt("unit", X0 + 16, 7, "g", "small", WHITE),
      txt("l1", RX, 0, `${water()}g`, "small", c(waterRgb()), "top_right"),
      txt("l2", RX, 7, r.ice ? `ICE ${ice()}g` : ratio(), "small", GRAY, "top_right"),
    ]);
  }
  if (mode === "done") {

    const lifting = Date.now() - doneAt < 400;
    return picture(completed ? (lifting ? "lift" : "full") : "end", completed && !lifting).concat([
      txt("l1", X0, -1, completed ? "ENJOY" : "ENDED", "bold", c(DONE)),
      txt("l2", X0, 8, `${mmss(brewSec)}  ${completed ? `${water()}g` : "STOPPED"}`, "small", GRAY),
    ]);
  }
  const n = now();
  const wet = n.acting && !!POURS[n.tech];
  const paused = mode === "pause";

  const rgb = paused ? shade(NEON.white, 0.55) : wet ? (n.left <= 3 && n.win > 4 ? NEON.white : waterRgb()) : COFFEE;
  const what = word(n);

  const section = paused ? (wet ? "gp" : "gw") : what === "DRAIN" ? "dr" : POURS[n.tech] ? iced() + LOOP[n.tech] : LOOP[n.tech];
  const out: Element[] = picture(section).concat([
    segs("num", X0, 2, mmss(Math.ceil(n.left - 0.001)), rgb, { ghost: 0.12 }),
    txt("l1", RX, 0, paused ? "PAUSE" : what, "small", WHITE, "top_right"),
  ]);

  if (hasTarget(n.s) && n.acting) out.push(txt("l2", RX, 7, `${target(n.s)}g`, "small", WHITE, "top_right"));
  else {
    const g = nextTarget(n.i);
    out.push(txt("l2", RX, 7, g ? `>${g}g` : "END", "small", GRAY, "top_right"));
  }
  return out;
}

const DIAG = 23;
let diagCache: Record<string, string> = {};

function diagram(tech: Tech): string {
  const hit = diagCache[tech];
  if (hit) return hit;
  const m = (DIAG - 1) / 2;
  const g: string[][] = [];
  for (let y = 0; y < DIAG; y++) {
    const row: string[] = [];
    for (let x = 0; x < DIAG; x++) row.push(".");
    g.push(row);
  }
  const put = (x: number, y: number, ch: string) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi >= 0 && yi >= 0 && xi < DIAG && yi < DIAG) g[yi][xi] = ch;
  };
  const ring = (r: number, ch: string) => {
    for (let a = 0; a < 6.3; a += 0.05) put(m + r * Math.cos(a), m + r * Math.sin(a), ch);
  };
  const moving = tech === "swirl" || tech === "spin";
  ring(m - 0.4, moving ? "w" : "r");
  if (tech === "spiral") for (let p = 0; p <= 1; p += 0.004) put(m + (0.5 + p * 7.5) * Math.cos(p * 14.1), m + (0.5 + p * 7.5) * Math.sin(p * 14.1), "w");
  else if (tech === "circles") ring(5.4, "w");
  else if (tech === "center") ring(2.2, "w");
  else if (tech === "stir") ring(4.4, "w");
  else {
    ring(7.4, "d");
    if (!moving) put(m, m, "w");
  }
  const data = xpm(g.map((row) => row.join("")), ". c none\nr c #777777\nd c #555555\nw c #FFFFFF");
  diagCache[tech] = data;
  return data;
}

const BLANK_DIAG = xpm(Array(DIAG + 1).join(".").split("").map(() => Array(DIAG + 1).join(".")), ". c #000000");

const CLOCK_Y = 57;
const CLOCK_X = 2 + textWidth("TIME ");

const clock2 = (s: number) => `${two(Math.floor(s / 60))}:${two(Math.floor(s % 60))}`;

function backPanel(): Element[] {
  const r = R();
  const card = `${temp()}  GRIND ${r.grind}`;
  const plan = `${pourCount()} POURS  ${mmss(total())}`;
  let out: Element[];
  let clock = false;
  let diag = "";
  if (mode === "list") {
    out = terminal({
      title: "POUR OVER",
      right: `${recipe + 1}/${RECIPES.length}`,
      lines: [`> ${r.full}`, `${doseG} g COFFEE  ${water()} g WATER`, `RATIO ${ratio()}${r.ice ? `  ICE ${ice()} g` : ""}`, card, plan, `BREWS ${brews}`],
      keys: "WHEEL recipe  OK dose  START brew",
      keysFont: "small",
    });
  } else if (mode === "dose") {
    out = terminal({
      title: "POUR OVER",
      right: "DOSE",
      big: `${doseG} g`,
      lines: [`> WATER ${water()} g${r.ice ? `  ICE ${ice()} g` : ""}`, `RATIO ${ratio()}  ${r.name}`, card, plan],
      keys: "WHEEL dose  OK/START brew  BACK list",
      keysFont: "small",
    });
  } else if (mode === "done") {
    out = terminal({
      title: "POUR OVER",
      right: completed ? "DONE" : "ENDED",
      big: `${completed ? "ENJOY" : "ENDED"} ${mmss(brewSec)}`,

      lines: [`> ${r.full}`, `ACTUAL ${mmss(brewSec)}  PLAN ${mmss(total())}`, `${doseG} g > ${water()} g  BREWS ${brews}`, completed ? "lift the dripper, swirl the cup" : "No completed-brew credit"],
      keys: "START again  OK/BACK list",
      keysFont: "small",
    });
  } else {
    const n = now();
    const s = n.s;
    const running = mode === "brew";
    clock = running;
    diag = diagram(n.acting ? n.tech : s.tech === "wait" ? "wait" : n.tech);
    let how = `${word(n) === "DRAIN" ? "hands off, let it drain" : HOW[n.tech]}, ${Math.round(n.acting ? n.win : s.end - n.start - n.win)} s`;
    if (!n.acting && s.tech !== "wait") how = hasTarget(s) ? `stop at ${target(s)} g, let it ${s.name === "BLOOM" ? "bloom" : "drain"}` : "done, let it settle";
    const nx = n.next;
    const left = mmss(Math.ceil(n.left - 0.001));
    out = terminal({
      title: "POUR OVER",
      right: `STEP ${n.i + 1}/${steps().length}`,
      big: running ? (hasTarget(s) ? `${target(s)} g  ${left}` : left) : "PAUSED",
      lines: [
        `> ${s.name}${hasTarget(s) ? ` TO ${target(s)} g` : ""}`,
        running ? how : "OK or START resumes only",
        nx ? `NEXT ${nx.name} at ${mmss(s.end)}${hasTarget(nx) ? `, ${target(nx)} g` : ""}` : `END at ${mmss(s.end)}: lift the dripper`,
        running ? "TIME" : `TIME ${clock2(actualMs / 1000)}`,
      ],
      keys: running ? "START pause  OK next  BACK end" : "OK/START resume  BACK end",
      keysFont: "small",
    });
  }

  out.push(bbitmap("pm_diag", 122, 13, diag || BLANK_DIAG, 3));
  out.push(back(countdown("b_clock", CLOCK_X, CLOCK_Y, clock ? wallStart : 0, { up: clock, color: clock ? grey(9) : "#000000FF", z: clock ? 5 : 0 })));
  return out;
}

function frame(): Element[] {
  return front().concat(backPanel());
}

function resync(): void {
  if (!app) return;
  app.setTick(IDLE_MS + 1);
  app.setTick(IDLE_MS);
}

function startClock(ms: number): void {
  brewMs = ms;
  lastTick = Date.now();
  wallStart = lastTick - actualMs;
  resync();
}

function blink(rgb: string): void { if (settings.light_cues) painter.led(rgb); }

function play(name: string): void {
  if (settings.sound) deferSound(APP, name);
}

function stepSound(i: number): string {
  const s = steps()[i];
  if (POURS[s.tech]) return "pour";
  if (s.tech !== "wait") return "swirl";
  return i === steps().length - 1 ? "drain" : "wait";
}

function cues(): void {
  const n = now();
  const s = n.s;
  if (n.i !== lastStep) {
    lastStep = n.i;
    lastCount = 0;
    const closed = !!POURS[s.tech] && !n.acting;
    stopCued = closed;
    play(closed ? "stop" : stepSound(n.i));
    blink(!closed && POURS[s.tech] ? waterRgb() : COFFEE);
    return;
  }
  if (!POURS[s.tech]) return;
  const windowEnd = n.start + n.win;
  if (n.t >= windowEnd && windowEnd < s.end && !stopCued) {
    stopCued = true;
    play("stop");
    blink(COFFEE);
    return;
  }
  const left = Math.ceil(windowEnd - n.t);
  if (left >= 1 && left <= 3 && left !== lastCount && n.win > 4) {
    lastCount = left;
    if (settings.count_beeps) play("tick");
  }
}

function brew(): void {
  if (mode === "brew" || mode === "pause") return;
  launchParent = mode === "dose" ? "dose" : "list";
  actualMs = 0;
  skipped = false;
  completed = false;
  mode = "brew";
  lastStep = -1;
  startClock(LEAD_MS);
  persist();
  cues();
}

function pauseCue(): void {
  stopSound(APP);
  play("pause");
}

function pause(): void {
  mode = "pause";
  pauseCue();
}

function finish(ran = true): void {
  if (mode !== "brew" && mode !== "pause") return;
  completed = ran && !skipped && actualMs > 0;
  mode = "done";
  doneAt = doneClock = Date.now();
  brewSec = Math.round(actualMs / 1000);
  if (completed) brews += 1;
  persist();
  if (completed) { play("done"); blink(DONE); }
  else pauseCue();
}

function resultGuarded(): boolean {
  const now = Date.now();
  if (now < doneClock) doneAt += now - doneClock;
  doneClock = now;
  return now - doneAt < GUARD_MS;
}

function tick(): void {
  if (mode === "done") { resultGuarded(); return; }
  if (mode !== "brew") return;
  const t = Date.now();
  if (t - lastTick > GAP_MS) {

    pause();
    return;
  }
  const end = total() * 1000;
  const delta = Math.max(0, Math.min(t - lastTick, end - brewMs));
  brewMs += delta;
  actualMs += delta;
  if (t < lastTick) wallStart = t - actualMs;
  lastTick = t;
  if (brewMs >= end) return finish();
  cues();
}

function click(): void {
  const t = Date.now();
  if ((t >= lastClick && t - lastClick < 80) || !settings.sound) return;
  lastClick = t;
  play("click");
}

function main(): void {
  const saved = load(STORE, { recipe: RECIPES[0].name, dose: doseG, brews: 0, cc: 0 });

  if (saved.cc === 1) {
    const renamed: Record<string, string> = { "CC Copenhagen": "Copenhagen", "Hoffmann 1cup": "Hoffmann 1-cup", "Hoffmann Ult": "Hoffmann V60", Rao: "Rao V60", "Winton 5x": "Winton 5 pours" };
    const name = renamed[String(saved.recipe)] || String(saved.recipe);
    for (let i = 0; i < RECIPES.length; i++) if (RECIPES[i].name === name) recipe = i;
    if (typeof saved.dose === "number" && saved.dose >= DOSE_MIN && saved.dose <= DOSE_MAX) doseG = Math.round(saved.dose);
  }
  if (typeof saved.brews === "number" && saved.brews > 0 && saved.brews < 1e7) brews = Math.floor(saved.brews);

  app = runApp({
    app: APP,
    tickMs: IDLE_MS,
    painter,
    frame,
    tick,
    drawOnInput: true,
    onExit: persist,
    onBack: () => {
      const before = mode;
      tick();
      if (before !== "done" && mode === "done") return true;
      if (mode === "list") return false;
      if (mode === "brew" || mode === "pause") {
        if (actualMs > 0) finish(false);
        else { mode = launchParent; stopSound(APP); }
      } else {
        mode = "list";
        click();
      }
      return true;
    },
    input: (e) => {
      if (e.key === "encoder" || e.action === "short") {
        const brewing = mode === "brew";
        tick();
        if (brewing && mode === "pause") return;
      }
      if (mode === "done" && resultGuarded()) return;
      if (e.key === "encoder") {
        if (mode === "done") { mode = "list"; click(); return; }
        const before = recipe * 100 + doseG;
        if (mode === "list") {
          recipe = (recipe + (e.delta > 0 ? 1 : RECIPES.length - 1)) % RECIPES.length;
          mode = "list";
        } else if (mode === "dose") doseG = clamp(doseG + e.delta, DOSE_MIN, DOSE_MAX);
        if (recipe * 100 + doseG !== before) click();
        return;
      }
      if (e.action !== "short" || (e.key !== "ok" && e.key !== "start")) return;
      if (mode === "done") {
        if (resultGuarded()) return;
        if (e.key === "start") brew();
        else {
          mode = "list";
          click();
        }
      } else if (mode === "list") {
        if (e.key === "start") brew();
        else {
          mode = "dose";
          click();
        }
      } else if (mode === "dose") brew();
      else if (mode === "pause") {
        mode = "brew";
        startClock(brewMs);
        play("resume");
      } else if (e.key === "ok") {

        const n = now();
        skipped = true;
        if (n.i >= steps().length - 1) return finish(false);
        startClock(n.s.end * 1000 + LEAD_MS);
        if (mode === "brew") cues();
        else click();
      } else if (mode === "brew") pause();
    },
  });
}

readSettings(APP, DEFAULTS).then((s) => {
  settings = s;
  main();
}).catch((error: unknown) => console.error(`${APP}: startup: ${String(error)}`));
