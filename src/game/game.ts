import { GameAudio } from "./audio";
import { Input, type Actions } from "./input";
import { addScore, loadSave, persistSave, qualifies, type SaveData } from "./save";
import type { ControlsProbe, EnemyKind, HudState, PickupKind, Screen } from "./types";

const FIXED = 1 / 60;
const MAX_FRAME = 0.1;
const PLAYER_RADIUS = 15;
const FRICTION = 5.4;
const ACCEL = 2100;
const ACCEL_BOOST = 2900;
const MAX_SPEED = 390;
const MAX_SPEED_BOOST = 560;
const FIRE_CD = 0.15;
const FIRE_CD_BOOST = 0.09;
const BULLET_SPEED = 820;
const ENEMY_BULLET = 280;
const INVULN = 1.7;
const MULTI_T = 12;
const SHIELD_T = 14;
const SPEED_T = 9;
const LIFE_MILESTONES = [10000, 25000, 50000, 100000];

type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  r: number;
  friendly: boolean;
  dmg: number;
};
type Enemy = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  max: number;
  kind: EnemyKind;
  flash: number;
  fire: number;
  angle: number;
};
type Pickup = { x: number; y: number; kind: PickupKind; ttl: number; phase: number };
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
};
type Floater = { x: number; y: number; text: string; life: number; max: number };
type Muzzle = { x: number; y: number; angle: number; life: number };
type Boom = { x: number; y: number; t: number; heavy: boolean };
type Star = { x: number; y: number; z: number; s: number };

type Sprites = {
  player: HTMLImageElement | null;
  scout: HTMLImageElement | null;
  fighter: HTMLImageElement | null;
  bomber: HTMLImageElement | null;
  explode: HTMLImageElement | null;
  muzzle: HTMLImageElement | null;
  powerups: HTMLImageElement | null;
  bolt: HTMLImageElement | null;
  enemyBolt: HTMLImageElement | null;
};

