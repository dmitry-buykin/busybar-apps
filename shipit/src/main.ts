import { Painter, runApp, txt, rect, anim, deferSound, terminal, readSettings, load, save, today, shade, c, NEON, capY, type AppHandle, type Element } from "@shared/painter";
import manifest from "./appmeta/manifest.json";

const APP = manifest.id;
const SEQ_MS = 200;
const GLITCH_MS = 100;
const IDLE_MS = 1000;
const COUNT_MS = 3000;
const LIFT_MS = 2800;
const PULL_MS = 400;
const CUT_MS = 720;
const LAND_MS = 1600;
const DESCENT_MS = 2160;
const STEP_MS = 900;
const RESULT_MS = 8000;
const GUARD_MS = 1000;

const DEFAULTS = { sound: true, risks: true, light_cues: true };
let settings = DEFAULTS;

type Kind = "ship" | "canary" | "rollback";
interface Target {
  name: string;
  key: string;
  flaky: number;
  kind: Kind;
  rgb: string;
  risk: string;
}
const TARGETS: Target[] = [
  { name: "Dev", key: "dev", flaky: 0, kind: "ship", rgb: NEON.mint, risk: "risk: none" },
  { name: "Staging", key: "staging", flaky: 12, kind: "ship", rgb: NEON.amber, risk: "risk: flaky test 1 in 12" },
  { name: "Canary", key: "canary", flaky: 0, kind: "canary", rgb: NEON.yellow, risk: "risk: rollout may die, 1 in 10/step" },
  { name: "Prod", key: "prod", flaky: 12, kind: "ship", rgb: NEON.red, risk: "risk: flaky test 1 in 12" },
  { name: "Hotfix", key: "hotfix", flaky: 8, kind: "ship", rgb: NEON.orange, risk: "risk: rushed, flaky test 1 in 8" },
  { name: "Rollback", key: "rollback", flaky: 0, kind: "rollback", rgb: "#5AB4FF", risk: "risk: none, brings the last one back" },
  { name: "Friday", key: "friday", flaky: 3, kind: "ship", rgb: NEON.magenta, risk: "risk: prod on a Friday. flaky 1 in 3" },
];
const ROLLBACK = 5;
const STEPS = [5, 25, 50, 75, 100];
const HIST_MAX = 5;

type Outcome = "ok" | "rb" | "flaky" | "abort" | "dead";
const OUT_SHORT: Record<Outcome, string> = { ok: "OK", rb: "RB", flaky: "FLAKY", abort: "ABORT", dead: "DEAD" };
const OUT_BIG: Record<Outcome, string> = { ok: "SHIPPED", rb: "ROLLED BACK", flaky: "FLAKY TEST", abort: "ABORTED", dead: "CANARY DOWN" };

type Mode = "idle" | "count" | "lift" | "canary" | "land" | "result";

const painter = new Painter(APP, { hold: true, onAccepted: acceptedPad, onInvalidated: invalidatedPad });
let app: AppHandle | null = null;

let target = 0;
let mode: Mode = "idle";
let since = 0;
let outcome: Outcome = "ok";
let plan: "ship" | "flaky" | "canary" | "rollback" = "ship";
let death = -1;
let step = 0;
let beat = 3;
let glitch = 0;
let ignited = false;

let section = "i0";
let queued = false;
let next = "";
let sectionAt = 0;
let padVersion = 0;
let phaseVersion = 0;
let acceptedVersion = -1;
let padWaiting = true;
let heldElapsed = 0;

function acceptedPad(elements: Element[], at: number): void {
  if (!padWaiting || !elements.some(e => e.id === `pad${padVersion}`) || !elements.some(e => e.id === `phase${phaseVersion}`)) return;
  syncClock(at);
  padWaiting = false;
  if (acceptedVersion !== padVersion) { sectionAt = at; acceptedVersion = padVersion; }
  since = at - heldElapsed;
  pace();
}
function invalidatedPad(): void {
  syncClock(Date.now());

  heldElapsed = mode === "canary" ? step * STEP_MS : 0;
  if (mode === "count") { section = plan === "rollback" ? "e" : `c${target}`; next = ""; beat = 3; ignited = false; }
  padWaiting = true;
  sectionAt = 0;
  padVersion++;
}

