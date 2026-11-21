import type { DisplayElements } from "@busy-app/busy-lib";

export type Element = DisplayElements["elements"][number];
export type Font = "tiny" | "small" | "normal" | "condensed" | "bold" | "large" | "extra_large" | "global" | "superscript";
export type Align = "top_left" | "top_mid" | "top_right" | "mid_left" | "center" | "mid_right" | "bottom_left" | "bottom_mid" | "bottom_right";

export const BW = 148;

export function shade(rgb: string, k: number): string {
  let out = "#";
  for (let i = 1; i < 7; i += 2) {
    const v = Math.round(parseInt(rgb.substring(i, i + 2), 16) * clamp(k, 0, 1));
    out += (v < 16 ? "0" : "") + v.toString(16).toUpperCase();
  }
  return out;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const FONTS: Record<Font, { line: number; top: number; cap: number; digit: number; adv: string }> = {
  tiny: { line: 6, top: 1, cap: 4, digit: 4, adv: "32464552334424254444444444224444444444444445465545444566465353443444443342242644443444464444245" },
  small: { line: 9, top: 2, cap: 5, digit: 5, adv: "22464552334423234344444444234444555555555245465555554546444333444444443442342644443434464444245" },
  normal: { line: 11, top: 2, cap: 7, digit: 7, adv: "53466872334634456666666666234646866666666456586666666668666353655555555554454655554555666554346" },
  condensed: { line: 11, top: 2, cap: 7, digit: 7, adv: "53466872334634455555555555234646866666666456586666666668666353655555555554454655554555666554346" },
  bold: { line: 11, top: 2, cap: 7, digit: 7, adv: "54489982444734467777777777235757:777766775676:877777778;777464755666666665565866665666787665456" },
  large: { line: 13, top: 2, cap: 9, digit: 9, adv: "63498:92446634467577777777235656:877877884777:887877888:8873636666666656644648666656566:6664248" },
  extra_large: { line: 14, top: 2, cap: 10, digit: 10, adv: "436:9;:3557734368588888888335757<88887788578798888887899887464855888877885787988888878998876368" },
  superscript: { line: 11, top: 2, cap: 7, digit: 5, adv: "53466872334634454444444444234646866666666456586666666668666353655555555554454655554555666554346" },
  global: { line: 11, top: 1, cap: 7, digit: 7, adv: "32476662334625256466566566224545766665566256586656566668656353453655554552352855555545465554246" },
};

/** Measures text width. */
export function textWidth(text: string, font: Font = "small"): number {
  const adv = FONTS[font].adv;
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i) - 32;
    w += (k >= 0 && k < 95 ? adv.charCodeAt(k) : 52) - 48;
  }
  return w;
}

// Elements

export function txt(id: string, x: number, y: number, text: string, font: Font = "small", color = "#FFFFFFFF", align: Align = "top_left", z = 5): Element {
  return { id, type: "text", x, y, align, text, font, color, z_index: z };
}

export function rect(id: string, x: number, y: number, width: number, height: number, color: string, z = 1, radius = 0): Element {
  return {
    id,
    type: "rectangle",
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    radius,
    fill: "solid",
    fill_colors: [color],
    border_width: 0,
    z_index: z,
  };
}

export function anim(id: string, x: number, y: number, file: string, o: { section?: string; loop?: boolean; after?: boolean } = {}, z = 3): Element {
  return {
    id,
    type: "animation",
    x: Math.round(x),
    y: Math.round(y),
    path: `animations/${file}`,
    section: o.section ?? "default",
    loop: !!o.loop,
    await_previous_end: !!o.after,
    z_index: z,
  };
}

/** Moves an element to the back screen. */
export function back(e: Element): Element {
  (e as { display?: string }).display = "back";
  return e;
}

export function grey(level: number): string {
  const h = clamp(Math.round(level), 0, 15).toString(16).toUpperCase();
  return `#${h}${h}${h}${h}${h}${h}FF`;
}

export function btxt(id: string, x: number, y: number, text: string, font: Font = "small", level = 15, align: Align = "top_left", z = 5): Element {
  return back(txt(id, x, y, text, font, grey(level), align, z));
}

export function brect(id: string, x: number, y: number, width: number, height: number, level = 15, z = 1): Element {
  return back(rect(id, x, y, width, height, grey(level), z));
}

/** Wraps text at word boundaries. */

