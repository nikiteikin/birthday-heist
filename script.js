"use strict";

/* ================= EDIT ME: personalization ================= */
const CONFIG = {
  name: "YANA",
  age: "29",
  message: "Your talents are known. Your coffee habit is noted.",
  note: "Your treasure has been stolen by the greedy King Gabe of the Kingdom of Steam!\nHead to his kingdom and steal it back, Phantom Thief!"
};

/* ================= Story text ================= */
const INTRO = ["We've been waiting for you.", "Do you remember why you're here?"];
const OATH = [
  "You have finally *arrived*.\nAnother year stands behind you.\n\nA year of *victories*.\nOf *failures*.\nOf choices you wish you could change.\nAnd moments you would never trade for anything.\n\nYet despite everything...\nyou are still *moving forward*.",
  "So *answer* me.\nWhen the world demands more from you...\nWhen another year brings new challenges...\n\nWill you continue to follow your own *path*?\nWill you embrace every victory?\nEvery mistake?\nEvery moment yet to come?\n\nWill you claim this *new year* as your own?"
];
const VOW = [
  "Then let this be your *vow*.\nDo not fear the years behind you.\nDo not fear the years ahead.\n\nYour story is not *ending*.\nA new chapter is about to *begin*.\n\nTake hold of your *future*.\nMake it yours.\nAnd never forget\u2014\ntoday belongs to *you*."
];
const BRIEF = [
  "Hey! Over here!",
  "The treasure is hidden deep in this maze, and it's protected.",
  "Collect every card to break the seal. Don't get lost!"
];

/* What Morgana says when the gift is opened and the note appears */
const MORGANA_FINAL = "Those despicable thieves have stolen our gift! I mean\u2014YOUR gift! Yeah, that\u2019s what I meant! Your gift!";

/* ================= Helpers & state ================= */
const $ = id => document.getElementById(id);
const wait = ms => new Promise(r => setTimeout(r, ms));
const GameState = { scene: "start", cards: 0, done: false };

function pulse(el, cls, ms) {
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}
const flash = () => pulse($("flash"), "on", 400);
const shake = () => pulse(document.body, "shake", 550);
const later = (id, ms) => { $(id).classList.add("hidden"); setTimeout(() => $(id).classList.remove("hidden"), ms); };

function confetti(n) {
  for (let i = 0; i < n; i++) {
    const c = document.createElement("span");
    c.className = "cf";
    c.style.cssText = `left:${Math.random() * 100}vw;background:${i % 3 ? "#e5171f" : "#fff"};` +
      `animation-duration:${2 + Math.random() * 2}s;animation-delay:${Math.random() * .5}s`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 5000);
  }
}

/* ================= SceneManager ================= */
function showScene(id) {
  document.querySelectorAll(".scene").forEach(s => s.classList.toggle("active", s.id === id));
  GameState.scene = id;
  document.body.dataset.scene = id;
}

/* ================= AudioManager =================
   Tries audio/<path>.mp3 first. If the file is missing or blocked, it falls back to a
   small synthesized beep, so the site works with zero audio files. */
/* Each sound is looked up as audio/<path>.mp3, then .wav, .ogg and .m4a. The first one that works is remembered. */
/* ================= Sounds =================
   Every sound is one file, listed here. Change a path (or its extension) to use your own file.
   Files are downloaded once and played through the Web Audio API: near-zero latency, sounds can
   overlap, and it behaves the same on desktop and on iPhone. If a file is missing, a synthesized
   beep plays instead (set SYNTH_FALLBACK to false to turn that off). */
const SOUND_FILES = {
  click: "audio/ui/click.wav", hover: "audio/ui/hover.wav", confirm: "audio/ui/confirm.wav", back: "audio/ui/back.wav", tick: "audio/ui/tick.wav",
  move: "audio/game/move.wav", wall: "audio/game/wall.wav", collect: "audio/game/collect.wav", unlock: "audio/game/unlock.wav",
  caught: "audio/game/caught.wav", win: "audio/game/win.wav",
  card: "audio/scenes/calling-card.wav", shot: "audio/scenes/shot.wav", awaken: "audio/scenes/explosion.wav", victory: "audio/scenes/victory.wav"
};
const SOUND_VOLUME = { hover: .5, tick: .4, move: .7 };   /* optional per-sound volume, 1 = full */
const MASTER_VOLUME = .8;
const SYNTH_FALLBACK = true;

