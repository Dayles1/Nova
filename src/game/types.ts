export type Screen =
  | "title"
  | "playing"
  | "paused"
  | "scores"
  | "help"
  | "gameover"
  | "name";

export type PickupKind = "multi" | "shield" | "speed" | "life";

export type EnemyKind = "scout" | "fighter" | "bomber";

export type ScoreRow = {
  name: string;
  score: number;
  wave: number;
  at: number;
};

export type HudState = {
  screen: Screen;
  score: number;
  lives: number;
  wave: number;
  multi: number;
  shield: number;
  speed: number;
  shieldHits: number;
  muted: boolean;
  reducedShake: boolean;
  scores: ScoreRow[];
  qualifies: boolean;
  waveBanner: string;
};

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  getX: () => number;
  getY: () => number;
  setKeys: (codes: string[]) => void;
  setSteer?: (v: number) => void;
  getScreen: () => Screen;
  getScore: () => number;
  getLives: () => number;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
    __novaWing?: { play: () => void };
  }
}
