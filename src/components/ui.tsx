import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { playerImage, teamImage, tournamentImage } from "../api/sofascore";
import { ratingClass } from "../lib/format";

function Img({ src, size, round, alt }: { src: string; size: number; round?: boolean; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span class={`img-fallback${round ? " round" : ""}`} style={{ width: size, height: size }} />;
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      class={round ? "round" : undefined}
      onError={() => setFailed(true)}
    />
  );
}

export const TeamLogo = ({ id, size = 20, name = "" }: { id: number; size?: number; name?: string }) => (
  <Img src={teamImage(id)} size={size} alt={name} />
);

export const PlayerPhoto = ({ id, size = 32 }: { id: number; size?: number }) => (
  <Img src={playerImage(id)} size={size} round alt="" />
);

export const TournamentLogo = ({ id, size = 18 }: { id: number; size?: number }) => (
  <Img src={tournamentImage(id)} size={size} alt="" />
);

export function RatingBadge({ value }: { value?: number }) {
  return <span class={`rating ${ratingClass(value)}`}>{value != null ? value.toFixed(1) : "–"}</span>;
}

export function Loading() {
  return (
    <div class="state">
      <span class="spinner" aria-hidden="true" />
      Yükleniyor…
    </div>
  );
}

export function ErrorBox({ error }: { error: Error }) {
  return (
    <div class="state error">
      Veri alınamadı.
      <small>{error.message}</small>
    </div>
  );
}

export const Empty = ({ children }: { children: ComponentChildren }) => <div class="state">{children}</div>;

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div class="segmented" role="tablist">
      {options.map(([v, label]) => (
        <button role="tab" aria-selected={v === value} class={v === value ? "on" : ""} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export const Icon = {
  back: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  ),
  gear: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm7.4-2.5l1.6 1.2-1.6 2.8-1.9-.7a7 7 0 01-1.7 1l-.3 2H10.5l-.3-2a7 7 0 01-1.7-1l-1.9.7L5 14.2l1.6-1.2a7 7 0 010-2L5 9.8 6.6 7l1.9.7a7 7 0 011.7-1l.3-2h3.2l.3 2a7 7 0 011.7 1l1.9-.7 1.6 2.8-1.6 1.2a7 7 0 010 2z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
    </svg>
  ),
  pin: () => (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path d="M9 4h6l-1 6 3 3H7l3-3-1-6zM12 13v7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
  ),
  ball: () => (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="#fff" stroke="#1d1f24" stroke-width="1.6" />
      <path d="M16 10.5l5 3.6-1.9 5.9h-6.2L11 14.1z" fill="#1d1f24" />
      <path
        d="M16 10.5V3.5M21 14.1l6.4-2.3M19.1 20l4 5.4M12.9 20l-4 5.4M11 14.1l-6.4-2.3"
        stroke="#1d1f24"
        stroke-width="1.4"
      />
    </svg>
  ),
};