const AudioManager = {
  ctx: null, master: null, raw: {}, dec: {}, buf: {}, els: {}, miss: {}, uiReal: false, lastFile: 0,
  useEl: location.protocol === "file:",   /* fetch() is blocked on file://, so plain <audio> is used when the page is opened from disk */
  /* [frequency, seconds, waveform, volume] played one after another */
  synth: {
    hover: [[880, .03]], click: [[520, .05, "square"]], confirm: [[523, .08], [784, .14]],
    tick: [[1400, .015, "square", .03]], back: [[330, .08]],
    move: [[300, .04, "triangle"]], wall: [[110, .12, "sawtooth"]],
    caught: [[220, .15, "sawtooth", .12], [165, .15, "sawtooth", .12], [110, .45, "sawtooth", .12]],
    collect: [[660, .07], [990, .12]], unlock: [[440, .1], [660, .1], [880, .25]],
    awaken: [[70, 1.1, "sawtooth", .2], [140, .8, "square", .1]],
    card: [[196, .15, "square"], [392, .35, "square"]], intro: [[110, .6, "sine", .1]],
    win: [[523, .12], [659, .12], [784, .12], [1047, .5]], victory: [[392, .15], [523, .15], [659, .15], [784, .5]]
  },
  /* Start downloading every sound right away. Nothing is played yet. */
  preload() {
    if (this.useEl) return;
    Object.entries(SOUND_FILES).forEach(([name, url]) => {
      this.raw[name] = fetch(url).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); }).catch(() => { this.miss[name] = true; return null; });
    });
  },
  /* Called on the first tap or click (browsers only allow audio after that): starts the engine and decodes the files. */
  unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
        this.master = this.ctx.createGain(); this.master.gain.value = MASTER_VOLUME; this.master.connect(this.ctx.destination);
        if (navigator.audioSession) navigator.audioSession.type = "playback";   /* iPhone: play even with the silent switch on, where supported */
      }
      this.ctx.resume();
    } catch (e) {}
    if (!this.useEl && this.ctx) Object.keys(SOUND_FILES).forEach(n => this.decode(n));
  },
  decode(name) {
    if (this.dec[name]) return this.dec[name];
    return this.dec[name] = (this.raw[name] || Promise.resolve(null))
      .then(ab => ab && new Promise(res => this.ctx.decodeAudioData(ab.slice(0), res, () => res(null))))
      .then(b => {
        if (b) { this.buf[name] = b; if (SOUND_FILES[name].includes("/ui/")) this.uiReal = true; } else this.miss[name] = true;
        return b;
      });
  },
  play(name) {
    if (this.ctx && this.ctx.state !== "running") this.ctx.resume();
    if (this.useEl) return this.playEl(name);
    if (!SOUND_FILES[name] || this.miss[name]) return this.beep(name);
    const b = this.buf[name];
    if (b) return this.playBuf(name, b);
    if (!this.ctx) return;   /* nothing can play before the first tap */
    this.decode(name).then(b => b ? this.playBuf(name, b) : this.beep(name));
  },
  playBuf(name, b) {
    this.lastFile = Date.now();
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
    s.buffer = b; g.gain.value = SOUND_VOLUME[name] ?? 1;
    s.connect(g); g.connect(this.master); s.start(0);
  },
  /* Fallback for pages opened straight from disk (file://) */
  playEl(name) {
    const url = SOUND_FILES[name];
    if (!url || this.miss[name]) return this.beep(name);
    const a = this.els[name] || (this.els[name] = new Audio(url));
    a.currentTime = 0;
    const p = a.play();
    if (p) p.then(() => { this.lastFile = Date.now(); if (url.includes("/ui/")) this.uiReal = true; }).catch(err => {
      if (err && (err.name === "NotAllowedError" || err.name === "AbortError")) return;
      this.miss[name] = true; this.beep(name);
    });
  },
  /* Explosion: a long noise sweep through a falling low-pass plus a deep thump */
  boom(c) {
    const t = c.currentTime, len = Math.floor(c.sampleRate * 1.4);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = buf; f.type = "lowpass"; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(120, t + 1.2); g.gain.value = .7;
    n.connect(f).connect(g).connect(c.destination); n.start(t);
    const o = c.createOscillator(), og = c.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(30, t + .6);
    og.gain.setValueAtTime(.8, t); og.gain.exponentialRampToValueAtTime(.001, t + .7);
    o.connect(og).connect(c.destination); o.start(t); o.stop(t + .8);
  },
  /* Gunshot-style hit: a short noise crack plus a falling thump (the Persona 5 results-screen feel) */
  gun(c) {
    const t = c.currentTime, len = Math.floor(c.sampleRate * .18);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = buf; f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = .7; g.gain.value = .5;
    n.connect(f).connect(g).connect(c.destination); n.start(t);
    const o = c.createOscillator(), og = c.createGain();
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(45, t + .15);
    og.gain.setValueAtTime(.5, t); og.gain.exponentialRampToValueAtTime(.001, t + .18);
    o.connect(og).connect(c.destination); o.start(t); o.stop(t + .2);
  },
  beep(name) {
    if (!SYNTH_FALLBACK || name === "hover") return;   /* hover blips only play from a real file */
    /* once a real UI sound exists (for example click.wav) there are no synthesized UI beeps or typing ticks on top of it */
    if (this.uiReal && (name === "tick" || (SOUND_FILES[name] || "").includes("/ui/"))) return;
    /* never layer a synthesized sound on a real one that has just started */
    if (Date.now() - this.lastFile < 250) return;
    const c = this.ctx; if (!c) return;
    if (name === "shot") return this.gun(c);
    if (name === "awaken") return this.boom(c);
    let t = c.currentTime;
    (this.synth[name] || []).forEach(([f, d, type = "sine", v = .08]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + d);
      t += d * .8;
    });
  }
};