function sectionMs(): number {
  return section === "lp2" ? 2400 : section === "d" ? DESCENT_MS : section.charAt(0) === "l" ? LIFT_MS :
    section.charAt(0) === "k" ? 2000 : section.charAt(0) === "x" ? 1600 : COUNT_MS;
}

let shipped = 0;
let rollbacks = 0;
let streak = 0;
let best = 0;
let lastDay = "";
let hist: [number, Outcome][] = [];
let log: string[] = [];
let day = today();
let dayCheckAt = 0;
let clockAt = Date.now();
let saveAt = 0;

const T = () => TARGETS[target];
const play = (name: string) => {
  if (settings.sound) deferSound(APP, name);
};

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const p = (n: number) => (n < 10 ? "0" : "") + n;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const liveStreak = () => (lastDay === day || lastDay === yesterday() ? streak : 0);

const count = (v: unknown) => (typeof v === "number" && v > 0 && v < 1e9 ? Math.floor(v) : 0);

function restore(): void {
  const s = load("ship", { shipped: 0, streak: 0, best: 0, day: "", rb: 0, target: 0, hist: [] as unknown[] }) as Record<string, unknown>;
  shipped = count(s.shipped);
  streak = count(s.streak);
  rollbacks = count(s.rb);
  best = Math.max(count(s.best), streak);
  lastDay = typeof s.day === "string" && /^\d{4}-\d\d-\d\d$/.test(s.day) ? s.day : "";
  const t = count(s.target);
  if (t < TARGETS.length) target = t;
  hist = [];
  const h = Array.isArray(s.hist) ? s.hist : [];
  for (let i = 0; i < h.length && i < HIST_MAX; i++) {
    const e = h[i];
    if (Array.isArray(e) && typeof e[0] === "number" && e[0] >= 0 && e[0] < TARGETS.length && typeof e[1] === "string" && ["ok", "rb", "flaky", "abort", "dead"].indexOf(e[1]) >= 0) {
      hist.push([Math.floor(e[0]), e[1] as Outcome]);
    }
  }
}

function persist(): void {
  saveAt = 0;
  save("ship", { shipped, streak, best, day: lastDay, rb: rollbacks, target, hist });
}

function record(o: Outcome): void {
  outcome = o;
  day = today();
  if (o === "ok") {
    shipped += 1;
    if (lastDay !== day) {
      streak = lastDay === yesterday() ? streak + 1 : 1;
      lastDay = day;
    }
    if (streak > best) best = streak;
  } else if (o === "rb" || o === "dead") rollbacks += 1;
  hist.unshift([target, o]);
  if (hist.length > HIST_MAX) hist.length = HIST_MAX;
  persist();
}

function say(line: string): void {
  log.push(line);
  if (log.length > 5) log.shift();
}

function padNow(name: string, then = ""): void {
  if (!padWaiting) heldElapsed = Math.max(0, Date.now() - since);
  section = name;
  queued = false;
  next = then;
  sectionAt = 0;
  padVersion++;
  padWaiting = true;
}

function padLater(name: string, then = ""): void { padNow(name, then); }
const idleSection = () => (target === ROLLBACK ? "e" : `i${target}`);

function enter(m: Mode): void {
  mode = m;
  since = Date.now();
  padWaiting = true;
  heldElapsed = 0;
  phaseVersion++;
  pace();
}

function pace(): void {
  if (app) app.setTick(glitch > 0 ? GLITCH_MS : mode !== "idle" && mode !== "result" ? SEQ_MS : IDLE_MS);
}

const roll = (n: number) => n > 0 && Math.floor(Math.random() * n) === 0;

function launch(): void {
  if (mode !== "idle" && mode !== "result") return;
  if (mode === "result" && (padWaiting || Date.now() - since < GUARD_MS)) return;
  const t = T();
  const risky = settings.risks;
  plan = t.kind === "rollback" ? "rollback" : t.kind === "canary" ? "canary" : risky && roll(t.flaky) ? "flaky" : "ship";
  death = -1;
  if (plan === "canary" && risky) for (let s = 0; s < 3 && death < 0; s++) if (roll(10)) death = s + 1;
  step = 0;
  beat = 3;
  glitch = 0;
  ignited = false;
  log = [];
  say(`T-3 deploy ${t.key}, freeze merges`);

  if (plan === "rollback") padNow("e");
  else padNow(`c${target}`);
  enter("count");
  if (settings.light_cues) painter.led(NEON.amber);
  play("beep");
}

