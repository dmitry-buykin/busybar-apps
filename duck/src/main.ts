import { Painter, runApp, anim, rect, txt, deferSound, stopSound, terminal, wrapWidth, textWidth, readSettings, load, save, shade, grey, type Element, type AppHandle } from "@shared/painter";
import manifest from "./appmeta/manifest.json";
import { DECKS } from "../lib/decks";

const APP = manifest.id;

const DEFAULTS = { sound: true, quack: "phrase", pace: "normal" };
let settings = DEFAULTS;
const PACE: Record<string, number> = { slow: 1.4, normal: 1, quick: 0.75 };

const STEP_MS = 72;
const WORD_MS = 2 * STEP_MS;
const IDLE_MS = 1000;
const FADE_MS = 70;
const CARD_MS = 1500;
const GROUP_LABEL = "APPLIED AI";
const GROUP_NAME = "My notes on Applied AI";

const DUCK_X = 2;
const DUCK_Y = 2;
const REGION_X = 14;
const REGION_W = 72 - REGION_X;
const ROW1 = 0;
const ROW2 = 7;
const ROW_ONE = 3;
const WHITE = "#FFFFFF";
const FADE = [0.15, 0.45, 1];
const GREY = "#A0A0A0FF";
const HIDDEN = txt("l2", 0, 0, ".", "small", "#000000FF", "top_left", 0);

const DUCK_FILE = "duck.anim";
const KERCHIEF = { x: DUCK_X + 4, y: DUCK_Y - 1 + 5, w: 5, h: 3 };
let duckSec = "idle";
let duckAfter = false;
let talkAt = 0;
let twin = false;

function duckIdle(): void {
  duckSec = "idle";
  duckAfter = false;
  talkAt = 0;
}

function duckTalk(now: number, gesture: string): void {
  const p = pages[page];
  twin = !twin;
  duckSec = (twin ? gesture.toUpperCase() : gesture) + p.split + (p.one ? 0 : p.words - p.split);
  duckAfter = false;
  talkAt = now;
}

function sent(els: Element[]): void {
  let sec = "";
  for (let i = 0; i < els.length; i++) if (els[i].id === "duck") sec = (els[i] as { section?: string }).section || "";
  if (sec !== duckSec) return;
  const wait = Date.now() - talkAt;
  if (phase === "reveal" && at && wait > 0) at += wait > 1000 ? 1000 : wait;
  duckSec = "idle";
  duckAfter = true;
  talkAt = 0;
  wake();
}

class DuckPainter extends Painter {
  draw(els: Element[]): void {
    super.draw(els);
    if (talkAt) sent(this.snapshot());
  }
}

function invalidated(): void {
  duckIdle();
}

function duckEls(rgb: string): Element[] {
  return [
    anim("duck", DUCK_X, DUCK_Y - 1, DUCK_FILE, { section: duckSec, loop: true, after: duckAfter }, 3),
    rect("kerchief", KERCHIEF.x, KERCHIEF.y, KERCHIEF.w, KERCHIEF.h, rgb + "FF", 2),
  ];
}

interface Page {
  x: number;
  one: boolean;
  words: number;
  split: number;
  pre: string[];
  hold: number;
}

function layout(text: string): Page[] {
  const lines = text.split(" / ");
  const pages: Page[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const a = lines[i];
    const b = i + 1 < lines.length ? lines[i + 1] : "";
    const ink = Math.max(textWidth(a) - 1, b ? textWidth(b) - 1 : 0);
    const pre: string[] = [];
    const wa = a.split(" ");
    for (let k = 1; k <= wa.length; k++) pre.push(wa.slice(0, k).join(" "));
    const wb = b ? b.split(" ") : [];
    for (let k = 1; k <= wb.length; k++) pre.push(wb.slice(0, k).join(" "));
    const chars = a.length + b.length;
    pages.push({ x: REGION_X + ((REGION_W - ink) >> 1), one: !b, words: pre.length, split: wa.length, pre, hold: 1300 + 70 * chars });
  }
  return pages;
}

type Mode = "prompt" | "why" | "card";
type Phase = "show" | "reveal" | "out" | "in";

const painter = new DuckPainter(APP, { hold: true, onInvalidated: invalidated });
let app: AppHandle | null = null;

let deck = 0;
let qOf: number[] = DECKS.map(() => 0);
let mode: Mode = "prompt";
let pages: Page[] = [];
let page = 0;
let phase: Phase = "show";
let step = 0;
let at = 0;
let firstPass = true;
let levels: string[] = [];
let cardUntil = 0;
let flapAt = -1e9;
let pointAt = -1e9;
let lastQuack = 0;

const D = () => DECKS[deck];
const pace = () => PACE[settings.pace] || 1;

let clickAt = 0;
let clockAt = Date.now();

