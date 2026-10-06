import { useEffect, useRef, useState } from "react";
import { Game } from "@/game/game";
import type { HudState } from "@/game/types";
import { Overlay } from "./overlay";

const INITIAL: HudState = {
  screen: "title",
  score: 0,
  lives: 3,
  wave: 0,
  multi: 0,
  shield: 0,
  speed: 0,
  shieldHits: 0,
  muted: false,
  reducedShake: false,
  scores: [],
  qualifies: false,
  waveBanner: "",
};

export function NovaWing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState>(INITIAL);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas, setHud);
    gameRef.current = game;
    game.startLoop();
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const g = () => gameRef.current;

  return (
    <main className="bg-bg relative h-dvh w-full overflow-hidden touch-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full touch-none"
        onContextMenu={(e) => e.preventDefault()}
      />
      <Overlay
        hud={hud}
        onPlay={() => g()?.play()}
        onResume={() => g()?.resume()}
        onPause={() => g()?.pause()}
        onRestart={() => g()?.play()}
        onScores={() => g()?.showScores()}
        onHelp={() => g()?.showHelp()}
        onTitle={() => g()?.showTitle()}
        onBack={() => g()?.back()}
        onMute={(v) => g()?.setMuted(v)}
        onShake={(v) => g()?.setReducedShake(v)}
        onSubmitName={(name) => g()?.submitName(name)}
      />
    </main>
  );
}