function toResult(o: Outcome): void {
  outcome = o;
  enter("result");
}

function fail(o: Outcome, line: string): void {
  if (mode !== "count" && mode !== "canary") return;
  record(o);
  say(line);
  glitch = 3;
  if (settings.light_cues) painter.led(NEON.red);
  play("scrub");
  toResult(o);
  pace();
}

function abort(): void {
  if (mode === "count") ignited = plan !== "rollback" && (padWaiting ? heldElapsed : Date.now() - since) >= 2000;

  if (mode === "canary" || ignited) padNow(`x${target}`, idleSection());
  else padNow(idleSection());
  fail("abort", "aborted by operator");
}

let pull = true;
const liftMs = () => (pull ? LIFT_MS : LIFT_MS - PULL_MS);

function liftoff(fromCloseUp: boolean): void {
  if (mode !== "count" && mode !== "canary") return;
  pull = fromCloseUp;
  record("ok");
  say("liftoff: rolling out");
  enter("lift");
  play("liftoff");
}

function syncClock(now: number): void {
  const correction = now - clockAt;
  if (correction < 0) {
    since += correction;
    sectionAt += correction;
    if (saveAt) saveAt += correction;
    dayCheckAt = 0;
  }
  clockAt = now;
}

function tick(): void {
  const now = Date.now();
  syncClock(now);
  if (now >= dayCheckAt || dayCheckAt - now > 60000) {
    day = today();
    dayCheckAt = now + 60000;
  }
  if (saveAt && now >= saveAt) persist();
  if (next && !padWaiting && now - sectionAt >= sectionMs()) padNow(next);
  if (glitch > 0 && !padWaiting) glitch -= 1;
  const e = padWaiting ? heldElapsed : now - since;
  if (mode === "count") {
    ignited = plan !== "rollback" && e >= 2000;
    const b = Math.max(0, Math.min(3, 3 - Math.floor(e / 1000)));
    if (b !== beat && b > 0) {
      beat = b;
      if (settings.light_cues) painter.led(NEON.amber);
      play("beep");
      if (b === 2) say("T-2 unit tests ... OK");
      if (b === 1) {
        say("T-1 ignition");
        ignited = plan !== "rollback";
      }
    }
    if (e >= COUNT_MS) {

      if (plan === "ship") {
        say("e2e tests ... OK");
        padNow(`l${target}`, "s");
        liftoff(true);
      } else if (plan === "flaky") {
        if (beat !== 0) {
          padNow(`k${target}`, idleSection());
          beat = 0;
          say("T-0 e2e tests ...");
        }
        if (e >= COUNT_MS + CUT_MS) {
          fail("flaky", "e2e tests ... FLAKY, scrubbed");
        }
      } else if (plan === "canary") {
        padNow("o2");
        say(`canary ${STEPS[0]}% ... OK`);
        enter("canary");
        play("beep");
      } else {

        if (shipped > 0) record("rb");
        say(shipped > 0 ? `revert to #${shipped}` : "no build yet, nothing to revert");
        padNow("d", "i5");
        enter("land");
        play("rollback");
      }
    }
  } else if (mode === "canary") {
    const s = Math.max(0, Math.floor(e / STEP_MS));
    if (s !== step) {

      const failed = death >= 0 && step < death && s >= death;
      step = failed ? death : Math.min(s, STEPS.length - 1);
      if (failed) {
        padNow(`x${target}`, idleSection());
        fail("dead", `canary ${STEPS[step]}% ... ERRORS, rolled back`);
      } else if (step >= STEPS.length - 1) {
        say("canary 100% ... OK");
        padLater("lp2", "s");
        liftoff(false);
      } else {
        say(`canary ${STEPS[step]}% ... OK`);
        padLater(`h${step + 1}`);
        play("beep");
      }
    }
  } else if (mode === "lift") {
    if (e >= liftMs()) {
      say(`SHIPPED ${T().key} #${shipped}`);
      if (settings.light_cues) painter.led(NEON.green);
      play("shipped");
      toResult("ok");
    }
  } else if (mode === "land") {
    if (e >= LAND_MS) {
      say("ROLLED BACK");
      if (settings.light_cues) painter.led("#5AB4FF");
      play("landed");
      toResult("rb");
    }
  } else if (mode === "result") {
    if (e >= RESULT_MS) toIdle();
  }
  pace();
}