function play(name: string): void {
  if (!settings.sound) return;
  const now = Date.now();
  if (name === "click") {
    if (now - clickAt < 200) return;
    clickAt = now;
  }
  deferSound(APP, name);
}

function speak(): void {
  if (page === 0) play(mode === "why" ? "why" : "ask");
  else if (settings.quack === "phrase") {
    lastQuack = (lastQuack + 1 + ((Math.random() * 3) | 0)) % 4;
    play(`quack${lastQuack + 1}`);
  }
}

function setColor(rgb: string): void {
  levels = FADE.map((k) => shade(rgb, k) + "FF");
}

function startText(text: string, rgb: string, still: boolean): void {
  const now = Date.now();
  flapAt = pointAt = -1e9;
  pages = layout(text);
  page = 0;
  setColor(rgb);
  firstPass = !still;
  if (still) {
    showPage(now);
    duckIdle();
  } else {
    if (mode === "why") pointAt = now;
    else flapAt = now;
    startReveal(now, mode === "why" ? "w" : "q");
  }
}

function startReveal(now: number, gesture: string): void {
  phase = "reveal";
  step = 1;
  at = now + WORD_MS;
  duckTalk(now, gesture);
  speak();
}

function showPage(now: number): void {
  phase = "show";
  step = 0;
  const p = pages[page];
  const last = page === pages.length - 1;

  at = pages.length === 1 && mode === "prompt" ? 0 : now + (p.hold + (last ? 1200 : 0)) * pace();
}

function questionText(): string {
  return D().p[qOf[deck]][0];
}

function showQuestion(still: boolean): void {
  mode = "prompt";
  startText(questionText(), WHITE, still);
}

function advance(now: number): void {
  if (mode === "card") {
    if (now >= cardUntil) {
      showQuestion(false);
      persist();
    }
    return;
  }

  for (let guard = 0; guard < 8 && at && now >= at; guard++) {
    if (phase === "reveal") {
      if (step < pages[page].words) {
        step += 1;
        at += WORD_MS;
      } else showPage(now);
    } else if (phase === "show") {
      phase = "out";
      step = 2;
      at = now + FADE_MS;
    } else if (phase === "out") {
      if (step > 0) {
        step -= 1;
        at += FADE_MS;
        continue;
      }
      if (page + 1 < pages.length) page += 1;
      else if (mode === "why") {

        showQuestion(true);
        phase = "in";
        step = 0;
        at = now + FADE_MS;
        continue;
      } else {
        page = 0;
        firstPass = false;
      }
      if (firstPass) startReveal(now, "n");
      else {
        phase = "in";
        step = 0;
        at = now + FADE_MS;
      }
    } else if (phase === "in") {
      if (step < 2) {
        step += 1;
        at += FADE_MS;
      } else showPage(now);
    }
  }
}

function wake(): void {
  if (!app) return;
  const now = Date.now();
  const card = mode === "card";
  const due = card ? cardUntil : at;
  const cadence = card || !at || phase === "show" ? IDLE_MS : phase === "reveal" ? WORD_MS : FADE_MS;
  let ms = due ? due - now : IDLE_MS;
  if (ms > cadence - 24) ms = cadence;
  else if (ms < 24) ms = 24;
  app.setTick(ms);
}

function syncClock(now: number): void {
  const correction = now - clockAt;
  if (correction < 0) {
    if (at) at += correction;
    cardUntil += correction;
    if (talkAt) talkAt += correction;
    if (flapAt > -1e9) flapAt += correction;
    if (pointAt > -1e9) pointAt += correction;
    clickAt += correction;
  }
  clockAt = now;
}

function tick(): void {
  const now = Date.now();
  syncClock(now);
  advance(now);
  wake();
}

function front(): Element[] {
  const d = D();
  const out: Element[] = duckEls(d.rgb);
  if (mode === "card") {

    const sub = d.group ? GROUP_LABEL : d.tag;
    const nameW = textWidth(d.name, "bold") - 1;
    const subW = textWidth(sub) - 1;
    const x = REGION_X + ((REGION_W - Math.max(nameW, subW)) >> 1);
    out.push(txt("l1", x, -1, d.name, "bold", d.rgb + "FF"));
    out.push(txt("l2", x, 8, sub, "small", GREY));
    return out;
  }
  const p = pages[page];
  if (phase === "out" || phase === "in") {
    const c = levels[step];
    const last = p.pre.length - 1;
    out.push(txt("l1", p.x, p.one ? ROW_ONE : ROW1, p.pre[p.split - 1], "small", c));
    out.push(p.one ? HIDDEN : txt("l2", p.x, ROW2, p.pre[last], "small", c));
    return out;
  }
  const shown = phase === "reveal" ? step : p.words;
  const c = levels[2];
  out.push(txt("l1", p.x, p.one ? ROW_ONE : ROW1, p.pre[Math.min(shown, p.split) - 1], "small", c));
  out.push(!p.one && shown > p.split ? txt("l2", p.x, ROW2, p.pre[shown - 1], "small", c) : HIDDEN);
  return out;
}

