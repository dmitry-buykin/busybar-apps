import { Painter, runApp, bitmap, txt, xpm, deferSound, stopSound, terminal, wrapWidth, textWidth, readSettings, load, save, shade, today, type Element, type AppHandle } from "@shared/painter";
import manifest from "./appmeta/manifest.json";

const APP = manifest.id;

const DEFAULTS = { sound: true, auto: "m5", pace: "normal" };
let settings = DEFAULTS;
const PACE: Record<string, number> = { slow: 1.4, normal: 1, quick: 0.75 };
const AUTO_MIN: Record<string, number> = { off: 0, m5: 5, m15: 15, m60: 60 };

const ANIM_MS = 80;
const IDLE_MS = 1000;
const DECODE_STEPS = 8;
const DECODE_MS = 75;
const FADE_MS = 70;
const GUARD_MS = 1000;
const FADE = [0.15, 0.45, 1];

const NOISE = ["", "", "!:|'", "/()-", "+=<>*^?", "%&@~", "#"];
const GREY = "#A0A0A0FF";

type Card = [string, string, string];

interface Deck {
  name: string;
  title?: string;
  about: string;
  rgb: string;
  hues: string[];
  icon: string[];
  cards: Card[];
}

const LATIN: Card[] = [
  ["Audentes / fortuna iuvat", "Fortune favours / the bold.", "Virgil"],
  ["Per aspera ad astra", "Through hardships / to the stars.", ""],
  ["Festina lente", "Make haste slowly.", "motto of Augustus"],
  ["Faber est suae / quisque fortunae", "Each is the smith / of his own fortune.", "after Appius via ps.-Sallust"],
  ["Aut viam inveniam / aut faciam", "I will find a way / or make one.", "after Seneca, Herc. Fur. 276-7"],
  ["Dum spiro, spero", "While I breathe, / I hope.", ""],
  ["Non scholae sed / vitae discimus", "We learn not for / school but for life.", "Seneca, inverted"],
  ["Ars longa, / vita brevis", "Skill is long, / life is short.", "Hippocrates, via Seneca"],
  ["Memento vivere", "Remember to live.", ""],
  ["Memento mori", "Remember / that you will die.", ""],
  ["Acta non verba", "Deeds, not words.", ""],
  ["Nulla dies sine linea", "No day / without a line.", "after Pliny, of Apelles"],
  ["Gutta cavat lapidem", "Dripping water / hollows the stone.", "Ovid"],
  ["Ex nihilo nihil fit", "Nothing comes / from nothing.", "after Lucretius"],
  ["Mens sana / in corpore sano", "A sound mind / in a sound body.", "Juvenal"],
  ["Sapere aude", "Dare to be wise.", "Horace"],
  ["Labor omnia vincit", "Work conquers all.", "after Virgil"],
  ["Omnia mea / mecum porto", "All that is mine / I carry with me.", "Bias, via Cicero"],
  ["Hic et nunc", "Here and now.", ""],
  ["Nosce te ipsum", "Know thyself.", ""],
  ["Ignis aurum probat", "Fire tests gold.", "Seneca"],
  ["Carpe diem", "Pluck the day.", "Horace"],
  ["Dimidium facti / qui coepit habet", "Well begun / is half done.", "Horace"],
  ["Solvitur ambulando", "It is solved / by walking.", ""],
  ["Verba volant, / scripta manent", "Words fly away, / writing remains.", ""],
  ["Docendo discimus", "By teaching, / we learn.", "after Seneca"],
  ["Repetitio mater / studiorum", "Repetition is the / mother of learning.", ""],
  ["Natura non / facit saltus", "Nature makes / no leaps.", "maxim; attr. Leibniz"],
  ["Nec spe nec metu", "Without hope, / without fear.", ""],
  ["Vincit qui patitur", "He conquers / who endures.", ""],
  ["Bis dat qui cito dat", "He gives twice / who gives quickly.", ""],
  ["Errare humanum est", "To err is human.", ""],
  ["Mutatis mutandis", "The necessary / changes having / been made.", ""],
  ["Quod erat / demonstrandum", "Which was to be / shown: Q.E.D.", ""],
  ["Ad fontes", "To the sources.", ""],
  ["Experientia docet", "Experience teaches.", ""],
  ["Quis custodiet / ipsos custodes?", "Who will guard / the guards?", "Juvenal"],
  ["Tempus fugit", "Time flies.", "after Virgil"],
  ["Alea iacta est", "The die is cast.", "Caesar via Suetonius"],
  ["Ubi concordia, / ibi victoria", "Where there / is unity, / there is victory.", ""],
];
const STOIC: Card[] = [
  ["What stands / in the way / becomes the way.", "", "after Marcus Aurelius 5.20"],
  ["We suffer more / often in imagination / than in reality.", "", "Seneca 13.4, tr. Gummere"],
  ["Stop talking / about what a good / man is. Be one.", "", "after Marcus Aurelius 10.16"],
  ["Men are disturbed / not by things, / but by their / opinions of them.", "", "after Epictetus"],
  ["Take away / your opinion, / and the hurt is gone.", "", "after Marcus Aurelius 4.7"],
  ["First say what / you would be, / then do what you / have to do.", "", "after Epictetus, Discourses 3.23"],
  ["While we postpone, / life speeds by.", "", "after Seneca, Letter 1"],
  ["The best revenge / is not to be like / the wrongdoer.", "", "after Marcus Aurelius 6.6"],
  ["No man is free / who is not master / of himself.", "", "attr. Epictetus; uncertain"],
  ["Nothing is ours / except time.", "", "after Seneca, Letter 1"],
  ["Everywhere / means nowhere.", "", "Seneca 2.2, tr. Gummere"],
  ["Not who has / too little, / but who craves / more, is poor.", "", "after Seneca, Letter 2"],
  ["Cease to hope, / and you will / cease to fear.", "", "Hecato via Seneca 5.7"],
  ["You need / a change of soul, / not of climate.", "", "after Seneca, Letter 28"],
  ["No wind is fair / for one who knows / no harbour.", "", "after Seneca, Letter 71"],
  ["Associate with / those who will make / a better man of you.", "", "after Seneca, Letter 7"],
  ["Some things / are up to us, / and some are not.", "", "after Epictetus"],
  ["No great thing is / produced suddenly, / not even a fig.", "", "after Epictetus"],
  ["To improve, / be content to be / thought foolish.", "", "after Epictetus"],
  ["Habits grow by / their corresponding / actions.", "", "after Epictetus"],
  ["The soul is dyed / by its thoughts.", "", "after Marcus Aurelius 5.16"],
  ["Look within. / Within is the / fountain of good.", "", "after Marcus Aurelius 7.59"],
  ["Not right? Do not / do it. Not true? / Do not say it.", "", "after Marcus Aurelius 12.17"],
  ["Two ears, one / mouth: hear more, / speak less.", "", "after Zeno, via Diogenes Laertius"],
  ["Life is what our / thoughts make it.", "", "after Marcus Aurelius 4.3"],
];
const TRIZ: Card[] = [
  ["1. Segmentation", "Divide it into / independent parts.", "after Altshuller, 40 principles"],
  ["2. Taking out", "Extract the part / that hurts, or the / only part you need.", "after Altshuller, 40 principles"],
  ["3. Local quality", "Each part / in the condition / best for its job.", "after Altshuller, 40 principles"],
  ["4. Asymmetry", "Break the symmetry / to fit the load.", "after Altshuller, 40 principles"],
  ["5. Merging", "Join identical or / parallel operations.", "after Altshuller, 40 principles"],
  ["6. Universality", "One part does / several jobs.", "after Altshuller, 40 principles"],
  ["7. Nested doll", "Put one thing / inside another.", "after Altshuller, 40 principles"],
  ["8. Anti-weight", "Offset weight with / lift or buoyancy.", "after Altshuller, 40 principles"],
  ["9. Prior / counteraction", "Pre-stress against / the harm to come.", "after Altshuller, 40 principles"],
  ["10. Prior action", "Make the change / before it is needed.", "after Altshuller, 40 principles"],
  ["11. Cushion / in advance", "Add a backup where / reliability is low.", "after Altshuller, 40 principles"],
  ["12. Equipotentiality", "Remove the need / to raise or lower.", "after Altshuller, 40 principles"],
  ["13. The other / way round", "Invert it: move / the fixed part, / fix the moving one.", "after Altshuller, 40 principles"],
  ["14. Curvature", "Lines to curves, / linear to rotary.", "after Altshuller, 40 principles"],
  ["15. Dynamics", "Let it adapt / to each condition.", "after Altshuller, 40 principles"],
  ["16. Partial / or excess action", "If 100% is hard, do / a bit more or less.", "after Altshuller, 40 principles"],
  ["17. Another / dimension", "Go to 2D or 3D, / tilt it, use / the other side.", "after Altshuller, 40 principles"],
  ["18. Vibration", "Oscillate it, raise / the frequency, / find resonance.", "after Altshuller, 40 principles"],
  ["19. Periodic action", "Pulse instead / of constant; / use the pauses.", "after Altshuller, 40 principles"],
  ["20. Continuous / action", "No idle parts, / no idle time.", "after Altshuller, 40 principles"],
  ["21. Rushing through", "Pass through the / harmful stage fast.", "after Altshuller, 40 principles"],
  ["22. Harm / into benefit", "Use the harm, / or let one harm / cancel another.", "after Altshuller, 40 principles"],
  ["23. Feedback", "Close the loop; / tune it if it is / already there.", "after Altshuller, 40 principles"],
  ["24. Intermediary", "Use a go-between, / then take it away.", "after Altshuller, 40 principles"],
  ["25. Self-service", "Let it serve / and repair itself; / use waste.", "after Altshuller, 40 principles"],
  ["26. Copying", "Use a cheap copy / or a model instead.", "after Altshuller, 40 principles"],
  ["27. Cheap / short-lived", "Many cheap / disposables beat / one costly part.", "after Altshuller, 40 principles"],
  ["28. Replace / mechanics", "Use fields: / light, sound, / magnetism, heat.", "after Altshuller, 40 principles"],
  ["29. Pneumatics, / hydraulics", "Replace solid parts / with gas or liquid.", "after Altshuller, 40 principles"],
  ["30. Flexible / shells, films", "Isolate with a / flexible membrane.", "after Altshuller, 40 principles"],
  ["31. Porous materials", "Add pores, then / fill them with / something useful.", "after Altshuller, 40 principles"],
  ["32. Colour changes", "Change colour / or transparency / to see better.", "after Altshuller, 40 principles"],
  ["33. Homogeneity", "Make what / touches of the / same material.", "after Altshuller, 40 principles"],
  ["34. Discard / and recover", "Discard what is / spent, restore / while running.", "after Altshuller, 40 principles"],
  ["35. Parameter / changes", "Change state, / density, flexibility, / temperature.", "after Altshuller, 40 principles"],
  ["36. Phase / transitions", "Use what / happens at the / phase change.", "after Altshuller, 40 principles"],
  ["37. Thermal / expansion", "Use expansion, or / different rates of it.", "after Altshuller, 40 principles"],
  ["38. Strong oxidants", "Enrich the medium: / air to oxygen.", "after Altshuller, 40 principles"],
  ["39. Inert / atmosphere", "Replace the medium / with an inert one.", "after Altshuller, 40 principles"],
  ["40. Composites", "Go from uniform / to composite.", "after Altshuller, 40 principles"],
];
const BUILDER: Card[] = [
  ["Ship small, / ship often", "Small diffs, / small fears.", ""],
  ["Make it work, / make it right, / make it fast.", "", "attr. Kent Beck"],
  ["The best code is the / code you deleted.", "", ""],
  ["Talk to users", "Before you write / the first line.", ""],
  ["Measure twice, / cut once", "The old / carpenter's rule.", ""],
  ["Done beats perfect", "When perfect / never ships.", ""],
  ["Automate / the third time", "Not the first.", ""],
  ["One change / at a time", "So you know / what fixed it.", ""],
  ["Build the boring / part first", "The exciting / part will wait.", ""],
  ["Prototype / in cardboard", "Before you / machine aluminium.", ""],
  ["Read the error / message", "All of it, slowly.", ""],
  ["Leave / the bench tidy", "Tomorrow you / is a colleague.", ""],
  ["Name things well", "Half of design / is naming.", ""],
  ["Fix the jig, / not the part", "Tooling / repays itself.", ""],
  ["Write it down", "Memory is / a leaky cache.", ""],
  ["Test the / unhappy path", "Users will / find it first.", ""],
  ["Delete before / you add", "Less to break, / less to learn.", ""],
  ["Finish / what you start", "A shelf of 90% / is worth zero.", ""],
  ["Cut scope, / not quality", "A smaller thing, / done well.", ""],
  ["Log the decision", "And the why, / for future you.", ""],
  ["Sharpen the tools", "Dull tools waste / whole days.", ""],
  ["Find what / breaks first", "Then make / that part cheap.", ""],
  ["Keep a way back", "Every change / needs an undo.", ""],
  ["Demo every week", "Progress you / can touch.", ""],
  ["Rest is part / of the work", "Tired hands / make scrap.", ""],
  ["Constraints / are a gift", "They narrow / the search.", ""],
  ["Ugly and / working wins", "Pretty can / come later.", ""],
  ["Copy, then improve", "Borrow the shape, / earn the rest.", ""],
];
const LAWS: Card[] = [
  ["Gall's law", "Complex systems / that work grew / from simple ones / that worked.", "after John Gall"],
  ["Conway's law", "Systems mirror / the organisation / that builds them.", "after Melvin Conway"],
  ["Goodhart's law", "A measure made / a target stops / measuring.", "after Strathern (Goodhart)"],
  ["Hofstadter's law", "It takes longer, even / counting this law.", "after Douglas Hofstadter"],
  ["Brooks's law", "Adding people / to a late project / makes it later.", "after Fred Brooks"],
  ["Parkinson's law", "Work expands to fill / the time it is given.", "after C. N. Parkinson"],
  ["Murphy's law", "What can go wrong / will. Design for it.", ""],
  ["Postel's law", "Be strict in what / you send, lenient / in what you accept.", "after Jon Postel"],
  ["Hyrum's law", "Every observable / behaviour becomes / a dependency.", "after Hyrum Wright"],
  ["Kernighan's law", "Debugging is twice / as hard as writing. / Write simply.", "after Brian Kernighan"],
  ["Amdahl's law", "The serial part / caps the speedup.", "after Gene Amdahl"],
  ["Linus's law", "With many eyes, / bugs are shallow.", "after Eric Raymond"],
  ["Pareto principle", "Most effects come / from a few causes.", "after Vilfredo Pareto"],
  ["Occam's razor", "Do not multiply / entities / beyond need.", "after William of Ockham"],
  ["Chesterton's fence", "Know why it is / there before / you remove it.", "after G. K. Chesterton"],
  ["Sturgeon's law", "Ninety percent of / everything is crud.", "after Theodore Sturgeon"],
  ["Wirth's law", "Software / slows faster / than hardware / speeds up.", "after Niklaus Wirth"],
  ["Little's law", "Queue length / = arrival rate / x wait time.", "after John Little"],
  ["Lindy effect", "The longer / it has lasted, / the longer it will.", ""],
  ["Peter principle", "People rise / to their level / of incompetence.", "after Laurence Peter"],
  ["Knuth's warning", "Premature / optimisation is the / root of much evil.", "after Donald Knuth"],
  ["Hanlon's razor", "Do not assume / malice where / mistake will do.", ""],
  ["Ninety-ninety rule", "The last 10% / takes the other / 90% of the time.", "after Tom Cargill"],
  ["Leaky abstractions", "Every non-trivial / abstraction leaks.", "after Joel Spolsky"],
  ["Brandolini's law", "Refuting nonsense / costs more / than making it.", "after Alberto Brandolini"],
  ["Tesler's law", "Complexity is / conserved: someone / must carry it.", "after Larry Tesler"],
  ["Kerckhoffs's / principle", "A system must stay / safe when all but / the key is known.", "after Auguste Kerckhoffs"],
  ["Le Chatelier", "Push a system / and it pushes back.", "after Le Chatelier's principle"],
  ["Campbell's law", "The more a number / decides, the more / it is gamed.", "after Donald Campbell"],
  ["Law of Demeter", "Talk only to your / immediate friends.", ""],
];
const QUESTIONS: Card[] = [
  ["What am I avoiding?", "Name it, then / start there.", ""],
  ["What is the smallest / next step?", "One you could take / in ten minutes.", ""],
  ["Is this up to me?", "If not, let it go.", ""],
  ["What does done / look like?", "Say it in one / sentence.", ""],
  ["What can I remove?", "Before adding / anything.", ""],
  ["Who is this for?", "And what do they / need from it?", ""],
  ["Will this matter / in a year?", "Spend effort / to match.", ""],
  ["What did I / learn today?", "Write one line.", ""],
  ["What is the real / constraint?", "Everything else / is waiting on it.", ""],
  ["What is the / contradiction?", "Name both sides, / then resolve it.", ""],
  ["What is the / ideal result?", "It works, / and costs nothing.", ""],
  ["What am I / assuming?", "Which assumption / is cheapest to test?", ""],
  ["Where is / the feedback?", "How soon will I / know I was wrong?", ""],
  ["What is good / enough?", "Decide before / you start.", ""],
  ["What can I / ship today?", "Even if it is small.", ""],
  ["What am I / grateful for?", "One thing, / specifically.", ""],
  ["Busy, or moving / forward?", "Check the last hour.", ""],
  ["What would / a Stoic do?", "Act well, / accept the rest.", ""],
  ["What does / waiting cost?", "Decisions have / a price too.", ""],
  ["What is the / worst case?", "Could I bear it? / Then begin.", ""],
  ["What would I / tell a friend?", "Now tell yourself.", ""],
  ["What resource / is unused?", "Time, waste, / a free field nearby.", ""],
];