function toIdle(): void {
  padNow(idleSection());
  enter("idle");
}

function skip(): void {
  if (mode === "lift") {
    padNow("s");
    say(`SHIPPED ${T().key} #${shipped}`);
    if (settings.light_cues) painter.led(NEON.green);
    play("shipped");
    toResult("ok");
  } else if (mode === "land") {
    padNow("i5");
    say("ROLLED BACK");
    if (settings.light_cues) painter.led("#5AB4FF");
    play("landed");
    toResult("rb");
  }
}

const X = 22;
const BOLD_Y = capY("bold", 1);
const SMALL_Y = capY("small", 10);
const BIG_Y = capY("extra_large", 3);
const WHITE = c(NEON.white);
const HINT = c("#A8A8A8");
const GREEN = c(NEON.green);
const RED = c(NEON.red);

function lines(): [string, string, string, string] {

  const t = T();
  switch (mode) {
    case "lift":
      return ["Liftoff", WHITE, `alt ${altitude()} km`, HINT];
    case "land":
      return ["Landing", WHITE, "rollback", HINT];
    case "result":
      if (outcome === "ok") return ["Shipped", GREEN, liveStreak() > 1 ? `#${shipped}  day ${liveStreak()}` : `#${shipped}`, WHITE];
      if (outcome === "rb") return ["Restored", c("#5AB4FF"), shipped > 0 ? `back on #${shipped}` : "no build yet", WHITE];
      if (outcome === "flaky") return ["Flaky", c(NEON.amber), "test failed", WHITE];
      if (outcome === "dead") return ["Halted", RED, `canary at ${STEPS[step]}%`, WHITE];
      return ["Aborted", RED, "no harm done", WHITE];
    default:
      return [t.name, c(t.rgb), "Press START", HINT];
  }
}

function altitude(): number {
  const ds = Math.max(0, Math.floor(((padWaiting ? heldElapsed : Date.now() - since) - (pull ? PULL_MS : 0)) / 100));
  return Math.floor((ds * ds) / 4);
}

const SCRAMBLE = "/=+-|:";
function scrambled(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) out += (i + glitch) % 3 === 0 ? SCRAMBLE.charAt((i + glitch * 3) % SCRAMBLE.length) : s.charAt(i);
  return out;
}

const FRONT_IDS = ["big", "l1", "l2", "seg0", "seg1", "seg2", "seg3", "seg4", "tear"];
function hidden(id: string): Element {
  if (id.charAt(0) === "s" || id === "tear") return rect(id, 0, 0, 1, 1, "#000000FF", 0);
  return txt(id, 0, 0, " ", "small", "#000000FF", "top_left", 0);
}

function visible(): Element[] {
  const e = padWaiting ? heldElapsed : Date.now() - since;

  if (mode === "count") return [txt("big", 71, BIG_Y, `T-${e >= COUNT_MS ? 0 : beat}`, "extra_large", WHITE, "top_right")];
  if (((mode === "lift" && pull) || mode === "canary") && e < PULL_MS) return [txt("big", 71, BIG_Y, "T-0", "extra_large", WHITE, "top_right")];
  const out: Element[] = [];
  if (mode === "canary") {
    out.push(txt("l1", X, BOLD_Y, `${STEPS[step]}%`, "bold", WHITE));
    for (let i = 0; i < STEPS.length; i++) out.push(rect(`seg${i}`, X + i * 10, 10, 8, 4, i <= step ? c(NEON.yellow) : c(shade(NEON.yellow, 0.22))));
    return out;
  }
  const [a, ac, b, bc] = lines();
  if (glitch > 0) {

    out.push(txt("l1", X + (glitch % 2), BOLD_Y, scrambled(a), "bold", glitch % 2 ? c(NEON.magenta) : c(NEON.cyan)));
    out.push(rect("tear", 0, 3 + glitch * 3, 72, 1, glitch % 2 ? c(NEON.cyan, "90") : c(NEON.magenta, "90"), 8));
  } else out.push(txt("l1", X, BOLD_Y, a, "bold", ac));
  out.push(txt("l2", X, SMALL_Y, b, "small", bc));
  return out;
}