AudioManager.preload();

/* Dialogue markup: *word* is drawn in red (Persona-style keyword highlight). */
function mark(line) {
  let plain = "", marks = [], start = 0, red = false;
  for (const ch of line) {
    if (ch === "*") { if (red) marks.push([start, plain.length]); else start = plain.length; red = !red; }
    else plain += ch;
  }
  return { plain, marks };
}
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function paint(el, { plain, marks }, n) {
  let out = "", pos = 0;
  for (const [a, b] of marks) {
    if (a >= n) break;
    const end = Math.min(b, n);
    out += esc(plain.slice(pos, a)) + '<span class="hl">' + esc(plain.slice(a, end)) + "</span>";
    pos = end;
  }
  el.innerHTML = out + esc(plain.slice(pos, n));
}

/* ================= DialogueManager =================
   Dialogue.play(lines, boxElement, {speed, end}) -> Promise
   Click the box or button: finishes the current line, then moves to the next.
   end:true resolves as soon as the last line is fully typed (Continue is hidden). */
const Dialogue = {
  play(lines, box, { speed = 28, end = false } = {}) {
    const txt = box.querySelector(".txt"), btn = box.querySelector(".next");
    btn.classList.remove("hidden");
    const P = lines.map(mark);
    return new Promise(done => {
      let i = 0, n = 0, typing = false, timer;
      const finish = () => {
        clearInterval(timer); typing = false; paint(txt, P[i], Infinity); btn.textContent = "Continue";
        if (end && i === lines.length - 1) { btn.classList.add("hidden"); box.onclick = null; done(); }
      };
      const type = () => {
        n = 0; typing = true; txt.textContent = ""; btn.textContent = "Skip";
        timer = setInterval(() => {
          paint(txt, P[i], ++n);
          if (n % 4 === 0) AudioManager.play("tick");
          if (n >= P[i].plain.length) finish();
        }, speed);
      };
      const next = () => {
        if (typing) return finish();
        if (++i < lines.length) type(); else { box.onclick = null; done(); }
      };
      box.onclick = next;
      btn.onclick = e => { e.stopPropagation(); next(); };
      type();
    });
  }
};

/* ================= Background music =================
   Put your track at audio/music/poem.mp3. It starts when the envelope is opened, loops, and fades out when the card is clicked.
   If the file is missing nothing plays. The round button in the corner mutes it. */
const Music = {
  el: null, muted: false, vol: .5, stopped: false,
  /* The track is loaded as soon as the page opens, so it can start instantly on the first click. */
  init() {
    const exts = ["mp3", "m4a", "ogg", "wav"]; let k = 0;
    this.el = new Audio(`audio/music/poem.${exts[0]}`);
    this.el.loop = true; this.el.preload = "auto"; this.el.volume = 0;
    const probe = new Audio(); probe.volume = .5; this.canVol = probe.volume === .5;   /* false on iPhone Safari */
    this.el.addEventListener("error", () => {
      if (++k < exts.length) { this.el.src = `audio/music/poem.${exts[k]}`; if (this.wanted && !this.stopped) this.el.play().catch(() => {}); }
      else console.warn("Music file not found: audio/music/poem.(mp3|m4a|ogg|wav)");
    });
  },
  /* Called when the envelope is clicked. */
  start() {
    $("mute").hidden = false;
    if (this.stopped) return;
    this.el.muted = this.muted; this.wanted = true;
    const p = this.el.play();
    if (p) p.then(() => { if (!this.stopped) this.fade(this.vol); }).catch(() => {});
  },
  fade(to) {
    if (!this.canVol) return;
    clearInterval(this.fi);
    this.fi = setInterval(() => {
      const d = to - this.el.volume;
      if (Math.abs(d) < .02) { this.el.volume = to; clearInterval(this.fi); }
      else this.el.volume = Math.max(0, Math.min(1, this.el.volume + Math.sign(d) * .02));
    }, 80);
  },
  /* Called when the card is clicked and flips. The music never starts again after this. */
  stop() {
    this.stopped = true; $("mute").hidden = true;
    clearInterval(this.fi);
    if (!this.canVol) { this.el.pause(); return; }
    const el = this.el;
    this.fi = setInterval(() => {
      if (el.volume > .05) el.volume = Math.max(0, el.volume - .05);
      else { clearInterval(this.fi); el.pause(); }
    }, 60);
  },
  toggle() { this.muted = !this.muted; if (this.el) this.el.muted = this.muted; return this.muted; }
};
$("mute").onclick = () => $("mute").classList.toggle("off", Music.toggle());
Music.init();

