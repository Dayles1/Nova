const GAME_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "Space",
  "Escape",
  "KeyP",
  "KeyM",
  "Enter",
]);

export type Actions = {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  fire: boolean;
  pause: boolean;
  pointerInside: boolean;
  pointerDown: boolean;
  joystick: { active: boolean; x: number; y: number; ox: number; oy: number };
};

export class Input {
  keys = new Set<string>();
  injected: Set<string> | null = null;
  pointerX = 0;
  pointerY = 0;
  pointerInside = false;
  pointerDown = false;
  coarse = false;
  joystick = { active: false, x: 0, y: 0, ox: 0, oy: 0, id: -1 };
  fireId = -1;
  pauseEdge = false;
  private worldW = 1;
  private worldH = 1;
  private canvas: HTMLCanvasElement;
  private unsub: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.coarse = window.matchMedia("(pointer: coarse)").matches;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === "Escape" || e.code === "KeyP") this.pauseEdge = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    const clear = () => {
      this.keys.clear();
      this.pointerDown = false;
      this.joystick.active = false;
      this.fireId = -1;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clear();
    });
    this.unsub.push(
      () => window.removeEventListener("keydown", onKeyDown),
      () => window.removeEventListener("keyup", onKeyUp),
      () => window.removeEventListener("blur", clear),
    );

    const toWorld = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointerX = ((e.clientX - r.left) / r.width) * this.worldW;
      this.pointerY = ((e.clientY - r.top) / r.height) * this.worldH;
      this.pointerInside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      toWorld(e);
      this.pointerDown = true;
      const r = this.canvas.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      if (this.coarse || e.pointerType === "touch") {
        if (nx < 0.48 && this.joystick.id < 0) {
          this.joystick.active = true;
          this.joystick.ox = this.pointerX;
          this.joystick.oy = this.pointerY;
          this.joystick.x = 0;
          this.joystick.y = 0;
          this.joystick.id = e.pointerId;
          try {
            this.canvas.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        } else {
          this.fireId = e.pointerId;
        }
      }
    };
    const move = (e: PointerEvent) => {
      toWorld(e);
      if (this.joystick.active && e.pointerId === this.joystick.id) {
        const dx = this.pointerX - this.joystick.ox;
        const dy = this.pointerY - this.joystick.oy;
        const mag = Math.hypot(dx, dy);
        const max = 56;
        const dead = 8;
        if (mag < dead) {
          this.joystick.x = 0;
          this.joystick.y = 0;
        } else {
          const s = Math.min(1, (mag - dead) / (max - dead));
          this.joystick.x = (dx / mag) * s;
          this.joystick.y = (dy / mag) * s;
        }
      }
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === this.joystick.id) {
        this.joystick.active = false;
        this.joystick.x = 0;
        this.joystick.y = 0;
        this.joystick.id = -1;
      }
      if (e.pointerId === this.fireId) this.fireId = -1;
      if (e.pointerType === "mouse") this.pointerDown = false;
      if (!this.joystick.active && this.fireId < 0) this.pointerDown = false;
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", () => {
      this.pointerInside = false;
    });
    this.unsub.push(
      () => canvas.removeEventListener("pointerdown", down),
      () => canvas.removeEventListener("pointermove", move),
      () => canvas.removeEventListener("pointerup", up),
      () => canvas.removeEventListener("pointercancel", up),
    );
  }

  setWorldSize(w: number, h: number): void {
    this.worldW = w;
    this.worldH = h;
  }

  has(code: string): boolean {
    if (this.injected) return this.injected.has(code);
    return this.keys.has(code);
  }

  sample(): Actions {
    let moveX = (this.has("KeyD") || this.has("ArrowRight") ? 1 : 0) - (this.has("KeyA") || this.has("ArrowLeft") ? 1 : 0);
    let moveY = (this.has("KeyS") || this.has("ArrowDown") ? 1 : 0) - (this.has("KeyW") || this.has("ArrowUp") ? 1 : 0);

    if (this.joystick.active) {
      moveX += this.joystick.x;
      moveY += this.joystick.y;
    }

    const len = Math.hypot(moveX, moveY);
    if (len > 1) {
      moveX /= len;
      moveY /= len;
    }

    const fire =
      this.has("Space") ||
      (this.pointerDown && !this.joystick.active) ||
      this.fireId >= 0 ||
      (this.coarse && this.joystick.active);

    const pause = this.pauseEdge;
    this.pauseEdge = false;

    return {
      moveX,
      moveY,
      aimX: this.pointerX,
      aimY: this.pointerY,
      fire,
      pause,
      pointerInside: this.pointerInside,
      pointerDown: this.pointerDown,
      joystick: {
        active: this.joystick.active,
        x: this.joystick.x,
        y: this.joystick.y,
        ox: this.joystick.ox,
        oy: this.joystick.oy,
      },
    };
  }

  destroy(): void {
    for (const fn of this.unsub) fn();
    this.unsub = [];
  }
}