const APPLIED: Card[] = [
  ["Evals / before prompts", "Collect real cases / before you tune / a single word.", ""],
  ["Real cases decide", "Test what users / actually ask, / not what you / imagine.", ""],
  ["Replay / before release", "Old and new, / the same cases, / writes off. / Diff the behaviour.", ""],
  ["Keep a control set", "Some answers / must not move. / Check they did not.", ""],
  ["Test the test", "Break it on purpose. / A check that / never failed / proves nothing.", ""],
  ["Set the bar first", "Write what would / sink the idea / before you see / the results.", ""],
  ["Weigh the evidence", "Replays beat / dashboards; / dashboards / beat hunches.", ""],
  ["Means hide / regressions", "Compare case / by case: fixed, / broken, unchanged.", ""],
  ["No trace, no fix", "Every run keeps / a record of / what it saw / and why it acted.", ""],
  ["Name the failure", "Wrong route, wrong / tool, missing rule: / each has / its own fix.", ""],
  ["Patterns, not cases", "One odd case / is a note. / A repeat is a fix.", ""],
  ["Generalise the fix", "Special cases / pass today, / break tomorrow.", ""],
  ["Check / the neighbours", "A failure in one / flow often hides / in similar ones.", ""],
  ["Show less", "Every field in view / invites an action. / Give only what / the step needs.", ""],
  ["Naming is priming", "Mention a tool, / even to forbid it, / and it becomes / an option.", ""],
  ["One source of truth", "Two copies / of a rule drift / apart, silently.", ""],
  ["Code the facts", "Let code fetch / and compute; / leave the model / just the choice.", ""],
  ["Fail closed", "If no rule fits, / stop and pass it / to a person.", ""],
  ["Gates / beat warnings", "A check in code / cannot be skipped. / A line in a prompt / can.", ""],
  ["Explore loose, / ship bounded", "Freedom to learn, / narrow tools / in production.", ""],
  ["Gate every write", "Reads are cheap. / Writes need / an allowlist / and a yes.", ""],
  ["Writes run once", "A retry must not / repeat the effect. / Then read it back.", ""],
  ["Break the loop", "Cap steps / and retries. / Stuck means stop / and report.", ""],
  ["The author is / not the judge", "A fresh checker, / shown only / the result, / grades the work.", ""],
  ["Count the tail", "Long batches / lose their last / items quietly.", ""],
  ["No lost branches", "After a rewrite, / each rule exists, / exactly once.", ""],
  ["Write it down first", "No agent can / run a process / nobody wrote down.", ""],
  ["Notes outlive / sessions", "Keep the history / and the current / state in files.", ""],
  ["Prune with evidence", "What no real case / reaches can go, / tests and all.", ""],
  ["Ratchet it down", "Pick a count / of the mess / and never let / it rise.", ""],
  ["Checking is / the bottleneck", "Code got cheap. / Spend what you / saved on checking.", ""],
  ["Models change, / loops stay", "Your evals, tools / and rules are / the lasting part.", ""],
];
const ICON_LAUREL = ["..h.....h..",".xx.....hh.","x.xh...hx.h",".x.......x.","xxx.....xhh",".x.......x.","dxd.....xxx",".dd.....xd.","..dd...dd..","....d.d....","...d...d..."];
const ICON_COLUMN = ["hhhhhhhhhhh",".xxxxxxxxh.","..x.x.x.h..","..x.x.x.h..","..x.x.x.h..","..x.x.x.h..","..d.x.x.x..","..d.x.x.x..",".dxxxxxxxx.","ddddddddddd","..........."];
const ICON_GEAR = ["....xhh....","..x.xhh.h..",".xxxxxhhhh.","..xxx.hhh..","xxxx...hhhh","xxx.....hhh","dddd...xxxx","..ddd.xxx..",".ddddddxxx.","..d.ddx.x..","....ddx...."];
const ICON_HAMMER = ["...........",".....xxxhh.","xxxxxxxxxhh",".d...dxxxxh","d....dxx...",".....dx....",".....dx....",".....dx....",".....dx....","....ddx....","....ddd...."];
const ICON_SCALES = [".....h.....",".xhhhxhhhh.",".x...x...h.","x.x..x..x.h","x.x..x..x.h","ddd..x..xxx",".....x.....",".....x.....","...dxxxx...","...........","..........."];
const ICON_QUESTION = ["...xxhh....","..xx..hh...","..dd..xh...","......xh...",".....xx....","....xx.....","....dx.....","...........","....dx.....","...........","..........."];
const ICON_ROBOT = [".....h.....",".....x.....","..xxxxxhh..",".xxxxxxxxh.",".x..xx..xh.",".x..xx..xh.",".xxxxxxxxh.",".xx.d.d.xx.",".dxxxxxxxd.","..ddddddd..","..........."];
const DECKS: Deck[] = [
  { name: "Latin", about: "Phrases, and what they mean.", rgb: "#E8C060", hues: ["#E8C060", "#FF9A3C", "#FFE08A", "#F0A848", "#FFD040"], icon: ICON_LAUREL, cards: LATIN },
  { name: "Stoic", about: "Seneca, Epictetus, Marcus Aurelius.", rgb: "#C8D0E0", hues: ["#C8D0E0", "#8AB4FF", "#E0E8FF", "#A8B4E0", "#7CD0E8"], icon: ICON_COLUMN, cards: STOIC },
  { name: "TRIZ", about: "The 40 inventive principles.", rgb: "#7CFF7C", hues: ["#7CFF7C", "#3CE0A0", "#C8FF5A", "#5AD8C8", "#A0FF3C"], icon: ICON_GEAR, cards: TRIZ },
  { name: "Builder", about: "Maxims for people who make things.", rgb: "#FF8A1F", hues: ["#FF8A1F", "#FF6A4C", "#FFC03C", "#FF8C8C", "#F0A050"], icon: ICON_HAMMER, cards: BUILDER },
  { name: "Laws", about: "Laws of systems and software.", rgb: "#5AB4FF", hues: ["#5AB4FF", "#8C9CFF", "#5AE0FF", "#A890FF", "#4CA8F0"], icon: ICON_SCALES, cards: LAWS },
  { name: "Questions", about: "Questions for a pause.", rgb: "#E07CFF", hues: ["#E07CFF", "#FF7CC8", "#B88CFF", "#FF9AE8", "#C870FF"], icon: ICON_QUESTION, cards: QUESTIONS },
  { name: "Applied AI", title: "MY NOTES ON APPLIED AI", about: "Building and running AI agents.", rgb: "#00F0FF", hues: ["#00F0FF", "#3CFFD0", "#80F0FF", "#00D8E8", "#A0FFE8"], icon: ICON_ROBOT, cards: APPLIED },
];