function spriteUrl(name: string): string {
  return new URL(`sprites/${name}`, document.baseURI).href;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

const PICKUP_FRAME: Record<PickupKind, number> = {
  multi: 0,
  shield: 1,
  speed: 2,
  life: 3,
};

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private input: Input;
  private audio = new GameAudio();
  private save: SaveData;
  private onHud: (hud: HudState) => void;
  private raf = 0;
  private acc = 0;
  private last = 0;
  private running = false;
  private reducedMotion = false;
  private w = 800;
  private h = 600;
  private dpr = 1;

  private screen: Screen = "title";
  private score = 0;
  private lives = 3;
  private wave = 0;
  private nextLifeAt = 0;
  private px = 0;
  private py = 0;
  private vx = 0;
  private vy = 0;
  private aim = -Math.PI / 2;
  private fireCd = 0;
  private invuln = 0;
  private multiT = 0;
  private shieldT = 0;
  private speedT = 0;
  private shieldHits = 0;
  private hitstop = 0;
  private trauma = 0;
  private waveWait = 0;
  private waveBanner = "";
  private waveBannerT = 0;
  private alive = false;
  private menuReturn: Screen = "title";

  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private muzzles: Muzzle[] = [];
  private booms: Boom[] = [];
  private stars: Star[] = [];
  private lastHudKey = "";
  private sprites: Sprites = {
    player: null,
    scout: null,
    fighter: null,
    bomber: null,
    explode: null,
    muzzle: null,
    powerups: null,
    bolt: null,
    enemyBolt: null,
  };

  constructor(canvas: HTMLCanvasElement, onHud: (hud: HudState) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    this.input = new Input(canvas);
    this.onHud = onHud;
    this.save = loadSave();
    this.audio.setMuted(this.save.muted);
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize();
    this.resetStars();
    this.px = this.w / 2;
    this.py = this.h * 0.62;
    void this.loadSprites();
    this.bindProbe();
    this.emit();

    const onResize = () => this.resize();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.audio.resume();
    });
    this.cleanupFns.push(() => window.removeEventListener("resize", onResize));
  }

  private cleanupFns: Array<() => void> = [];

  startLoop(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > MAX_FRAME) dt = MAX_FRAME;
      this.acc += dt;
      while (this.acc >= FIXED) {
        this.step(FIXED);
        this.acc -= FIXED;
      }
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    for (const fn of this.cleanupFns) fn();
    if (window.__controlsTest) delete window.__controlsTest;
  }

  play(): void {
    this.audio.unlock();
    this.audio.ui();
    this.resetRun();
    this.screen = "playing";
    this.spawnWave(1);
    this.emit();
  }

  resume(): void {
    this.audio.unlock();
    this.audio.ui();
    if (this.screen === "paused") this.screen = "playing";
    this.emit();
  }

  pause(): void {
    if (this.screen !== "playing") return;
    this.screen = "paused";
    this.emit();
  }

  showScores(): void {
    this.audio.unlock();
    this.audio.ui();
    if (this.screen !== "scores") this.menuReturn = this.screen;
    this.screen = "scores";
    this.emit();
  }

  showHelp(): void {
    this.audio.unlock();
    this.audio.ui();
    if (this.screen !== "help") this.menuReturn = this.screen;
    this.screen = "help";
    this.emit();
  }

  showTitle(): void {
    this.audio.ui();
    this.screen = "title";
    this.alive = false;
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.emit();
  }

  back(): void {
    this.audio.ui();
    this.screen = this.menuReturn === "playing" ? "paused" : this.menuReturn;
    if (this.screen === "name") this.screen = "title";
    this.emit();
  }

  submitName(name: string): void {
    this.save.scores = addScore(this.save.scores, name, this.score, this.wave);
    persistSave(this.save);
    this.audio.pickup();
    this.menuReturn = "title";
    this.screen = "scores";
    this.emit();
  }

  setMuted(muted: boolean): void {
    this.save.muted = muted;
    persistSave(this.save);
    this.audio.setMuted(muted);
    this.audio.unlock();
    this.emit();
  }

  setReducedShake(v: boolean): void {
    this.save.reducedShake = v;
    persistSave(this.save);
    this.emit();
  }

  private async loadSprites(): Promise<void> {
    const [player, scout, fighter, bomber, explode, muzzle, powerups, bolt, enemyBolt] =
      await Promise.all([
        loadImage(spriteUrl("player.png")),
        loadImage(spriteUrl("scout.png")),
        loadImage(spriteUrl("fighter.png")),
        loadImage(spriteUrl("bomber.png")),
        loadImage(spriteUrl("explode.png")),
        loadImage(spriteUrl("muzzle.png")),
        loadImage(spriteUrl("powerups.png")),
        loadImage(spriteUrl("bolt.png")),
        loadImage(spriteUrl("enemy-bolt.png")),
      ]);
    this.sprites = { player, scout, fighter, bomber, explode, muzzle, powerups, bolt, enemyBolt };
  }

  private resize(): void {
    const parent = this.canvas.parentElement ?? this.canvas;
    const rect = parent.getBoundingClientRect();
    this.w = Math.max(320, Math.floor(rect.width));
    this.h = Math.max(480, Math.floor(rect.height));
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.input.setWorldSize(this.w, this.h);
    this.resetStars();
  }

  private resetRun(): void {
    this.score = 0;
    this.lives = 3;
    this.wave = 0;
    this.nextLifeAt = 0;
    this.px = this.w / 2;
    this.py = this.h * 0.62;
    this.vx = 0;
    this.vy = 0;
    this.aim = -Math.PI / 2;
    this.fireCd = 0;
    this.invuln = 1.2;
    this.multiT = 0;
    this.shieldT = 0;
    this.speedT = 0;
    this.shieldHits = 0;
    this.hitstop = 0;
    this.trauma = 0;
    this.waveWait = 0;
    this.alive = true;
    this.bullets.length = 0;
    this.enemies.length = 0;
    this.pickups.length = 0;
    this.particles.length = 0;
    this.floaters.length = 0;
    this.muzzles.length = 0;
    this.booms.length = 0;
  }

  private resetStars(): void {
    const count = Math.floor((this.w * this.h) / 4200);
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        z: Math.random(),
        s: Math.random() < 0.15 ? 2 : 1,
      });
    }
  }

  private spawnWave(n: number): void {
    this.wave = n;
    this.waveBanner = `ВОЛНА ${n}`;
    this.waveBannerT = 2.1;
    this.audio.wave();
    const scouts = 3 + n;
    const fighters = Math.floor(n * 0.7);
    const bombers = Math.max(0, Math.floor((n - 2) / 3));
    for (let i = 0; i < scouts; i++) this.spawnEnemy("scout");
    for (let i = 0; i < fighters; i++) this.spawnEnemy("fighter");
    for (let i = 0; i < bombers; i++) this.spawnEnemy("bomber");
    this.emit();
  }

  private spawnEnemy(kind: EnemyKind): void {
    const pos = this.edgeAwayFromPlayer();
    const stats =
      kind === "scout"
        ? { r: 13, hp: 1 }
        : kind === "fighter"
          ? { r: 17, hp: 3 }
          : { r: 26, hp: 10 + this.wave };
    this.enemies.push({
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      r: stats.r,
      hp: stats.hp,
      max: stats.hp,
      kind,
      flash: 0,
      fire: rand(0.4, 1.4),
      angle: 0,
    });
  }

  private edgeAwayFromPlayer(): { x: number; y: number } {
    for (let i = 0; i < 12; i++) {
      const side = Math.floor(Math.random() * 4);
      const pad = 36;
      let x = 0;
      let y = 0;
      if (side === 0) {
        x = rand(0, this.w);
        y = -pad;
      } else if (side === 1) {
        x = rand(0, this.w);
        y = this.h + pad;
      } else if (side === 2) {
        x = -pad;
        y = rand(0, this.h);
      } else {
        x = this.w + pad;
        y = rand(0, this.h);
      }
      if (Math.hypot(x - this.px, y - this.py) > 200) return { x, y };
    }
    return { x: this.w / 2, y: -40 };
  }

  private step(dt: number): void {
    const actions = this.input.sample();

    if (this.screen === "title" && (this.input.has("Enter") || this.input.has("Space"))) {
      this.play();
      return;
    }
    if (this.screen === "playing" && actions.pause) {
      this.pause();
      return;
    }
    if (this.screen === "paused" && actions.pause) {
      this.resume();
      return;
    }

    if (this.screen === "title" || this.screen === "paused" || this.screen === "scores" || this.screen === "help" || this.screen === "gameover" || this.screen === "name") {
      this.driftStars(dt, 0, 18);
      this.updateParticles(dt);
      return;
    }

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.updateMuzzles(dt);
      this.updateParticles(dt * 0.3);
      return;
    }

    this.updatePlayer(dt, actions);
    this.updateTimers(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updatePickups(dt);
    this.updateMuzzles(dt);
    this.updateBooms(dt);
    this.updateParticles(dt);
    this.updateFloaters(dt);
    this.collide();
    this.advanceWave(dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    this.driftStars(dt, this.vx, this.vy);
    this.maybeEmit();
  }

  private updatePlayer(dt: number, a: Actions): void {
    if (!this.alive) return;
    const boost = this.speedT > 0;
    const accel = boost ? ACCEL_BOOST : ACCEL;
    const cap = boost ? MAX_SPEED_BOOST : MAX_SPEED;

    let mx = a.moveX;
    let my = a.moveY;

    const pointerSteer =
      a.pointerDown &&
      a.pointerInside &&
      Math.hypot(mx, my) < 0.15 &&
      !a.joystick.active;
    if (pointerSteer) {
      const dx = a.aimX - this.px;
      const dy = a.aimY - this.py;
      const mag = Math.hypot(dx, dy);
      if (mag > 28) {
        mx = dx / mag;
        my = dy / mag;
      }
    }

    this.vx += mx * accel * dt;
    this.vy += my * accel * dt;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > cap) {
      this.vx *= cap / sp;
      this.vy *= cap / sp;
    }
    const damp = Math.exp(-FRICTION * dt);
    this.vx *= damp;
    this.vy *= damp;
    this.px = clamp(this.px + this.vx * dt, 28, this.w - 28);
    this.py = clamp(this.py + this.vy * dt, 28, this.h - 28);

    let target = this.aim;
    if (a.pointerInside || a.pointerDown || a.joystick.active) {
      target = Math.atan2(a.aimY - this.py, a.aimX - this.px);
    } else if (Math.hypot(mx, my) > 0.2) {
      target = Math.atan2(my, mx);
    } else {
      const nearest = this.nearestEnemy();
      if (nearest) target = Math.atan2(nearest.y - this.py, nearest.x - this.px);
    }
    if (a.joystick.active && this.input.coarse) {
      const nearest = this.nearestEnemy();
      if (nearest) target = Math.atan2(nearest.y - this.py, nearest.x - this.px);
    }
    this.aim += wrapAngle(target - this.aim) * (1 - Math.exp(-16 * dt));

    this.fireCd -= dt;
    if (a.fire && this.fireCd <= 0) this.shoot();

    if (boost && Math.random() < 0.6) {
      const bx = this.px - Math.cos(this.aim) * 16;
      const by = this.py - Math.sin(this.aim) * 16;
      this.burst(bx, by, 1, "#8eb8c6", 40);
    }

    if (this.invuln > 0) this.invuln -= dt;
  }

  private shoot(): void {
    this.fireCd = this.speedT > 0 ? FIRE_CD_BOOST : FIRE_CD;
    const spread = this.multiT > 0 ? [-0.2, 0, 0.2] : [0];
    for (const off of spread) {
      const ang = this.aim + off;
      this.bullets.push({
        x: this.px + Math.cos(ang) * 22,
        y: this.py + Math.sin(ang) * 22,
        vx: Math.cos(ang) * BULLET_SPEED,
        vy: Math.sin(ang) * BULLET_SPEED,
        ttl: 1.05,
        r: 4,
        friendly: true,
        dmg: 1,
      });
    }
    this.muzzles.push({
      x: this.px + Math.cos(this.aim) * 24,
      y: this.py + Math.sin(this.aim) * 24,
      angle: this.aim,
      life: 0.08,
    });
    this.addTrauma(0.12);
    this.audio.laser();
  }

  private updateTimers(dt: number): void {
    if (this.multiT > 0) this.multiT = Math.max(0, this.multiT - dt);
    if (this.shieldT > 0) this.shieldT = Math.max(0, this.shieldT - dt);
    if (this.speedT > 0) this.speedT = Math.max(0, this.speedT - dt);
    if (this.shieldT <= 0) this.shieldHits = 0;
    if (this.waveBannerT > 0) this.waveBannerT = Math.max(0, this.waveBannerT - dt);
  }

  private updateBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]!;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;
      if (b.ttl <= 0 || b.x < -40 || b.y < -40 || b.x > this.w + 40 || b.y > this.h + 40) {
        this.bullets.splice(i, 1);
      }
    }
  }

  private updateEnemies(dt: number): void {
    const sepR = 46;
    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt);
      let fx = 0;
      let fy = 0;
      for (const o of this.enemies) {
        if (o === e) continue;
        const dx = e.x - o.x;
        const dy = e.y - o.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d < sepR) {
          const s = (sepR - d) / sepR;
          fx += (dx / d) * s;
          fy += (dy / d) * s;
        }
      }
      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const ux = dx / dist;
      const uy = dy / dist;
      e.angle = Math.atan2(dy, dx);
      const speedMul = 1 + this.wave * 0.045;
      if (e.kind === "scout") {
        const sp = 165 * speedMul;
        e.vx = ux * sp + fx * 90;
        e.vy = uy * sp + fy * 90;
      } else if (e.kind === "fighter") {
        const desired = 210;
        const sp = 118 * speedMul;
        const hold = dist > desired ? 1 : dist < desired - 40 ? -0.6 : 0.15;
        e.vx = ux * sp * hold + fx * 110;
        e.vy = uy * sp * hold + fy * 110;
        e.fire -= dt;
        if (e.fire <= 0 && dist < 420) {
          e.fire = rand(1.35, 2.1);
          this.enemyShot(e, e.angle, 1);
        }
      } else {
        const sp = 72 * speedMul;
        const tx = ux * 0.55 - uy * 0.85;
        const ty = uy * 0.55 + ux * 0.85;
        e.vx = tx * sp + fx * 80;
        e.vy = ty * sp + fy * 80;
        e.fire -= dt;
        if (e.fire <= 0) {
          e.fire = rand(1.8, 2.6);
          for (const off of [-0.28, 0, 0.28]) this.enemyShot(e, e.angle + off, 1);
        }
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
  }

  private enemyShot(e: Enemy, ang: number, dmg: number): void {
    this.bullets.push({
      x: e.x + Math.cos(ang) * (e.r + 6),
      y: e.y + Math.sin(ang) * (e.r + 6),
      vx: Math.cos(ang) * ENEMY_BULLET,
      vy: Math.sin(ang) * ENEMY_BULLET,
      ttl: 2.4,
      r: 5,
      friendly: false,
      dmg,
    });
  }

  private updatePickups(dt: number): void {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i]!;
      p.ttl -= dt;
      p.phase += dt * 3;
      const dx = this.px - p.x;
      const dy = this.py - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 90) {
        p.x += (dx / (d || 1)) * 140 * dt;
        p.y += (dy / (d || 1)) * 140 * dt;
      }
      if (d < 22 + PLAYER_RADIUS) {
        this.collect(p.kind, p.x, p.y);
        this.pickups.splice(i, 1);
        continue;
      }
      if (p.ttl <= 0) this.pickups.splice(i, 1);
    }
  }

  private collect(kind: PickupKind, x: number, y: number): void {
    this.audio.pickup();
    this.burst(x, y, 12, "#c9d4dc", 90);
    if (kind === "multi") this.multiT = MULTI_T;
    if (kind === "shield") {
      this.shieldT = SHIELD_T;
      this.shieldHits = 3;
    }
    if (kind === "speed") this.speedT = SPEED_T;
    if (kind === "life") {
      this.lives = Math.min(5, this.lives + 1);
      this.audio.extraLife();
    }
    const label =
      kind === "multi" ? "ЗАЛП" : kind === "shield" ? "ЩИТ" : kind === "speed" ? "СКОРОСТЬ" : "+ЖИЗНЬ";
    this.floaters.push({ x, y, text: label, life: 0.9, max: 0.9 });
    this.emit();
  }

  private updateMuzzles(dt: number): void {
    for (let i = this.muzzles.length - 1; i >= 0; i--) {
      this.muzzles[i]!.life -= dt;
      if (this.muzzles[i]!.life <= 0) this.muzzles.splice(i, 1);
    }
  }

  private updateBooms(dt: number): void {
    for (let i = this.booms.length - 1; i >= 0; i--) {
      this.booms[i]!.t += dt;
      if (this.booms[i]!.t > 0.42) this.booms.splice(i, 1);
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  private updateFloaters(dt: number): void {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]!;
      f.y -= 28 * dt;
      f.life -= dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  }

  private driftStars(dt: number, pvx: number, pvy: number): void {
    const baseY = 26;
    for (const s of this.stars) {
      const par = 0.12 + s.z * 0.7;
      s.x -= pvx * par * dt * 0.18;
      s.y -= pvy * par * dt * 0.18;
      s.y += (baseY + s.z * 50) * dt;
      if (s.y > this.h) {
        s.y = 0;
        s.x = Math.random() * this.w;
      }
      if (s.y < 0) s.y = this.h;
      if (s.x < 0) s.x = this.w;
      if (s.x > this.w) s.x = 0;
    }
  }

  private collide(): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]!;
      if (!b.friendly) continue;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j]!;
        if (Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r) {
          e.hp -= b.dmg;
          e.flash = 0.08;
          this.bullets.splice(i, 1);
          this.burst(b.x, b.y, 4, "#c9d4dc", 70);
          if (e.hp <= 0) this.killEnemy(j);
          break;
        }
      }
    }

    if (!this.alive || this.invuln > 0) return;

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]!;
      if (b.friendly) continue;
      if (Math.hypot(b.x - this.px, b.y - this.py) < b.r + PLAYER_RADIUS) {
        this.bullets.splice(i, 1);
        this.hurt();
        if (!this.alive || this.invuln > 0) return;
      }
    }
    for (const e of this.enemies) {
      if (Math.hypot(e.x - this.px, e.y - this.py) < e.r + PLAYER_RADIUS - 2) {
        this.hurt();
        return;
      }
    }
  }

  private killEnemy(index: number): void {
    const e = this.enemies[index]!;
    const pts = e.kind === "scout" ? 100 : e.kind === "fighter" ? 250 : 500;
    this.addScore(pts);
    this.floaters.push({ x: e.x, y: e.y, text: `+${pts}`, life: 0.7, max: 0.7 });
    this.explode(e.x, e.y, e.kind === "bomber");
    this.audio.explosion(e.kind === "bomber");
    this.addTrauma(e.kind === "bomber" ? 0.55 : 0.28);
    if (e.kind === "bomber") this.hitstop = 0.045;
    const drop =
      e.kind === "bomber" ? 0.55 : e.kind === "fighter" ? 0.22 : 0.07;
    if (Math.random() < drop) this.dropPickup(e.x, e.y);
    this.enemies.splice(index, 1);
  }

  private dropPickup(x: number, y: number): void {
    const roll = Math.random();
    const kind: PickupKind =
      roll < 0.32 ? "multi" : roll < 0.6 ? "shield" : roll < 0.88 ? "speed" : "life";
    this.pickups.push({ x, y, kind, ttl: 12, phase: 0 });
  }

  private hurt(): void {
    if (this.invuln > 0) return;
    if (this.shieldHits > 0) {
      this.shieldHits -= 1;
      this.invuln = 0.45;
      this.addTrauma(0.35);
      this.audio.hit();
      this.burst(this.px, this.py, 10, "#8eb8c6", 120);
      if (this.shieldHits <= 0) this.shieldT = 0;
      this.emit();
      return;
    }
    this.lives -= 1;
    this.invuln = INVULN;
    this.addTrauma(0.8);
    this.hitstop = 0.08;
    this.audio.explosion(true);
    this.explode(this.px, this.py, true);
    if (this.lives <= 0) {
      this.alive = false;
      this.gameOver();
    } else {
      this.emit();
    }
  }

  private gameOver(): void {
    this.screen = qualifies(this.score, this.save.scores) ? "name" : "gameover";
    this.emit();
  }

  private addScore(n: number): void {
    this.score += n;
    while (this.nextLifeAt < LIFE_MILESTONES.length && this.score >= LIFE_MILESTONES[this.nextLifeAt]!) {
      this.nextLifeAt += 1;
      this.lives = Math.min(5, this.lives + 1);
      this.audio.extraLife();
      this.floaters.push({ x: this.px, y: this.py - 24, text: "+ЖИЗНЬ", life: 1, max: 1 });
    }
    this.emit();
  }

  private advanceWave(dt: number): void {
    if (this.enemies.length > 0) return;
    this.waveWait += dt;
    if (this.waveWait > 1.35) {
      this.waveWait = 0;
      this.addScore(250 * this.wave);
      this.floaters.push({
        x: this.w / 2,
        y: this.h * 0.4,
        text: `ВОЛНА ${this.wave}  +${250 * this.wave}`,
        life: 1.2,
        max: 1.2,
      });
      this.spawnWave(this.wave + 1);
    }
  }

  private nearestEnemy(): Enemy | null {
    let best: Enemy | null = null;
    let d = Infinity;
    for (const e of this.enemies) {
      const n = Math.hypot(e.x - this.px, e.y - this.py);
      if (n < d) {
        d = n;
        best = e;
      }
    }
    return best;
  }

  private explode(x: number, y: number, heavy: boolean): void {
    this.booms.push({ x, y, t: 0, heavy });
    const n = heavy ? 28 : 14;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(40, heavy ? 260 : 160);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.25, 0.7),
        max: 0.7,
        r: rand(1.5, heavy ? 4.5 : 3),
        color: Math.random() < 0.5 ? "#c9d4dc" : "#d46a78",
      });
    }
  }

  private burst(x: number, y: number, n: number, color: string, speed: number): void {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(20, speed);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.18, 0.4),
        max: 0.4,
        r: rand(1, 2.4),
        color,
      });
    }
  }

  private addTrauma(v: number): void {
    if (this.save.reducedShake || this.reducedMotion) return;
    this.trauma = clamp(this.trauma + v, 0, 1);
  }

  private draw(): void {
    const ctx = this.ctx;
    const shake = this.trauma * this.trauma;
    const ox = shake ? (Math.random() * 2 - 1) * 10 * shake : 0;
    const oy = shake ? (Math.random() * 2 - 1) * 10 * shake : 0;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = "#07060e";
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    ctx.translate(ox, oy);
    this.drawStars();
    this.drawNebula();

    for (const p of this.pickups) this.drawPickup(p);
    for (const b of this.bullets) this.drawBullet(b);
    for (const e of this.enemies) this.drawEnemy(e);
    if (this.alive || this.screen === "title" || this.screen === "paused") this.drawPlayer();
    for (const m of this.muzzles) this.drawMuzzle(m);
    for (const b of this.booms) this.drawBoom(b);
    for (const p of this.particles) {
      const a = p.life / p.max;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of this.floaters) {
      ctx.globalAlpha = f.life / f.max;
      ctx.fillStyle = "#f2f0f5";
      ctx.font = "600 13px Oxanium, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    if (this.waveBannerT > 0 && this.screen === "playing") {
      const a = this.waveBannerT > 1.6 ? (2.1 - this.waveBannerT) / 0.5 : this.waveBannerT < 0.4 ? this.waveBannerT / 0.4 : 1;
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.fillStyle = "#f2f0f5";
      ctx.font = "600 28px Oxanium, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.waveBanner, this.w / 2, this.h * 0.28);
      ctx.globalAlpha = 1;
    }

    if (this.screen === "playing") this.drawJoystick();
    ctx.restore();
  }

  private drawStars(): void {
    const ctx = this.ctx;
    for (const s of this.stars) {
      const a = 0.25 + s.z * 0.7;
      ctx.fillStyle = `rgba(242,240,245,${a})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
  }

  private drawNebula(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.07;
    const g = ctx.createRadialGradient(this.w * 0.2, this.h * 0.2, 20, this.w * 0.2, this.h * 0.2, this.w * 0.45);
    g.addColorStop(0, "#8eb8c6");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    const g2 = ctx.createRadialGradient(this.w * 0.8, this.h * 0.75, 10, this.w * 0.8, this.h * 0.75, this.w * 0.4);
    g2.addColorStop(0, "#d46a78");
    g2.addColorStop(1, "transparent");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }

  private drawPlayer(): void {
    const ctx = this.ctx;
    const title = this.screen === "title";
    const x = title ? this.w / 2 : this.px;
    const y = title ? this.h * 0.58 + Math.sin(performance.now() / 520) * 7 : this.py;
    const aim = title ? -Math.PI / 2 : this.aim;
    const blink = !title && this.invuln > 0 && Math.floor(this.invuln * 16) % 2 === 0;
    if (blink && this.screen === "playing") return;
    if (this.shieldHits > 0 && !title) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(142,184,198,${0.45 + Math.sin(performance.now() / 180) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    const img = this.sprites.player;
    if (img) {
      this.blitRotated(img, x, y, aim, 52);
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(aim + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(12, 14);
      ctx.lineTo(0, 8);
      ctx.lineTo(-12, 14);
      ctx.closePath();
      ctx.fillStyle = "#c9d4dc";
      ctx.fill();
      ctx.restore();
    }
  }

  private drawEnemy(e: Enemy): void {
    const img =
      e.kind === "scout" ? this.sprites.scout : e.kind === "fighter" ? this.sprites.fighter : this.sprites.bomber;
    const size = e.kind === "scout" ? 38 : e.kind === "fighter" ? 48 : 68;
    if (e.flash > 0) {
      this.ctx.save();
      this.ctx.filter = "brightness(2.4)";
    }
    if (img) this.blitRotated(img, e.x, e.y, e.angle, size);
    else {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle + Math.PI / 2);
      ctx.fillStyle = e.kind === "scout" ? "#d46a78" : e.kind === "fighter" ? "#b45560" : "#8a3d48";
      ctx.beginPath();
      ctx.moveTo(0, -e.r);
      ctx.lineTo(e.r * 0.8, e.r);
      ctx.lineTo(-e.r * 0.8, e.r);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (e.flash > 0) {
      this.ctx.filter = "none";
      this.ctx.restore();
    }
  }

  private drawBullet(b: Bullet): void {
    const img = b.friendly ? this.sprites.bolt : this.sprites.enemyBolt;
    if (img) {
      const ang = Math.atan2(b.vy, b.vx);
      this.blitSheet(img, 2, 2, Math.floor(performance.now() / 80) % 4, b.x, b.y, b.friendly ? 22 : 16, ang);
    } else {
      const ctx = this.ctx;
      ctx.fillStyle = b.friendly ? "#c9d4dc" : "#d46a78";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPickup(p: Pickup): void {
    const bob = Math.sin(p.phase) * 4;
    const img = this.sprites.powerups;
    if (img) {
      this.blitSheet(img, 2, 2, PICKUP_FRAME[p.kind], p.x, p.y + bob, 34, 0, true);
    } else {
      const ctx = this.ctx;
      ctx.fillStyle = "#8eb8c6";
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, 11, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMuzzle(m: Muzzle): void {
    const img = this.sprites.muzzle;
    const frame = clamp(3 - Math.floor((m.life / 0.08) * 4), 0, 3);
    if (img) this.blitSheet(img, 2, 2, frame, m.x, m.y, 28, m.angle);
    else {
      const ctx = this.ctx;
      ctx.fillStyle = "rgba(201,212,220,0.85)";
      ctx.beginPath();
      ctx.arc(m.x, m.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBoom(b: Boom): void {
    const img = this.sprites.explode;
    const frame = clamp(Math.floor((b.t / 0.42) * 4), 0, 3);
    const size = b.heavy ? 92 : 58;
    if (img) this.blitSheet(img, 2, 2, frame, b.x, b.y, size, 0, true);
  }

  private drawJoystick(): void {
    const j = this.input.joystick;
    if (!j.active) return;
    const ctx = this.ctx;
    ctx.strokeStyle = "rgba(201,212,220,0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(j.ox, j.oy, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(201,212,220,0.35)";
    ctx.beginPath();
    ctx.arc(j.ox + j.x * 36, j.oy + j.y * 36, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  private blitRotated(img: HTMLImageElement, x: number, y: number, angle: number, size: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  private blitSheet(
    img: HTMLImageElement,
    cols: number,
    rows: number,
    frame: number,
    x: number,
    y: number,
    size: number,
    angle: number,
    skipRot = false,
  ): void {
    const fw = img.width / cols;
    const fh = img.height / rows;
    const sx = (frame % cols) * fw;
    const sy = Math.floor(frame / cols) * fh;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    if (!skipRot) ctx.rotate(angle + Math.PI / 2);
    ctx.drawImage(img, sx, sy, fw, fh, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  private emit(): void {
    this.lastHudKey = this.hudKey();
    const hud: HudState = {
      screen: this.screen,
      score: this.score,
      lives: this.lives,
      wave: this.wave,
      multi: this.multiT,
      shield: this.shieldT,
      speed: this.speedT,
      shieldHits: this.shieldHits,
      muted: this.save.muted,
      reducedShake: this.save.reducedShake,
      scores: this.save.scores,
      qualifies: this.screen === "name",
      waveBanner: this.waveBanner,
    };
    this.onHud(hud);
  }

  private hudKey(): string {
    return [
      this.screen,
      this.score,
      this.lives,
      this.wave,
      Math.ceil(this.multiT),
      Math.ceil(this.shieldT),
      Math.ceil(this.speedT),
      this.shieldHits,
      this.save.muted ? 1 : 0,
    ].join("|");
  }

  private maybeEmit(): void {
    const key = this.hudKey();
    if (key !== this.lastHudKey) this.emit();
  }

  private bindProbe(): void {
    const probe: ControlsProbe = {
      getYaw: () => this.aim,
      getSpeed: () => Math.hypot(this.vx, this.vy),
      getX: () => this.px,
      getY: () => this.py,
      setKeys: (codes) => {
        this.input.injected = codes.length ? new Set(codes) : null;
        if (codes.includes("Escape") || codes.includes("KeyP")) this.input.pauseEdge = true;
      },
      getScreen: () => this.screen,
      getScore: () => this.score,
      getLives: () => this.lives,
    };
    window.__controlsTest = probe;
    window.__novaWing = { play: () => this.play() };
  }
}