/** Wraps text at word boundaries. */
export function wrapWidth(text: string, px = BW - 4, font: Font = "small"): string[] {
  const out: string[] = [];
  const space = textWidth(" ", font);
  let line = "";
  let w = 0;
  for (const word of text.split(" ")) {
    if (!word) continue;
    const ww = textWidth(word, font);
    if (line && w + space + ww - 1 > px) {
      out.push(line);
      line = word;
      w = ww;
    } else {
      w = line ? w + space + ww : ww;
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) out.push(line);
  return out;
}

export function terminal(o: { title: string; right?: string; lines?: string[]; bright?: number; keys?: string; big?: string; keysFont?: Font }): Element[] {

  const hide = (id: string) => btxt(id, 0, 0, ".", "tiny", 0, "top_left", 0);
  const out: Element[] = [brect("b_bar", 0, 0, BW, 10, 15, 1), back(txt("b_title", 3, 1, o.title, "small", "#000000FF", "top_left", 6))];
  out.push(o.right ? back(txt("b_right", BW - 3, 1, o.right, "small", "#000000FF", "top_right", 6)) : hide("b_right"));
  let y = 14;
  if (o.big) {
    out.push(btxt("b_big", BW / 2, y, o.big, "bold", 15, "top_mid"));
    y += 16;
  } else out.push(hide("b_big"));
  const lines = o.lines ?? [];
  for (let i = 0; i < 6; i++, y += 9) {
    const line = i < lines.length && y <= 60 ? lines[i] : "";
    out.push(line ? btxt(`b_l${i}`, 2, y, line, "small", line.charAt(0) === ">" || i < (o.bright ?? 0) ? 15 : 9) : hide(`b_l${i}`));
  }
  out.push(brect("b_rule", 0, 69, BW, 1, o.keys ? 5 : 0, 1));
  const kf = o.keysFont ?? "tiny";
  out.push(o.keys ? btxt("b_keys", 2, kf === "tiny" ? 72 : 70, o.keys, kf, kf === "tiny" ? 9 : 10) : hide("b_keys"));
  return out;
}

export function load<T extends object>(key: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const value = JSON.parse(raw) as unknown;
      if (value && typeof value === "object" && !Array.isArray(value)) return Object.assign({}, defaults, value as Partial<T>);
    }
  } catch {

  }
  return Object.assign({}, defaults);
}

let storageWarned = false;
export function save(key: string, value: object): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {

    if (!storageWarned) console.error(`storage: save ${key}: ${String(err)}`);
    storageWarned = true;
    return false;
  }
}

/** Returns the local calendar date. */

export function reporter(app: string) {
  return (err: unknown) => console.error(`${app}: ${err instanceof Error ? err.message : String(err)}`);
}

const API = (__BUSY_ADDR__.indexOf("://") > 0 ? "" : "http://") + __BUSY_ADDR__ + "/api/";

function call(method: string, path: string, body?: object | string): Promise<Response> {
  return fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : body ? JSON.stringify(body) : undefined,
  }).then((res) => {
    if (res.ok) return res;
    return res.text().then(
      (t) => {
        throw new Error(`HTTP ${res.status} ${t}`);
      },
      () => {
        throw new Error(`HTTP ${res.status}`);
      },
    );
  });
}

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

let netBusy = false;

let controlStamp = Date.now();
let controlTime = controlStamp;
function controlNow(): number {
  const now = Date.now();
  controlTime += Math.max(0, now - controlStamp);
  controlStamp = now;
  return controlTime;
}

let screenLost = false;

let lastSoundAt = 0;
const HEARTBEAT_MS = 2000;
export type SoundOptions = { priority?: number; maxDelayMs?: number };

type SoundJob = { run: () => void; until: number; priority: number; stop?: SoundJob };
let queuedSound: SoundJob | null = null;
let frameBeforeSound = false;
let closedApp = "";
let deferredSound: ReturnType<typeof setTimeout> | null = null;
let deferredPriority = -1;

function queueSound(job: SoundJob): void {
  expireQueuedSound();

  if (!queuedSound || queuedSound.priority === 100 || job.priority >= queuedSound.priority) {
    const owed = queuedSound ? (queuedSound.priority === 100 ? queuedSound : queuedSound.stop) : undefined;
    if (owed && job.priority !== 100) job.stop = owed;
    queuedSound = job;
  }
}

function dropQueuedSound(): void {
  queuedSound = null;
  frameBeforeSound = false;
}

function expireQueuedSound(): void {
  if (!queuedSound || queuedSound.until >= controlNow()) return;
  const owed = queuedSound.stop;
  dropQueuedSound();
  if (owed) queuedSound = owed;
}