const hexAt = (rgb: string, i: number) => parseInt(rgb.substring(i, i + 2), 16);
function mix(rgb: string, to: number, k: number): string {
  let out = "#";
  for (let i = 1; i < 7; i += 2) {
    const v = hexAt(rgb, i);
    const m = (v + (to - v) * k) | 0;
    out += (m < 16 ? "0" : "") + m.toString(16).toUpperCase();
  }
  return out;
}

let iconCache = "";
let iconFor = -1;

function iconXpm(d: number): string {
  if (iconFor !== d) {
    const rgb = DECKS[d].rgb;
    iconCache = xpm(DECKS[d].icon, `. c none\nh c ${mix(rgb, 255, 0.55)}\nx c ${rgb}\nd c ${mix(rgb, 0, 0.4)}`);
    iconFor = d;
  }
  return iconCache;
}
const BLANK = xpm(["."], ". c none");

interface Line {
  s: string;
  x: number;
  note: boolean;
}
interface Page {
  a: Line;
  b: Line | null;
  hold: number;
}

function linesOf(text: string, note: boolean): Line[] {
  if (!text) return [];
  return text.split(" / ").map((s) => ({ s, x: (72 - (textWidth(s) - 1)) >> 1, note }));
}

function layout(card: Card): Page[] {
  const t = linesOf(card[0], false);
  const n = linesOf(card[1], true);
  const groups = t.length === 1 && n.length === 1 ? [t.concat(n)] : [t, n];
  const pages: Page[] = [];
  for (const g of groups)
    for (let i = 0; i < g.length; i += 2) {
      const b = i + 1 < g.length ? g[i + 1] : null;
      pages.push({ a: g[i], b, hold: 1300 + 70 * (g[i].s.length + (b ? b.s.length : 0)) });
    }
  return pages;
}