/* ================= MorganaManager ================= */
const Morgana = {
  timer: 0,
  show() { $("morgana").classList.add("in"); },
  hide() { $("morgana").classList.remove("in"); $("bubble").classList.remove("on"); },
  say(text, ms = 3500) {
    this.show();
    $("bubble").textContent = text; $("bubble").classList.add("on");
    clearTimeout(this.timer);
    if (ms) this.timer = setTimeout(() => $("bubble").classList.remove("on"), ms);
  }
};
const morganaSay = (t, ms) => Morgana.say(t, ms);

/* ================= MazeGame =================
   0 empty, 1 wall, 2 player start, 3 card, 4 locked treasure, 5 unlocked treasure,
   6 unused. The villain is not a tile, it patrols PATROL below.
   Fixed layout, every card and the treasure are reachable from the start. */
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1],
  [1,2,0,0,1,3,0,0,0,0,1],
  [1,0,1,0,1,0,1,1,1,0,1],
  [1,0,1,0,0,0,0,0,1,0,1],
  [1,0,1,1,1,1,1,0,1,0,1],
  [1,0,0,0,0,3,1,0,0,0,1],
  [1,1,1,1,0,1,1,1,1,0,1],
  [1,3,0,0,0,0,0,0,0,4,1],
  [1,1,1,1,1,1,1,1,1,1,1]
];

/* The villain walks back and forth along this path (right corridor, then bottom corridor), one cell per step. */
const PATROL = [[9,1],[9,2],[9,3],[9,4],[9,5],[9,6],[9,7],[8,7],[7,7],[6,7],[5,7],[4,7],[3,7],[2,7],[1,7]];

/* Random 4x3 block of binary digits for a wall cell */
const bits = () => Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => Math.random() < .5 ? "0" : "1").join("")).join("\n");

const Maze = {
  on: false, lastHint: 0,
  start() {
    const g = $("grid"); g.innerHTML = "";
    this.cells = MAP.flat().map(() => g.appendChild(document.createElement("div")));
    /* Walls show flickering binary code, like the Matrix */
    this.walls = [];
    MAP.flat().forEach((t, i) => {
      if (t !== 1) return;
      const c = this.cells[i];
      c.textContent = bits(); c.style.setProperty("--a", (.4 + Math.random() * .6).toFixed(2));
      this.walls.push(c);
    });
    clearInterval(this.rain);
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.rain = setInterval(() => {
        for (let k = 0; k < 6; k++) this.walls[Math.random() * this.walls.length | 0].textContent = bits();
      }, 110);
    }
    this.foeEl = g.appendChild(document.createElement("div"));
    this.foeEl.className = "villain";
    const ico = new Image(); ico.alt = ""; ico.src = "assets/enemy/icon.png";
    ico.onerror = () => { ico.remove(); this.foeEl.textContent = "\uD83D\uDC79"; };   /* emoji if the icon file is missing */
    this.foeEl.appendChild(ico);
    this.reset();
    Morgana.say("Hey! The treasure is protected!", 4000);
  },
  reset() {
    this.map = MAP.map(r => [...r]);
    this.cards = 0; GameState.cards = 0;
    this.need = this.map.flat().filter(t => t === 3).length;
    this.map.forEach((r, y) => r.forEach((t, x) => { if (t === 2) { this.pos = { x, y }; r[x] = 0; } }));
    this.foe = { i: 3, dir: 1, alive: true };
    this.foeEl.style.display = ""; this.placeFoe();
    clearInterval(this.patrol); this.patrol = setInterval(() => this.patrolStep(), 650);
    this.on = true; this.render(); this.idle();
  },
  render() {
    const W = this.map[0].length;
    const open = (x, y) => (this.map[y]?.[x] ?? 1) !== 1;
    this.map.forEach((r, y) => r.forEach((t, x) => {
      const c = this.cells[y * W + x];
      let cls = (this.pos.x === x && this.pos.y === y) ? "p" : ["", "w", "", "c", "t", "t", "e"][t];
      /* L/R/U/D = open neighbour in that direction; CSS draws the dotted guide line from them */
      if (t !== 1) cls += (open(x - 1, y) ? " L" : "") + (open(x + 1, y) ? " R" : "") + (open(x, y - 1) ? " U" : "") + (open(x, y + 1) ? " D" : "");
      c.className = cls;
      if (t !== 1) c.textContent = t === 4 ? "\uD83D\uDD12" : t === 5 ? "\uD83C\uDF81" : t === 6 ? "\uD83D\uDC79" : "";
    }));
    $("cnt").textContent = `${this.cards} / ${this.need}`;
    $("tre").textContent = this.cards < this.need ? "LOCKED" : "UNLOCKED";
  },
  move(dx, dy) {
    if (!this.on) return;
    const x = this.pos.x + dx, y = this.pos.y + dy, t = this.map[y]?.[x];
    this.idle();
    if (t === undefined || t === 1) return this.bump("That's a wall!");
    if (t === 4) return this.bump("Sealed! Collect every card first.");
    if (t === 6) return this.caught();
    if (this.foeAt(x, y)) return this.encounter();
    this.pos = { x, y };
    AudioManager.play("move");
    if (t === 3) { this.map[y][x] = 0; this.cards++; GameState.cards = this.cards; this.collected(); }
    if (t === 5) return this.win();
    this.render();
  },
  bump(msg) {
    AudioManager.play("wall"); pulse($("grid"), "bump", 200);
    if (Date.now() - this.lastHint > 3500) { Morgana.say(msg, 2200); this.lastHint = Date.now(); }
  },
  placeFoe() {
    const [x, y] = PATROL[this.foe.i];
    this.foeEl.style.left = x * 100 / MAP[0].length + "%"; this.foeEl.style.top = y * 100 / MAP.length + "%";
  },
  foeAt(x, y) { const f = this.foe; return !!f && f.alive && PATROL[f.i][0] === x && PATROL[f.i][1] === y; },
  patrolStep() {
    const f = this.foe;
    if (!this.on || !f.alive) return;
    f.i += f.dir;
    if (f.i < 0 || f.i >= PATROL.length) { f.dir = -f.dir; f.i += 2 * f.dir; }
    this.placeFoe();
    if (this.foeAt(this.pos.x, this.pos.y)) this.encounter();
  },
  /* Touching the villain starts a turn-based fight. Win: it is gone. Lose: the maze restarts. */
  async encounter() {
    if (!this.on) return;
    this.on = false; clearTimeout(this.it);
    AudioManager.play("caught"); flash(); shake(); Morgana.hide();
    await wait(800);
    showScene("battle");
    const won = await Battle.run();
    showScene("maze");
    if (won) {
      this.foe.alive = false; this.foeEl.style.display = "none";
      this.on = true; this.render(); this.idle();
      Morgana.say("We did it! Now grab the rest!", 3500);
    } else {
      Morgana.say("Ugh... let's try again!", 2600);
      await wait(1000);
      this.reset();
    }
  },
  async caught() {
    this.on = false; clearTimeout(this.it);
    AudioManager.play("caught"); flash(); shake();
    Morgana.say("A Shadow got you! Back to the start!", 2600);
    await wait(900);
    this.reset();
  },
  collected() {
    AudioManager.play("collect"); pulse($("cnt"), "pop", 350);
    if (this.cards >= this.need) {
      this.map.forEach(r => r.forEach((t, x) => { if (t === 4) r[x] = 5; }));
      setTimeout(() => AudioManager.play("unlock"), 250);
      Morgana.say("That's it! The path to the treasure is clear!", 4000);
    } else {
      Morgana.say(this.cards === 1 ? "You're doing great! Don't slow down now!" : "One more push!", 2800);
    }
  },
  idle() {
    clearTimeout(this.it);
    this.it = setTimeout(() => {
      if (this.on) { Morgana.say("Hey! The treasure isn't going to find itself!", 3500); this.idle(); }
    }, 12000);
  },
  async win() {
    this.on = false; clearTimeout(this.it); GameState.done = true; clearInterval(this.rain); clearInterval(this.patrol);
    this.render();
    AudioManager.play("win"); flash(); shake(); confetti(90);
    await wait(1300);
    Morgana.hide();
    showScene("final"); AudioManager.play("victory");
  }
};

