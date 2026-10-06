import type { ScoreRow } from "./types";

const KEY = "nova-wing-save";
const VERSION = 1;
const MAX_SCORES = 8;

export type SaveData = {
  version: number;
  scores: ScoreRow[];
  muted: boolean;
  reducedShake: boolean;
};

const defaults: SaveData = {
  version: VERSION,
  scores: [],
  muted: false,
  reducedShake: false,
};

function migrate(raw: SaveData): SaveData {
  const next = { ...defaults, ...raw };
  if (!Array.isArray(next.scores)) next.scores = [];
  next.version = VERSION;
  return next;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults, scores: [] };
    const parsed = JSON.parse(raw) as SaveData;
    return migrate(parsed);
  } catch {
    return { ...defaults, scores: [] };
  }
}

export function persistSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode / quota */
  }
}

export function qualifies(score: number, scores: ScoreRow[]): boolean {
  if (score <= 0) return false;
  if (scores.length < MAX_SCORES) return true;
  return score > scores[scores.length - 1]!.score;
}

export function addScore(
  scores: ScoreRow[],
  name: string,
  score: number,
  wave: number,
): ScoreRow[] {
  const row: ScoreRow = {
    name: name.trim().slice(0, 12) || "PILOT",
    score,
    wave,
    at: Date.now(),
  };
  return [...scores, row]
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, MAX_SCORES);
}