type Phase = "show" | "decode" | "out" | "in";

const painter = new Painter(APP, { hold: true });
let app: AppHandle | null = null;

let deck = 0;
let cardOf: number[] = DECKS.map(() => 0);
let day = "";
let inCard = false;
let pages: Page[] = [];
let page = 0;
let phase: Phase = "show";
let step = 0;
let at = 0;
let chime = false;
let landAt = 0;
let titleLevels: string[] = [];
let noteLevels: string[] = [];
let nextAuto = 0;
let dayCheckAt = 0;

let autoDay = "";

const D = () => DECKS[deck];
const pace = () => PACE[settings.pace] || 1;
const card = () => D().cards[cardOf[deck]];

let clickAt = 0;
let clockAt = Date.now();
let tickTimer = 0;

function play(name: string): void {
  if (!settings.sound) return;
  const now = Date.now();
  if (name.indexOf("tick") === 0) {
    if (now - clickAt < 200) {

      if (!tickTimer) tickTimer = setTimeout(() => {
        tickTimer = 0;
        play(`tick${deck}`);
      }, 200 - (now - clickAt));
      return;
    }
    clickAt = now;
  }
  deferSound(APP, name);
}

function dayNumber(): number {
  const d = new Date();
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}
const dayCard = (i: number, n: number) => {
  const count = DECKS[i].cards.length;
  return ((n * 37 + i * 11) % count + count) % count;
};