/* ================= Battle =================
   A short turn-based fight in the style of Persona 5 Royal.
   Battle.run() returns a promise that resolves true on victory and false on defeat.
   Tweak the numbers below to make it easier or harder. */
const FOE = { name: "Failed Shadow", hp: 160 };
const CMDS = [
  { k: "attack", label: "ATTACK", sub: "Slash" },
  { k: "skill", label: "SKILL", sub: "Debug \u00B7 SP 8" },
  { k: "morgana", label: "MORGANA", sub: "Dia" },
  { k: "guard", label: "GUARD", sub: "+SP" }
];
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

const Battle = {
  run() {
    return new Promise(done => {
      this.done = done;
      this.y = { hp: 100, max: 100, sp: 24, maxSp: 24, guard: false };   /* Yana */
      this.f = { hp: FOE.hp, max: FOE.hp, charge: false };               /* the Shadow */
      this.cd = 0; this.sel = 0; this.busy = true;                       /* cd = turns until Morgana can heal again */
      $("foeName").textContent = FOE.name;
      $("foeImg").className = "foe-img"; $("btBanner").className = "btbanner";
      this.build(); this.refresh(); this.intro();
    });
  },
  async intro() {
    await this.say("A Shadow appears!");
    await wait(700);
    await this.say("Morgana: It's a Shadow of failed tests! Yana, I've got your back!");
    await wait(1000);
    this.busy = false; this.say("Choose your move.");
  },
  say(t) { $("btLog").textContent = t; return wait(450); },
  build() {
    const ul = $("cmd"); ul.innerHTML = "";
    CMDS.forEach((c, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${c.label}</span><small></small>`;
      li.onmouseenter = () => { if (!this.busy && this.sel !== i) { this.sel = i; AudioManager.play("hover"); this.refresh(); } };
      li.onclick = () => this.choose(i);
      ul.appendChild(li);
    });
  },
  off(i) { const k = CMDS[i].k; return (k === "skill" && this.y.sp < 8) || (k === "morgana" && this.cd > 0); },
  refresh() {
    const y = this.y, f = this.f;
    $("foeBar").style.width = 100 * f.hp / f.max + "%"; $("foeHp").textContent = `${f.hp}/${f.max}`;
    $("yBar").style.width = 100 * y.hp / y.max + "%"; $("yHp").textContent = `${y.hp}/${y.max}`;
    $("ySp").style.width = 100 * y.sp / y.maxSp + "%"; $("ySpT").textContent = `${y.sp}/${y.maxSp}`;
    $("mState").textContent = this.cd > 0 ? `Resting (${this.cd})` : "Ready to help";
    [...$("cmd").children].forEach((li, i) => {
      li.classList.toggle("on", i === this.sel); li.classList.toggle("off", this.off(i));
      li.querySelector("small").textContent = CMDS[i].k === "morgana" ? (this.cd > 0 ? `Dia \u00B7 ${this.cd}` : "Dia \u00B7 heal") : CMDS[i].sub;
    });
  },
  num(el, v, heal) {
    el.textContent = (heal ? "+" : "") + v; el.classList.toggle("heal", !!heal);
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  },
  async hitFoe(d) {
    AudioManager.play("shot"); pulse($("foeImg"), "hit", 450); this.num($("foeDmg"), d);
    this.f.hp = Math.max(0, this.f.hp - d); this.refresh();
    await wait(650);
  },
  async followUp() {   /* Morgana sometimes jumps in after Yana's attack */
    if (this.f.hp <= 0 || Math.random() > .35) return;
    await this.say("Morgana jumps in!"); await this.hitFoe(rnd(8, 12));
  },
  async healY(n) {
    const y = this.y, gain = Math.min(n, y.max - y.hp);
    AudioManager.play("collect"); this.num($("yDmg"), gain, true);
    y.hp += gain; this.refresh(); await wait(700);
  },
  async choose(i) {
    if (this.busy) return;
    if (this.off(i)) return AudioManager.play("wall");
    this.busy = true; this.sel = i; AudioManager.play("confirm");
    const y = this.y, k = CMDS[i].k;
    y.guard = false;
    if (k === "attack") { await this.say("Yana slashes!"); await this.hitFoe(rnd(12, 18)); await this.followUp(); }
    else if (k === "skill") { y.sp -= 8; this.refresh(); await this.say("Yana uses Debug!"); await this.hitFoe(rnd(26, 34)); await this.followUp(); }
    else if (k === "morgana") { this.cd = 2; await this.say("Morgana: Dia! Hang in there, Yana!"); await this.healY(35); }
    else { y.guard = true; y.sp = Math.min(y.maxSp, y.sp + 5); this.refresh(); await this.say("Yana braces for the next hit."); }
    if (this.f.hp <= 0) return this.end(true);
    await this.foeTurn();
    if (y.hp <= 0) return this.end(false);
    if (this.cd > 0 && k !== "morgana") this.cd--;
    this.busy = false; this.refresh(); this.say("Choose your move.");
  },
  async foeTurn() {
    const f = this.f, y = this.y; let name, d;
    if (f.charge) { f.charge = false; $("foeImg").classList.remove("charge"); name = "Stack Overflow"; d = rnd(34, 42); }
    else {
      const r = Math.random();
      if (r < .25) {   /* a charging turn: no damage now, a big hit next turn. Guarding halves it. */
        f.charge = true; $("foeImg").classList.add("charge");
        await this.say("The Shadow is piling up the stack... Brace yourself!"); await wait(500); return;
      }
      [name, d] = r < .6 ? ["Null Pointer", rnd(18, 26)] : ["Compile Error", rnd(12, 18)];
    }
    await this.say(`The Shadow uses ${name}!`);
    if (y.guard) d = Math.ceil(d / 2);
    AudioManager.play("wall"); flash(); shake(); pulse($("pmY"), "hurt", 450);
    this.num($("yDmg"), d); y.hp = Math.max(0, y.hp - d); this.refresh();
    await wait(700);
    if (y.guard && y.hp > 0) await this.say("Yana guarded! Damage halved.");
  },
  async end(win) {
    const b = $("btBanner");
    b.textContent = win ? "VICTORY" : "DEFEAT"; b.className = "btbanner show " + (win ? "win" : "lose");
    AudioManager.play(win ? "victory" : "caught");
    if (win) { $("foeImg").className = "foe-img dead"; flash(); }
    await wait(2400);
    this.done(win);
  }
};
/* Keyboard: Up/Down or W/S to pick, Enter or Space to confirm, 1-4 to pick directly. Works in any keyboard layout. */
addEventListener("keydown", e => {
  if (GameState.scene !== "battle" || Battle.busy) return;
  const up = e.code === "ArrowUp" || e.code === "KeyW", dn = e.code === "ArrowDown" || e.code === "KeyS";
  if (up || dn) { e.preventDefault(); Battle.sel = (Battle.sel + (dn ? 1 : -1) + CMDS.length) % CMDS.length; AudioManager.play("hover"); Battle.refresh(); }
  else if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); Battle.choose(Battle.sel); }
  else if (/^Digit[1-4]$/.test(e.code)) Battle.choose(+e.code.slice(5) - 1);
});

/* ================= Controls ================= */
/* Keys are matched by physical position (e.code), so WASD works in any keyboard layout.
   The e.key entries are a fallback, including the Russian layout letters on the same keys. */
const KEYS = {
  ArrowUp: [0, -1], KeyW: [0, -1], "w": [0, -1], "\u0446": [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1], "s": [0, 1], "\u044B": [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], "a": [-1, 0], "\u0444": [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0], "d": [1, 0], "\u0432": [1, 0]
};
addEventListener("keydown", e => {
  const k = KEYS[e.code] || KEYS[(e.key || "").toLowerCase()];
  if (k && Maze.on) { e.preventDefault(); Maze.move(...k); }
});
document.querySelectorAll(".dpad button").forEach(b => {
  const [dx, dy] = b.dataset.d.split(",").map(Number);
  let rep;
  const stop = () => clearInterval(rep);
  b.addEventListener("pointerdown", e => { e.preventDefault(); Maze.move(dx, dy); stop(); rep = setInterval(() => Maze.move(dx, dy), 170); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => b.addEventListener(ev, stop));
});

/* Button sounds (capture phase so they fire even when a handler stops propagation) */
document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (b && !b.closest(".dpad")) AudioManager.play("click");
}, true);
document.addEventListener("pointerover", e => {
  const b = e.target.closest("button");
  if (b && e.pointerType === "mouse" && !b.contains(e.relatedTarget)) AudioManager.play("hover");
});

/* ================= Story flow ================= */
async function story() {
  showScene("intro");
  await Dialogue.play(INTRO, $("intro"));

  showScene("oath");
  await Dialogue.play(OATH, $("oath"), { end: true, speed: 18 });
  $("iwill").classList.remove("hidden");
  await new Promise(r => { $("iwill").onclick = r; });
  $("iwill").classList.add("hidden");
  AudioManager.play("confirm");
  await Dialogue.play(VOW, $("oath"), { speed: 18 });

  await maskScene(); revealScene();
}

/* Mask scene: a levitating, trembling mask. Click it three times: it breaks apart piece by piece,
   then bursts, and the character card (the reveal scene) appears. */
const MASK_HITS = 3;

function buildShards(w) {
  const cols = 5, rows = 3, P = [];
  for (let r = 0; r <= rows; r++) {
    P[r] = [];
    for (let c = 0; c <= cols; c++) {
      const edge = r === 0 || r === rows || c === 0 || c === cols, j = () => edge ? 0 : (Math.random() - .5) * .7;
      P[r][c] = [(c + j()) / cols * 100, (r + j()) / rows * 100];
    }
  }
  const add = pts => {
    const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
    const dist = Math.hypot((cx - 50) / 50, (cy - 50) / 50) + (Math.random() - .5) * .25;   /* far from the centre breaks first */
    const el = document.createElement("div"), ang = Math.atan2(cy - 50, cx - 50), far = 140 + Math.random() * 170;
    el.className = "shard"; el.dataset.stage = dist > .75 ? 1 : dist > .4 ? 2 : 3;
    el.style.clipPath = "polygon(" + pts.map(p => p[0].toFixed(1) + "% " + p[1].toFixed(1) + "%").join(",") + ")";
    el.style.setProperty("--dx", Math.cos(ang) * far + "px");
    el.style.setProperty("--dy", Math.sin(ang) * far + 170 + "px");   /* gravity pulls the pieces down */
    el.style.setProperty("--r", (Math.random() - .5) * 260 + "deg");
    el.style.setProperty("--d", (Math.random() * .15).toFixed(2) + "s");
    w.appendChild(el);
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = P[r][c], b = P[r][c + 1], d = P[r + 1][c + 1], e = P[r + 1][c];
    if ((r + c) % 2) { add([a, b, d]); add([a, d, e]); } else { add([a, b, e]); add([b, d, e]); }
  }
}
function breakShards(w, upTo) {
  w.querySelectorAll(".shard:not(.gone)").forEach(el => { if (+el.dataset.stage <= upTo) el.classList.add("gone"); });
}
/* ring + flying debris at the point that was clicked (x, y are 0..1 inside the mask) */
function impact(w, x, y) {
  const at = el => { el.style.left = x * 100 + "%"; el.style.top = y * 100 + "%"; w.appendChild(el); };
  const ring = document.createElement("i"); ring.className = "ring"; at(ring); setTimeout(() => ring.remove(), 450);
  for (let i = 0; i < 10; i++) {
    const d = document.createElement("i"), a = Math.random() * Math.PI * 2, L = 60 + Math.random() * 120;
    d.className = "deb" + (i % 3 ? "" : " red");
    d.style.setProperty("--dx", Math.cos(a) * L + "px"); d.style.setProperty("--dy", Math.sin(a) * L + 80 + "px");
    d.style.setProperty("--r", Math.random() * 360 + "deg");
    at(d); setTimeout(() => d.remove(), 850);
  }
}
function maskScene() {
  const s = $("mask"), w = $("maskWrap");
  s.classList.remove("boom"); w.innerHTML = ""; w.dataset.stage = "0";
  buildShards(w);
  showScene("mask");
  return new Promise(done => {
    let hits = 0, busy = false;
    const hit = e => {
      if (busy) return;
      if (e) e.preventDefault();
      hits++;
      const r = w.getBoundingClientRect();
      const x = e && e.clientX != null ? (e.clientX - r.left) / r.width : .5, y = e && e.clientY != null ? (e.clientY - r.top) / r.height : .5;
      AudioManager.play("shot"); pulse(w, "hit", 300); impact(w, x, y);
      w.dataset.stage = String(hits);
      if (hits < MASK_HITS) { breakShards(w, hits); return; }
      busy = true;
      breakShards(w, 99);
      AudioManager.play("awaken"); flash(); shake(); s.classList.add("boom");
      setTimeout(done, 1700);
    };
    w.onpointerdown = hit;
    w.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hit(null); } };
  });
}

/* Reveal: the art builds up piece by piece. Every piece lands with a gunshot, like the Persona 5 results screen. */
async function revealScene() {
  const s = $("reveal");
  s.classList.remove("done"); s.querySelectorAll(".rv").forEach(e => e.classList.remove("in"));
  showScene("reveal"); later("toBrief", 7000);
  /* [layer, wait before it lands in ms]: background, red bolts, character, the whole name at once, then the Lvl 29 starburst */
  const steps = [["rvBg", 500], ["rvB1", 450], ["rvB2", 300], ["rvB3", 300], ["rvChar", 600], [["rvL1", "rvL2", "rvL3", "rvL4"], 800], ["rvLvl", 600]];
  for (const [id, gap] of steps) {
    await wait(gap);
    if (GameState.scene !== "reveal") return;
    [].concat(id).forEach(i => $(i).classList.add("in")); AudioManager.play("shot");
    if (id === "rvChar" || id === "rvLvl") shake();
  }
  await wait(700);
  if (GameState.scene !== "reveal") return;
  s.classList.add("done"); AudioManager.play("win"); flash(); confetti(70);
}

/* Final scene: click the gift, the lid pops off and a note rises out of the box */
$("gift").onclick = async () => {
  const s = $("final");
  if (s.classList.contains("open")) return;
  s.classList.add("open"); AudioManager.play("unlock");
  await wait(900);
  AudioManager.play("caught");
  Morgana.show();
  s.classList.add("talk"); $("finalBox").classList.remove("hidden");
  await Dialogue.play([MORGANA_FINAL], $("finalBox"), { end: true });
};

$("toBrief").onclick = async () => {
  showScene("brief"); Morgana.show();
  await Dialogue.play(BRIEF, $("brief"));
  showScene("maze"); Maze.start();
};

const openingCard = $("startBtn");
const deal = $("deal");
/* Step 1: click the envelope. The flap opens, the card is pulled out and the music starts. */
$("envelope").onclick = () => {
  if (deal.classList.contains("open")) return;
  AudioManager.unlock(); AudioManager.play("card"); Music.start();
  deal.classList.add("open"); $("note").style.opacity = 0;
  setTimeout(() => {
    deal.classList.add("ready"); openingCard.tabIndex = 0; openingCard.focus();
    $("note").textContent = "Click the card."; $("note").style.opacity = "";
  }, 1900);
};
/* Step 2: click the card. It flips over and the first scene starts. */
async function openCard() {
  if (!deal.classList.contains("ready") || openingCard.classList.contains("open")) return;
  AudioManager.play("card"); Music.stop();
  openingCard.classList.add("open"); $("note").style.opacity = 0;
  await wait(1700);
  story();
}
openingCard.onclick = openCard;
openingCard.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(); } };

/* ================= Init ================= */
document.querySelectorAll("[data-cfg]").forEach(el => { el.textContent = CONFIG[el.dataset.cfg]; });

/* Speaker name tag from each box's data-who, Persona style: "Morgana" with an inverted first letter */
document.querySelectorAll(".box[data-who]").forEach(box => {
  const name = box.dataset.who, tag = document.createElement("span"), first = document.createElement("b");
  tag.className = "who"; first.textContent = name[0];
  tag.append(first, name.slice(1).toLowerCase());
  box.prepend(tag);
});

/* Debug: open index.html?scene=maze (or card, reveal, final...) to jump to a scene. */
const jump = new URLSearchParams(location.search).get("scene");
if (jump && $(jump)) {
  AudioManager.unlock();
  if (jump === "maze") { showScene("maze"); Maze.start(); }
  else if (jump === "battle") { showScene("battle"); Battle.run().then(() => { showScene("maze"); Maze.start(); }); }
  else if (jump === "mask") maskScene().then(revealScene);
  else if (jump === "reveal") revealScene();
  else showScene(jump);
}