function runQueuedSound(): void {
  const q = queuedSound;
  queuedSound = null;
  frameBeforeSound = false;
  if (!q) return;
  q.run();
  if (!netBusy && q.stop) q.stop.run();
}
let pendingClear: string | null = null;
let heldPainter: Painter | null = null;
function netDone(): void {
  netBusy = false;

  if (pendingClear) {
    const app = pendingClear;
    pendingClear = null;
    netBusy = true;
    call("DELETE", "display/draw", { application_name: app })
      .catch((err: unknown) => console.error(`${app}: clear: ${errText(err)}`))
      .then(netDone);
    return;
  }
  expireQueuedSound();
  if (queuedSound && (queuedSound.priority === 100 || frameBeforeSound || !heldPainter)) {
    runQueuedSound();
    if (netBusy) return;
  }
  if (heldPainter) {
    const p = heldPainter;
    heldPainter = null;
    frameBeforeSound = !!queuedSound;
    p.flush();
    if (netBusy) return;
  }
  if (queuedSound) runQueuedSound();
}

export class Painter {
  private last: Record<string, string> = {};
  private busy = false;
  private retryAt = 0;
  private lastError = "";
  private beatAt = 0;
  private beat = false;
  private readonly report: (err: unknown) => void;
  private readonly app: string;
  private ledColor = "";
  private kinds: Record<string, string> = {};
  private wipe = false;
  private readonly hold: boolean;
  private held: Element[] | null = null;
  private generation = 0;
  private readonly onAccepted?: (elements: Element[], at: number) => void;
  private readonly onInvalidated?: () => void;

  led(rgb: string): void {
    this.ledColor = rgb + "FF";
  }

  constructor(app: string, opts: { hold?: boolean; onAccepted?: (elements: Element[], at: number) => void; onInvalidated?: () => void } = {}) {
    this.app = app;
    this.report = reporter(app);
    this.hold = !!opts.hold;
    this.onAccepted = opts.onAccepted;
    this.onInvalidated = opts.onInvalidated;
  }

  snapshot(): Element[] {
    return Object.keys(this.last).map((id) => JSON.parse(this.last[id]) as Element);
  }

  hasElement(id: string): boolean { return !!this.last[id]; }

  draw(elements: Element[]): void {
    if (this.app === closedApp) return;
    const now = controlNow();
    if (this.busy || netBusy) {
      if (this.hold) {

        this.held = elements.map(e => e.type === "rectangle" && e.fill_colors
          ? { ...e, fill_colors: e.fill_colors.slice() }
          : { ...e });
        heldPainter = this;
      }
      return;
    }
    this.held = null;
    if (this.retryAt && now < this.retryAt) return;

    if ((screenLost || now - lastSoundAt < 5000) && now - this.beatAt >= HEARTBEAT_MS) {
      this.beatAt = now;
      this.beat = !this.beat;
      elements = elements.concat([rect("_hb", 0, 0, 1, 1, this.beat ? "#00000000" : "#00000001", 0)]);
    } else if (this.last["_hb"]) elements = elements.concat([JSON.parse(this.last["_hb"]) as Element]);
    const changed: Element[] = [];
    const seen: Record<string, true> = {};

    const retyped: string[] = [];
    for (const e of elements) {
      seen[e.id] = true;
      if (this.kinds[e.id] && this.kinds[e.id] !== e.type) retyped.push(e.id);
      this.kinds[e.id] = e.type;
      const key = JSON.stringify(e);
      if (this.last[e.id] !== key) {
        changed.push(e);
        this.last[e.id] = key;
      }
    }
    const gone = Object.keys(this.last).filter((id) => !seen[id]);
    for (const id of gone) {
      delete this.last[id];
      delete this.kinds[id];
    }
    const vanished = gone.slice();
    const led = this.ledColor;
    if (led && !changed.length && elements.length) changed.push(elements[0]);

    if (!changed.length && !gone.length) return;
    const wipe = this.wipe;
    this.wipe = false;
    this.ledColor = "";

    const self = this;
    const app = this.app;
    const generation = this.generation;
    let drawBody = "";
    if (changed.length) {
      const req: DisplayElements = { application_name: app, priority: 50, elements: changed };
      if (led) req.led_notification_color = led;
      drawBody = JSON.stringify(req);
    }
    self.busy = true;
    netBusy = true;
    let stage = "clear";
    const work = async (): Promise<void> => {

      if (wipe) await call("DELETE", "display/draw", { application_name: app }).catch(() => undefined);
      else if (retyped.length) await call("DELETE", "display/draw", { application_name: app, element_ids: retyped }).catch(() => undefined);
      stage = "draw";
      if (drawBody) await call("POST", "display/draw", drawBody);
      stage = "clear";
      if (!wipe && vanished.length) await call("DELETE", "display/draw", { application_name: app, element_ids: vanished });

      if (generation === self.generation && app !== closedApp && self.onAccepted) {
        try { self.onAccepted(self.snapshot(), Date.now()); } catch (err) { self.report(`accepted callback: ${errText(err)}`); }
      }
    };
    work()
      .catch((err) => {

        const msg = `${stage} (${stage === "clear" ? gone.join(",") : changed.length + " elements"}): ${errText(err)}`;
        if (msg.indexOf("HTTP 409") >= 0) {
          screenLost = true;
          cancelSoundRequests();
        }
        if (msg !== self.lastError) self.report(msg);
        self.lastError = msg;
        self.last = {};
        if (generation === self.generation) self.invalidate();

        self.held = null;
        if (heldPainter === self) heldPainter = null;
        self.wipe = true;
        self.retryAt = controlNow() + 1000;
      })
      .then(() => {
        self.busy = false;
        if (!self.wipe) {
          self.lastError = "";
          self.retryAt = 0;
          screenLost = false;
        }
        netDone();
      });
  }