function newDay(): void {
  day = today();
  const n = dayNumber();
  for (let i = 0; i < DECKS.length; i++) cardOf[i] = dayCard(i, n);
}

function setCard(decode: boolean, withChime: boolean): void {
  const c = card();
  const hue = D().hues[cardOf[deck] % D().hues.length];
  titleLevels = FADE.map((k) => shade(hue, k) + "FF");
  const note = shade(mix(hue, 255, 0.5), 0.82);
  noteLevels = FADE.map((k) => shade(note, k) + "FF");
  pages = layout(c);
  page = 0;
  chime = withChime;
  if (decode) {
    phase = "decode";
    step = 1;
    at = Date.now() + DECODE_MS;
  } else showPage(Date.now());
}

function showPage(now: number): void {
  phase = "show";
  step = 0;
  const first = page === 0;
  const last = page === pages.length - 1;
  at = pages.length === 1 ? 0 : now + (pages[page].hold + (first ? 600 : 0) + (last ? 1000 : 0)) * pace();
}

function draw(withChime: boolean): void {
  if (tickTimer) clearTimeout(tickTimer);
  tickTimer = 0;
  const n = D().cards.length;
  const offset = n > 1 ? 1 + ((Math.random() * (n - 1)) | 0) : 0;
  cardOf[deck] = (cardOf[deck] + offset) % n;
  setCard(true, withChime);
  armAuto();
}

