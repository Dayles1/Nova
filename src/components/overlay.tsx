import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  CircleHelp,
  Crosshair,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import type { HudState, ScoreRow } from "@/game/types";

type Props = {
  hud: HudState;
  onPlay: () => void;
  onResume: () => void;
  onPause: () => void;
  onRestart: () => void;
  onScores: () => void;
  onHelp: () => void;
  onTitle: () => void;
  onBack: () => void;
  onMute: (v: boolean) => void;
  onShake: (v: boolean) => void;
  onSubmitName: (name: string) => void;
};

export function Overlay({
  hud,
  onPlay,
  onResume,
  onPause,
  onRestart,
  onScores,
  onHelp,
  onTitle,
  onBack,
  onMute,
  onShake,
  onSubmitName,
}: Props) {
  const playing = hud.screen === "playing";
  const modal = hud.screen !== "playing";

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-fg">
      {playing ? (
        <HudChrome hud={hud} onPause={onPause} onMute={onMute} />
      ) : null}

      {modal ? (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-bg/55 px-4 py-8">
          {hud.screen === "title" ? (
            <TitleCard onPlay={onPlay} onScores={onScores} onHelp={onHelp} muted={hud.muted} onMute={onMute} />
          ) : null}
          {hud.screen === "paused" ? (
            <PauseCard
              hud={hud}
              onResume={onResume}
              onRestart={onRestart}
              onScores={onScores}
              onHelp={onHelp}
              onTitle={onTitle}
              onMute={onMute}
              onShake={onShake}
            />
          ) : null}
          {hud.screen === "scores" ? <ScoresCard scores={hud.scores} onBack={onBack} /> : null}
          {hud.screen === "help" ? <HelpCard onBack={onBack} /> : null}
          {hud.screen === "gameover" ? (
            <OverCard hud={hud} onRestart={onRestart} onScores={onScores} onTitle={onTitle} />
          ) : null}
          {hud.screen === "name" ? (
            <NameCard hud={hud} onSubmit={onSubmitName} onSkip={onTitle} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function HudChrome({
  hud,
  onPause,
  onMute,
}: {
  hud: HudState;
  onPause: () => void;
  onMute: (v: boolean) => void;
}) {
  return (
    <>
      <div className="pointer-events-none absolute top-0 right-0 left-0 flex items-start justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <div className="flex flex-col gap-1">
          <div className="font-display text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
            {hud.score.toLocaleString("ru-RU")}
          </div>
          <div className="text-muted font-display text-xs tracking-[0.18em] uppercase">
            Волна {hud.wave}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-surface/80 flex items-center gap-1 rounded-[12px] border border-border px-2.5 py-1.5">
            {Array.from({ length: Math.max(hud.lives, 0) }).map((_, i) => (
              <Heart key={i} className="text-fg size-4 fill-current" strokeWidth={1.75} />
            ))}
            {hud.lives <= 0 ? <span className="text-muted text-xs">—</span> : null}
          </div>
          <button
            type="button"
            className="pointer-events-auto bg-surface/80 text-fg inline-flex size-11 items-center justify-center rounded-[12px] border border-border"
            onClick={() => onMute(!hud.muted)}
            aria-label={hud.muted ? "Включить звук" : "Выключить звук"}
          >
            {hud.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <button
            type="button"
            className="pointer-events-auto bg-surface/80 text-fg inline-flex size-11 items-center justify-center rounded-[12px] border border-border"
            onClick={onPause}
            aria-label="Пауза"
          >
            <Pause className="size-4" />
          </button>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 flex flex-col gap-1.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        {hud.multi > 0 ? <Chip icon={<Crosshair className="size-3.5" />} label="Залп" value={hud.multi} /> : null}
        {hud.shield > 0 ? (
          <Chip icon={<Shield className="size-3.5" />} label={`Щит ×${hud.shieldHits}`} value={hud.shield} />
        ) : null}
        {hud.speed > 0 ? <Chip icon={<Zap className="size-3.5" />} label="Скорость" value={hud.speed} /> : null}
      </div>
    </>
  );
}

function Chip({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="bg-surface/80 text-fg inline-flex w-fit items-center gap-2 rounded-[999px] border border-border px-3 py-1.5 text-xs">
      <span className="text-accent">{icon}</span>
      <span className="font-medium">{label}</span>
      <span className="text-muted font-display tabular-nums">{Math.ceil(value)}с</span>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="bg-surface border-border max-h-[min(92dvh,760px)] w-full max-w-md overflow-y-auto rounded-[28px] border px-6 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      {children}
    </section>
  );
}

function TitleCard({
  onPlay,
  onScores,
  onHelp,
  muted,
  onMute,
}: {
  onPlay: () => void;
  onScores: () => void;
  onHelp: () => void;
  muted: boolean;
  onMute: (v: boolean) => void;
}) {
  return (
    <Panel>
      <p className="text-muted font-display mb-3 text-[11px] tracking-[0.32em] uppercase">Орбитальный перехват</p>
      <h1 className="font-display text-[clamp(2.1rem,8vw,3.2rem)] leading-[0.95] font-semibold tracking-[-0.04em]">
        NOVA
        <br />
        WING
      </h1>
      <p className="text-muted mt-4 max-w-sm text-sm leading-relaxed">
        Волны врагов, залп, щит и скорость. Держите строй — орбита не прощает.
      </p>
      <div className="mt-7 flex flex-col gap-2.5">
        <Primary onClick={onPlay} icon={<Play className="size-4" />}>
          Играть
        </Primary>
        <Row>
          <Ghost onClick={onScores} icon={<Trophy className="size-4" />}>
            Рекорды
          </Ghost>
          <Ghost onClick={onHelp} icon={<CircleHelp className="size-4" />}>
            Управление
          </Ghost>
        </Row>
        <Ghost onClick={() => onMute(!muted)} icon={muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}>
          {muted ? "Звук выключен" : "Звук включён"}
        </Ghost>
      </div>
    </Panel>
  );
}

function PauseCard({
  hud,
  onResume,
  onRestart,
  onScores,
  onHelp,
  onTitle,
  onMute,
  onShake,
}: {
  hud: HudState;
  onResume: () => void;
  onRestart: () => void;
  onScores: () => void;
  onHelp: () => void;
  onTitle: () => void;
  onMute: (v: boolean) => void;
  onShake: (v: boolean) => void;
}) {
  return (
    <Panel>
      <p className="text-muted font-display text-[11px] tracking-[0.28em] uppercase">Пауза</p>
      <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight">Строй заморожен</h2>
      <p className="text-muted mt-2 font-display text-sm tabular-nums">
        {hud.score.toLocaleString("ru-RU")} · волна {hud.wave}
      </p>
      <div className="mt-6 flex flex-col gap-2.5">
        <Primary onClick={onResume} icon={<Play className="size-4" />}>
          Продолжить
        </Primary>
        <Ghost onClick={onRestart} icon={<RotateCcw className="size-4" />}>
          Заново
        </Ghost>
        <Row>
          <Ghost onClick={onScores} icon={<Trophy className="size-4" />}>
            Рекорды
          </Ghost>
          <Ghost onClick={onHelp} icon={<CircleHelp className="size-4" />}>
            Управление
          </Ghost>
        </Row>
        <Ghost onClick={() => onMute(!hud.muted)}>
          {hud.muted ? "Включить звук" : "Выключить звук"}
        </Ghost>
        <Ghost onClick={() => onShake(!hud.reducedShake)}>
          {hud.reducedShake ? "Тряска экрана: выкл" : "Тряска экрана: вкл"}
        </Ghost>
        <Ghost onClick={onTitle} icon={<ChevronLeft className="size-4" />}>
          В меню
        </Ghost>
      </div>
    </Panel>
  );
}

function ScoresCard({ scores, onBack }: { scores: ScoreRow[]; onBack: () => void }) {
  return (
    <Panel>
      <p className="text-muted font-display text-[11px] tracking-[0.28em] uppercase">Таблица рекордов</p>
      <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight">Пилоты</h2>
      <ol className="mt-5 flex flex-col gap-2">
        {scores.length === 0 ? (
          <li className="text-muted text-sm">Пока пусто — первый заход ваш.</li>
        ) : (
          scores.map((row, i) => (
            <li
              key={`${row.at}-${row.name}`}
              className="border-border flex items-baseline justify-between gap-3 rounded-[12px] border px-3 py-2.5"
            >
              <span className="text-muted font-display w-6 text-sm tabular-nums">{i + 1}</span>
              <span className="flex-1 truncate font-medium">{row.name}</span>
              <span className="text-muted text-xs">в.{row.wave}</span>
              <span className="font-display text-sm tabular-nums">{row.score.toLocaleString("ru-RU")}</span>
            </li>
          ))
        )}
      </ol>
      <div className="mt-6">
        <Primary onClick={onBack} icon={<ChevronLeft className="size-4" />}>
          Назад
        </Primary>
      </div>
    </Panel>
  );
}

function HelpCard({ onBack }: { onBack: () => void }) {
  return (
    <Panel>
      <p className="text-muted font-display text-[11px] tracking-[0.28em] uppercase">Управление</p>
      <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight">Как лететь</h2>
      <ul className="mt-5 space-y-3 text-sm leading-relaxed">
        <li>
          <span className="text-fg font-medium">WASD / стрелки</span>
          <span className="text-muted"> — движение. Диагонали не быстрее прямых.</span>
        </li>
        <li>
          <span className="text-fg font-medium">Мышь</span>
          <span className="text-muted">
            {" "}
            — прицел. Клик или пробел — огонь. Удерживайте указатель, чтобы тянуть корабль за курсором.
          </span>
        </li>
        <li>
          <span className="text-fg font-medium">Телефон</span>
          <span className="text-muted"> — левый стик двигает, правая половина и автоогонь бьют в ближайшего.</span>
        </li>
        <li>
          <span className="text-fg font-medium">Esc / P</span>
          <span className="text-muted"> — пауза.</span>
        </li>
        <li className="text-muted">Усиления: залп, щит (три удара), скорость. Дополнительная жизнь — с 10 000 очков.</li>
      </ul>
      <div className="mt-6">
        <Primary onClick={onBack}>Понятно</Primary>
      </div>
    </Panel>
  );
}

function OverCard({
  hud,
  onRestart,
  onScores,
  onTitle,
}: {
  hud: HudState;
  onRestart: () => void;
  onScores: () => void;
  onTitle: () => void;
}) {
  return (
    <Panel>
      <p className="text-muted font-display text-[11px] tracking-[0.28em] uppercase">Крушение</p>
      <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight">Орбита потеряна</h2>
      <p className="text-muted mt-3 font-display text-lg tabular-nums">
        {hud.score.toLocaleString("ru-RU")}
        <span className="text-muted ml-2 text-sm">волна {hud.wave}</span>
      </p>
      <div className="mt-6 flex flex-col gap-2.5">
        <Primary onClick={onRestart} icon={<RotateCcw className="size-4" />}>
          Ещё раз
        </Primary>
        <Ghost onClick={onScores} icon={<Trophy className="size-4" />}>
          Рекорды
        </Ghost>
        <Ghost onClick={onTitle} icon={<ChevronLeft className="size-4" />}>
          В меню
        </Ghost>
      </div>
    </Panel>
  );
}

function NameCard({
  hud,
  onSubmit,
  onSkip,
}: {
  hud: HudState;
  onSubmit: (name: string) => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    setName("");
  }, [hud.score]);
  return (
    <Panel>
      <p className="text-muted font-display text-[11px] tracking-[0.28em] uppercase">Новый рекорд</p>
      <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight">Позывной</h2>
      <p className="text-muted mt-2 font-display text-lg tabular-nums">{hud.score.toLocaleString("ru-RU")}</p>
      <form
        className="mt-5 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(name);
        }}
      >
        <label className="text-muted text-xs" htmlFor="pilot-name">
          Имя пилота
        </label>
        <input
          id="pilot-name"
          autoFocus
          maxLength={12}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="NOVA"
          className="bg-surface-2 text-fg border-border-strong h-11 rounded-[12px] border px-3 outline-none focus:ring-2 focus:ring-accent/40"
        />
        <Primary type="submit">Сохранить</Primary>
        <Ghost type="button" onClick={onSkip}>
          Пропустить
        </Ghost>
      </form>
    </Panel>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5">{children}</div>;
}

function Primary({
  children,
  onClick,
  icon,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="bg-primary text-primary-fg inline-flex h-12 w-full items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-semibold tracking-wide transition-transform duration-150 ease-out active:scale-[0.98]"
    >
      {icon}
      {children}
    </button>
  );
}

function Ghost({
  children,
  onClick,
  icon,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="bg-surface-2 text-fg border-border inline-flex h-12 w-full items-center justify-center gap-2 rounded-[16px] border px-4 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.98]"
    >
      {icon}
      {children}
    </button>
  );
}