  flush(): void {
    const h = this.held;
    this.held = null;
    if (h) this.draw(h);
  }

  clear(): void {
    this.invalidate();
    this.last = {};
    this.held = null;
    this.ledColor = "";
    if (heldPainter === this) heldPainter = null;
    if (netBusy) {
      pendingClear = this.app;
      return;
    }
    const app = this.app;
    netBusy = true;
    call("DELETE", "display/draw", { application_name: app })
      .catch(this.report)
      .then(netDone);
  }

  private invalidate(): void {
    this.generation++;
    if (this.onInvalidated) {
      try { this.onInvalidated(); } catch (err) { this.report(`invalidated callback: ${errText(err)}`); }
    }
  }
}

export function listenTaps(app: string, handler: (e: BusyInputEvent) => void): BusyUnbind {
  const state: Record<string, { tapped: boolean; long: boolean; timer?: ReturnType<typeof setTimeout> }> = {};
  let active = true;
  const unbind = listen("input", (e) => {
    if (!active) return;
    console.log(`${app}: input ${e.key} ${e.action}`);
    if (e.key === "encoder") { handler(e); return; }
    const k = e.key;
    if (e.action === "press") {
      const previous = state[k];
      if (previous?.timer !== undefined) {
        clearTimeout(previous.timer);
        previous.timer = undefined;

        if (!previous.tapped && !previous.long) {
          previous.tapped = true;
          handler({ key: k, action: "short" });
          if (!active) return;
        }
      }
      state[k] = { tapped: false, long: false };
    } else if (e.action === "short") {
      const v = state[k];
      if (v && (v.tapped || v.long)) return;

      if (v) { v.tapped = true; if (v.timer !== undefined) clearTimeout(v.timer); v.timer = undefined; }
    } else if (e.action === "long" || e.action === "repeat") {
      const v = state[k];
      if (v) { v.long = true; if (v.timer !== undefined) clearTimeout(v.timer); v.timer = undefined; }
    } else if (e.action === "release") {
      const v = state[k];
      if (v && !v.tapped && !v.long && v.timer === undefined) {
        v.timer = setTimeout(() => {
          v.timer = undefined;
          if (!active || v.tapped || v.long) return;
          v.tapped = true;
          handler({ key: k, action: "short" });
        }, 150);
      }
    }
    handler(e);
  });
  return () => {
    active = false;
    for (const k of Object.keys(state)) if (state[k].timer !== undefined) clearTimeout(state[k].timer);
    unbind();
  };
}

export type AppHandle = (() => void) & { setTick: (ms: number) => void; restartTick: () => void };