function armAuto(): void {
  const m = AUTO_MIN[settings.auto] || 0;
  nextAuto = m ? Date.now() + m * 60000 : 0;
}

function advance(now: number): void {
  if (inCard) return;
  for (let guard = 0; guard < 8 && at && now >= at; guard++) {
    if (phase === "decode") {
      if (step < DECODE_STEPS) {
        step += 1;
        at += DECODE_MS;
      } else {
        landAt = now;
        if (chime) play("chime");
        showPage(now);
      }
    } else if (phase === "show") {
      phase = "out";
      step = 2;
      at = now + FADE_MS;
    } else if (phase === "out") {
      if (step > 0) {
        step -= 1;
        at += FADE_MS;
      } else {
        page = (page + 1) % pages.length;
        phase = "in";
        step = 0;
        at = now + FADE_MS;
      }
    } else if (step < 2) {
      step += 1;
      at += FADE_MS;
    } else showPage(now);
  }
}

function wake(): void {
  if (!app) return;
  const now = Date.now();
  if (!inCard && phase !== "show") {
    app.setTick(ANIM_MS);
    return;
  }
  let due = dayCheckAt;
  if (!inCard && at) due = Math.min(due, at);
  if (!inCard && nextAuto) due = Math.min(due, nextAuto);
  const ms = due - now;
  app.setTick(ms <= ANIM_MS ? ANIM_MS : ms >= IDLE_MS ? IDLE_MS : (((ms + 49) / 50) | 0) * 50);
}