const KEYS_PROMPT = "START next OK why BACK leave";
const KEYS_WHY = "START next OK question BACK question";
const KEYS_CARD = "WHEEL deck OK/START go BACK leave";
const BODY_PX = 144;

let backKey = "";
let backEls: Element[] = [];

function backPanel(): Element[] {
  const key = `${mode}|${deck}|${qOf[deck]}|${page}`;
  if (key === backKey) return backEls;
  backKey = key;
  const d = D();
  const n = d.p.length;
  if (mode === "card") {
    backEls = terminal({
      title: "RUBBER DUCK",
      right: `DECK ${deck + 1}/${DECKS.length}`,
      big: d.name,
      lines: (d.group ? [`> ${GROUP_NAME}`] : []).concat([`> ${d.about}`, `${n} questions, ${d.tag}`]),
      keys: KEYS_CARD,
      keysFont: "small",
    });
    return backEls;
  }
  const pr = d.p[qOf[deck]];
  const q = wrapWidth(pr[0].split(" / ").join(" "), BODY_PX - textWidth("> "));
  const why = wrapWidth(pr[1].split(" / ").join(" "), BODY_PX);
  const question = q.map((l, i) => (i ? "   " : "> ") + l);
  const both = question.concat(q.length + why.length < 6 ? [""] : [], why);

  const all = both.length <= 6 ? both : mode === "why" ? why : question;
  const count = Math.ceil(all.length / 6);
  const backPage = Math.min(count - 1, Math.floor(page * count / pages.length));
  const lines = all.slice(backPage * 6, (backPage + 1) * 6);
  backEls = terminal({
    title: `${d.group ? GROUP_LABEL : "DUCK"}  ${d.name}`,
    right: count > 1 ? `${mode === "why" ? "WHY " : ""}${backPage + 1}/${count}` : mode === "why" ? "WHY WHEEL deck" : `Q${qOf[deck] + 1} WHEEL deck`,
    lines,
    bright: mode === "why" ? 0 : q.length,
    keys: mode === "why" ? KEYS_WHY : KEYS_PROMPT,
    keysFont: "small",
  });
  if (mode === "why") {

    const from = both.length <= 6 ? lines.length - why.length : 0;
    for (const e of backEls) {
      const m = /^b_l(\d)$/.exec(e.id);
      if (m && lines[+m[1]]) (e as { color: string }).color = grey(+m[1] >= from ? 15 : 8);
    }
  }
  return backEls;
}

function frame(): Element[] {
  return front().concat(backPanel());
}

function persist(): void {
  save("duck", { v: 2, deck, q: qOf });
}

function input(e: BusyInputEvent): void {
  const now = Date.now();
  syncClock(now);
  if (e.key === "encoder") {
    stopSound(APP);
    deck = (deck + (e.delta > 0 ? 1 : DECKS.length - 1)) % DECKS.length;
    mode = "card";
    cardUntil = now + CARD_MS;

    duckIdle();
    duckSec = `c${deck}`;
    play("click");
  } else if (e.action !== "short") {
    return;
  } else if (e.key === "start") {

    if (mode !== "card") qOf[deck] = (qOf[deck] + 1) % D().p.length;
    showQuestion(false);
    persist();
  } else if (e.key === "ok") {
    const was = mode;
    if (was === "prompt") {

      mode = "why";
      startText(D().p[qOf[deck]][1], D().rgb, false);
    } else {
      showQuestion(was === "why");
      if (was === "why") play("page");
      else persist();
    }
  }
  wake();
}

function onBack(): boolean {
  syncClock(Date.now());
  if (mode !== "why") return false;
  showQuestion(true);
  play("page");
  wake();
  return true;
}

function restore(): void {
  const saved = load<{ deck?: unknown; q?: unknown }>("duck", {});
  const d = typeof saved.deck === "number" && saved.deck >= 0 && saved.deck < DECKS.length ? saved.deck | 0 : 0;
  deck = d;
  const q = saved.q;
  for (let i = 0; i < DECKS.length; i++) {
    let v: unknown = q instanceof Array ? q[i] : i === d ? q : 0;
    if (typeof v !== "number" || v < 0 || v >= DECKS[i].p.length) v = 0;
    qOf[i] = (v as number) | 0;
  }
}

function main(): void {
  restore();
  showQuestion(true);
  app = runApp({ app: APP, tickMs: IDLE_MS, painter, drawOnInput: true, frame, tick, input, onBack, onExit: persist });
  wake();
}

readSettings(APP, DEFAULTS).then((s) => {
  settings = s;
  main();
});