export function runApp(opts: {
  app: string;
  tickMs: number;
  painter: Painter;
  tick: () => void;
  frame: () => Element[];
  input: (e: BusyInputEvent) => void;
  onBack?: () => boolean;
  onExit?: () => void;
  drawOnInput?: boolean;
}): AppHandle {
  closedApp = "";
  let stopped = false;

  const guard = (stage: string, fn: () => void): void => {
    try {
      fn();
    } catch (err) {
      console.error(`${opts.app}: ${stage}: ${errText(err)}`);
    }
  };
  const loop = (): void => {
    if (stopped) return;
    guard("tick", opts.tick);
    if (!stopped) guard("frame", () => opts.painter.draw(opts.frame()));
  };
  guard("frame", () => opts.painter.draw(opts.frame()));
  let tickMs = opts.tickMs;
  let timer = setInterval(loop, tickMs);
  const quit = (): void => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    closedApp = opts.app;
    guard("exit", () => opts.onExit?.());
    guard("stop sound", () => stopSound(opts.app));
    guard("clear", () => opts.painter.clear());
    setTimeout(unbind, 0);
  };
  const unbind = listenTaps(opts.app, (e) => {
    if (stopped) return;
    if (e.key === "back" && e.action === "short") {
      let consumed = false;
      guard("back", () => { consumed = !!opts.onBack?.(); });
      if (consumed) {
        if (opts.drawOnInput && !stopped) guard("frame", () => opts.painter.draw(opts.frame()));
        return;
      }
      quit();
      return;
    }
    guard(`input ${e.key}`, () => opts.input(e));
    if (opts.drawOnInput && !stopped) guard("frame", () => opts.painter.draw(opts.frame()));
  });
  const handle = quit as AppHandle;
  handle.setTick = (ms: number): void => {
    if (stopped || ms === tickMs) return;
    tickMs = ms;
    clearInterval(timer);
    timer = setInterval(loop, tickMs);
  };
  handle.restartTick = (): void => {
    if (stopped) return;
    clearInterval(timer);
    timer = setInterval(loop, tickMs);
  };
  return handle;
}

// Sound

function play(app: string, name: string, stock: boolean, opts: SoundOptions = {}, until = controlNow() + (opts.maxDelayMs ?? 1200)): void {
  const now = controlNow();
  if (app === closedApp || screenLost || now > until) return;
  lastSoundAt = now;
  if (netBusy) {
    queueSound({ run: () => play(app, name, stock, opts, until), until, priority: Math.max(0, Math.min(99, opts.priority ?? 1)) });
    return;
  }
  netBusy = true;
  call("POST", "audio/play", stock ? { application_name: app, stock_path: `shared/${name}` } : { application_name: app, path: `sounds/${name}.snd` })
    .catch((err: unknown) => console.error(`${app}: sound ${name}: ${errText(err)}`))
    .then(netDone);
}

/** Queues a cue after the next frame. */
export function deferSound(app: string, name: string, opts: SoundOptions = {}): void {
  if (app === closedApp || screenLost) return;
  const priority = opts.priority ?? 1;
  if (deferredSound !== null && priority < deferredPriority) return;
  if (deferredSound !== null) clearTimeout(deferredSound);
  deferredPriority = priority;
  const until = controlNow() + (opts.maxDelayMs ?? 1200);
  deferredSound = setTimeout(() => {
    deferredSound = null;
    deferredPriority = -1;
    play(app, name, false, opts, until);
  }, 0);
}

/** Stops playback and clears pending cues. */
export function stopSound(app: string): void {
  cancelSoundRequests();
  sendStop(app);
}

function cancelSoundRequests(): void {

  if (deferredSound !== null) clearTimeout(deferredSound);
  deferredSound = null;
  deferredPriority = -1;
  dropQueuedSound();
}

function sendStop(app: string): void {
  if (screenLost) return;
  if (netBusy) {
    queueSound({ run: () => sendStop(app), until: Infinity, priority: 100 });
    return;
  }
  netBusy = true;
  call("DELETE", "audio/play")
    .catch((err: unknown) => {
      const t = errText(err);
      if (t.indexOf("410") < 0) console.error(`${app}: stop sound: ${t}`);
    })
    .then(netDone);
}

export async function readSettings<T extends object>(app: string, defaults: T, version = 1, invalidValues?: Partial<T>): Promise<T> {
  const out = Object.assign({}, defaults);
  if (netBusy) return out;
  netBusy = true;
  try {
    const res = await call("GET", `apps/settings?app_id=${app}`);
    const doc = (await res.json()) as { version?: number; values?: Record<string, unknown> };
    if (doc.version !== version) console.error(`${app}: settings version ${String(doc.version)}, expected ${version}: using defaults`);
    else if (doc.values) {
      const d = defaults as Record<string, unknown>;
      const o = out as Record<string, unknown>;
      for (const k of Object.keys(d)) {
        const value = doc.values[k];
        if (typeof value === typeof d[k] && (typeof value !== "number" || isFinite(value))) {
          o[k] = value;
        } else if (invalidValues && Object.prototype.hasOwnProperty.call(doc.values, k) && Object.prototype.hasOwnProperty.call(invalidValues, k)) {
          o[k] = invalidValues[k as keyof T];
        }
      }
    }
  } catch (err) {
    console.error(`${app}: settings: ${errText(err)}: using defaults`);
  }
  netDone();
  return out;
}