function syncClock(now: number): void {
  const correction = now - clockAt;
  if (correction < 0) {
    if (at) at += correction;
    if (landAt) landAt += correction;
    if (nextAuto) nextAuto += correction;
    dayCheckAt = 0;
    clickAt += correction;
    if (tickTimer) clearTimeout(tickTimer);
    tickTimer = 0;
  }
  clockAt = now;
}

function tick(): void {
  const now = Date.now();
  syncClock(now);
  if (now >= dayCheckAt) {
    dayCheckAt = now + 60000;
    if (today() !== day) {

      newDay();
      if (!inCard) setCard(true, false);
      armAuto();
      persist();
    }
  }
  if (nextAuto && now >= nextAuto && !inCard && phase !== "decode" && now - landAt >= GUARD_MS) {
    draw(false);
    if (autoDay !== day) {
      autoDay = day;
      persist();
    }
  }
  advance(now);
  wake();
}

function decoded(s: string, k: number): string {
  const solved = ((s.length * k) / DECODE_STEPS) | 0;
  let out = s.substring(0, solved);
  for (let i = solved; i < s.length; i++) {
    const ch = s.charAt(i);
    const set = NOISE[textWidth(ch)] || "";
    out += ch === " " || !set ? ch : set.charAt((i * 5 + k * 3) % set.length);
  }
  return out;
}

const HIDDEN_ICON = bitmap("icon", 0, 0, BLANK, 0);
const HIDDEN_L2 = txt("l2", 0, 0, ".", "small", "#000000FF", "top_left", 0);

function lineEl(id: string, l: Line, y: number, level: number, k: number): Element {
  const s = k > 0 ? decoded(l.s, k) : l.s;
  return txt(id, l.x, y, s, "small", (l.note ? noteLevels : titleLevels)[level]);
}