function front(): Element[] {
  const out = visible();
  const seen: Record<string, true> = {};
  for (let i = 0; i < out.length; i++) seen[out[i].id] = true;
  out.push(rect(`phase${phaseVersion}`, 0, 0, 1, 1, "#000000FF", 0));
  out.push(anim(`pad${padVersion}`, 0, 0, "pad.anim", { section, loop: true, after: queued }, 2));
  for (let i = 0; i < FRONT_IDS.length; i++) if (!seen[FRONT_IDS[i]]) out.push(hidden(FRONT_IDS[i]));
  return out;
}

let panel: Element[] = [];
let panelKey = "";

function backPanel(): Element[] {
  const key = `${mode}|${target}|${beat}|${step}|${log.length}|${log[log.length - 1] || ""}|${shipped}|${day}|${settings.risks}`;
  if (key === panelKey) return panel;
  panelKey = key;
  const t = T();
  const keys = { idle: "WHEEL target OK/START go BACK leave", count: "OK/START/BACK abort", canary: "OK/START/BACK abort", lift: "OK/START skip BACK end", land: "OK/START skip BACK end", result: "OK/START again WHEEL/BACK pad" }[mode];
  if (mode === "idle") {
    let last = "last:";
    for (let i = 0; i < hist.length; i++) {
      const item = ` ${TARGETS[hist[i][0]].key} ${OUT_SHORT[hist[i][1]]}`;
      if (last.length + item.length + 1 > 34) break;
      last += (i ? "," : "") + item;
    }
    if (!hist.length) last += " nothing yet";
    const s = liveStreak();
    panel = terminal({
      title: "SHIP IT!",
      right: "READY",
      lines: [
        `> TARGET ${t.key.toUpperCase()}  ${target + 1}/${TARGETS.length}`,
        settings.risks ? t.risk : "risk: none (risks off in settings)",
        `shipped ${shipped}  streak ${s} day${s === 1 ? "" : "s"}`,
        `best streak ${best}  rollbacks ${rollbacks}`,
        last,
      ],
      keys,
      keysFont: "small",
    });
    return panel;
  }
  const body: string[] = [];
  for (let i = 0; i < log.length; i++) body.push((i === log.length - 1 ? "> " : "  ") + log[i]);
  let big = "";
  let right = t.key.toUpperCase();
  if (mode === "count") big = `T-${beat}`;
  else if (mode === "canary") big = `CANARY ${STEPS[step]}%`;
  else if (mode === "lift") big = "LIFTOFF";
  else if (mode === "land") big = "LANDING";
  else {
    big = OUT_BIG[outcome];
    if (outcome === "ok") right = `#${shipped}  DAY ${liveStreak()}`;
  }
  panel = terminal({ title: "SHIP IT!", right, big, lines: body.slice(-4), keys, keysFont: "small" });
  return panel;
}

function onInput(e: BusyInputEvent): void {
  syncClock(Date.now());
  if (mode === "result" && (padWaiting || Date.now() - since < GUARD_MS) && (e.key === "encoder" || e.key === "ok" || e.key === "start")) return;
  if (e.key === "encoder") {
    if (mode === "result") { toIdle(); return; }
    if (mode !== "idle") return;
    target = (target + (e.delta > 0 ? 1 : TARGETS.length - 1)) % TARGETS.length;
    saveAt = Date.now() + 2000;
    toIdle();
    return;
  }
  if ((e.key !== "ok" && e.key !== "start") || e.action !== "short") return;
  if (mode === "idle") launch();
  else if (mode === "result") {
    if (!padWaiting && Date.now() - since >= GUARD_MS) launch();
  } else if (mode === "count" || mode === "canary") abort();
  else skip();
}

function main(): void {
  restore();
  section = idleSection();
  app = runApp({
    app: APP,
    tickMs: IDLE_MS,
    painter,
    drawOnInput: true,
    tick,
    frame: () => front().concat(backPanel()),
    input: onInput,
    onBack: () => {
      syncClock(Date.now());
      if (mode === "count" || mode === "canary") {
        abort();
        return true;
      }
      if (mode === "lift" || mode === "land") { skip(); return true; }
      if (mode === "result") { toIdle(); return true; }
      return false;
    },
    onExit: persist,
  });
}

readSettings(APP, DEFAULTS).then((s) => {
  settings = s;
  main();
});