function front(): Element[] {
  const d = D();
  if (inCard) {

    const font = 14 + textWidth(d.name, "bold") - 1 <= 68 ? "bold" : "normal";
    const nameW = textWidth(d.name, font) - 1;
    const count = `${d.cards.length} cards`;
    const w = 11 + 3 + Math.max(nameW, textWidth(count) - 1);
    const x = (72 - w) >> 1;
    return [bitmap("icon", x, 2, iconXpm(deck), 3), txt("l1", x + 14, -1, d.name, font, d.rgb + "FF"), txt("l2", x + 14, 8, count, "small", GREY)];
  }
  const p = pages[page];
  const level = phase === "out" || phase === "in" ? step : 2;
  const k = phase === "decode" ? step : 0;
  const out: Element[] = [HIDDEN_ICON];
  if (!p.b) {
    out.push(lineEl("l1", p.a, 3, level, k), HIDDEN_L2);
  } else {
    out.push(lineEl("l1", p.a, 0, level, k), lineEl("l2", p.b, 7, level, k));
  }
  return out;
}

const KEYS = "OK/START draw WHEEL/BACK list";
const DECK_KEYS = "WHEEL deck OK/START draw BACK leave";
let backKey = "";
let backEls: Element[] = [];

function backPanel(): Element[] {
  const key = `${inCard ? 1 : 0}|${deck}|${cardOf[deck]}|${day}|${page}`;
  if (key === backKey) return backEls;
  backKey = key;
  const d = D();
  if (inCard) {
    backEls = terminal({ title: d.title || "ORACLE", right: `DECK ${deck + 1}/${DECKS.length}`, big: d.name.toUpperCase(), lines: [`> ${d.about}`, `${d.cards.length} cards, one of them for today`], keys: DECK_KEYS, keysFont: "small" });
    return backEls;
  }
  const c = card();
  const title = wrapWidth(c[0].split(" / ").join(" "), 144 - textWidth("> ")).map((l, i) => (i ? "   " : "> ") + l);
  const lines = title.concat(c[1] ? wrapWidth(c[1].split(" / ").join(" ")) : []);
  if (c[2]) lines.push(...wrapWidth(`- ${c[2]}`, 144));
  const count = Math.ceil(lines.length / 6);
  const backPage = Math.min(count - 1, Math.floor(page * count / pages.length));
  const n = dayNumber();
  backEls = terminal({
    title: d.name.toUpperCase(),
    right: count > 1 ? `${backPage + 1}/${count}` : cardOf[deck] === dayCard(deck, n) ? "TODAY" : `${cardOf[deck] + 1}/${d.cards.length}`,
    lines: lines.slice(backPage * 6, (backPage + 1) * 6),
    bright: Math.max(0, title.length - backPage * 6),
    keys: KEYS,
    keysFont: "small",
  });
  return backEls;
}

function frame(): Element[] {
  return front().concat(backPanel());
}

function persist(): void {
  save("oracle", { v: 2, day, deck, card: cardOf, auto: autoDay });
}

function input(e: BusyInputEvent): void {
  const now = Date.now();
  syncClock(now);
  if (!inCard && (phase === "decode" || (landAt && now - landAt < GUARD_MS)) &&
      (e.key === "encoder" || e.key === "ok" || e.key === "start")) return;
  if (e.key === "encoder") {
    stopSound(APP);
    if (inCard) deck = (deck + (e.delta > 0 ? 1 : DECKS.length - 1)) % DECKS.length;
    inCard = true;
    play(`tick${deck}`);
  } else if ((e.key === "ok" || e.key === "start") && e.action === "short") {
    if (today() !== day) {

      newDay();
      dayCheckAt = now + 60000;
    }
    inCard = false;
    draw(true);
    play("shuffle");
    persist();
  }
  wake();
}

function restore(): void {
  const s = load<{ day?: unknown; deck?: unknown; card?: unknown; auto?: unknown }>("oracle", {});
  deck = typeof s.deck === "number" && s.deck >= 0 && s.deck < DECKS.length ? s.deck | 0 : 0;
  if (s.day !== today() || !(s.card instanceof Array)) {
    newDay();
    return;
  }
  day = s.day as string;
  autoDay = s.auto === day ? day : "";
  const cards = s.card as unknown[];
  for (let i = 0; i < DECKS.length; i++) {
    const v = cards[i];
    cardOf[i] = typeof v === "number" && v >= 0 && v < DECKS[i].cards.length ? v | 0 : dayCard(i, dayNumber());
  }
}

function main(): void {
  restore();
  setCard(false, false);
  dayCheckAt = Date.now() + 60000;
  armAuto();
  const onExit = (): void => {
    if (tickTimer) clearTimeout(tickTimer);
    tickTimer = 0;
    persist();
  };
  app = runApp({ app: APP, tickMs: IDLE_MS, painter, drawOnInput: true, frame, tick, input, onExit, onBack: () => {
    if (inCard) return false;
    inCard = true;
    stopSound(APP);
    wake();
    return true;
  } });
  wake();
}

readSettings(APP, DEFAULTS).then((s) => {
  settings = s;
  main();
});
