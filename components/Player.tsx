"use client";
// Lecture replay: the recording (if it's still kept), a playhead shared by the
// confusion curve, the transcript and any "Play from 21:30" link on the page.
// The recording can be several runs (if the professor's page reloaded mid-lecture);
// each run starts at its own lecture time, so seeking picks the right one.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fmtAxis, fmtClock } from "@/lib/format";
import { IconPause, IconPlay } from "./icons";

interface Run {
  run_id: string;
  run_start_ms: number;
}
interface Ctx {
  t: number;
  playing: boolean;
  hasAudio: boolean | null;
  seek: (ms: number, play?: boolean) => void;
  toggle: () => void;
  duration: number;
}
const PlayerCtx = createContext<Ctx | null>(null);
export const usePlayer = () => useContext(PlayerCtx);

export function PlayerProvider({ code, duration, start = 0, children }: { code: string; duration: number; start?: number; children: React.ReactNode }) {
  const [t, setT] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const loaded = useRef<{ run: string; url: string } | null>(null);
  const tRef = useRef(start);
  tRef.current = t;

  useEffect(() => {
    let live = true;
    fetch(`/api/lectures/${code}/audio`)
      .then((r) => (r.ok ? r.json() : { runs: [] }))
      .then((d) => live && setRuns(d.runs ?? []))
      .catch(() => live && setRuns([]));
    return () => {
      live = false;
      audio.current?.pause();
      if (loaded.current) URL.revokeObjectURL(loaded.current.url);
    };
  }, [code]);

  const runFor = useCallback(
    (ms: number) => {
      if (!runs?.length) return null;
      let r = runs[0];
      for (const x of runs) if (x.run_start_ms <= ms) r = x;
      return r;
    },
    [runs],
  );

  const playAt = useCallback(
    async (ms: number) => {
      const r = runFor(ms);
      if (!r) return false;
      if (!audio.current) {
        audio.current = new Audio();
        audio.current.ontimeupdate = () => {
          const cur = loaded.current && runs?.find((x) => x.run_id === loaded.current!.run);
          if (cur && Number.isFinite(audio.current!.currentTime)) setT(cur.run_start_ms + audio.current!.currentTime * 1000);
        };
        audio.current.onended = () => {
          const i = runs!.findIndex((x) => x.run_id === loaded.current?.run);
          const next = runs![i + 1];
          if (next) void playAt(next.run_start_ms);
          else setPlaying(false);
        };
      }
      const a = audio.current;
      if (loaded.current?.run !== r.run_id) {
        const blob = await fetch(`/api/lectures/${code}/audio/${r.run_id}`).then((x) => x.blob());
        if (loaded.current) URL.revokeObjectURL(loaded.current.url);
        loaded.current = { run: r.run_id, url: URL.createObjectURL(blob) };
        a.src = loaded.current.url;
        await new Promise<void>((res) => {
          a.onloadedmetadata = () => res();
          a.onerror = () => res();
        });
        // Recordings made in the browser don't store their length; asking for the end makes the browser work it out, so seeking works.
        if (a.duration === Infinity) {
          await new Promise<void>((res) => {
            a.ondurationchange = () => {
              if (a.duration !== Infinity) res();
            };
            a.currentTime = 1e101;
            setTimeout(res, 1500);
          });
        }
      }
      a.currentTime = Math.max(0, (ms - r.run_start_ms) / 1000);
      await a.play().catch(() => {});
      setPlaying(true);
      return true;
    },
    [code, runFor, runs],
  );

  const seek = useCallback(
    (ms: number, play = true) => {
      const v = Math.max(0, Math.min(duration, ms));
      setT(v);
      if (play && runs?.length) void playAt(v);
      else if (audio.current && loaded.current) {
        const r = runFor(v);
        if (r?.run_id === loaded.current.run) audio.current.currentTime = (v - r.run_start_ms) / 1000;
      }
    },
    [duration, playAt, runFor, runs],
  );

  const toggle = useCallback(() => {
    if (playing) {
      audio.current?.pause();
      setPlaying(false);
    } else void playAt(tRef.current);
  }, [playing, playAt]);

  const value = useMemo(() => ({ t, playing, hasAudio: runs === null ? null : runs.length > 0, seek, toggle, duration }), [t, playing, runs, seek, toggle, duration]);
  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}

export function PlayButton({ big, light }: { big?: boolean; light?: boolean }) {
  const p = usePlayer()!;
  const disabled = p.hasAudio === false;
  return (
    <button
      type="button"
      onClick={p.toggle}
      disabled={disabled}
      aria-label={p.playing ? "Pause recording" : "Play recording"}
      title={disabled ? "No recording kept for this lecture" : undefined}
      style={{
        width: big ? 56 : 50,
        height: big ? 56 : 50,
        borderRadius: "50%",
        border: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        background: light ? "var(--gold)" : "var(--violet)",
        color: light ? "var(--indigo-950)" : "#fff",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {p.playing ? <IconPause /> : <IconPlay />}
    </button>
  );
}

export function SeekLink({ ms, children, className }: { ms: number; children: React.ReactNode; className?: string }) {
  const p = usePlayer();
  return (
    <button type="button" className={`linkbtn ${className ?? ""}`} onClick={() => p?.seek(ms)} style={{ textDecoration: "underline" }}>
      {children}
    </button>
  );
}

export function TimeReadout({ light }: { light?: boolean }) {
  const p = usePlayer()!;
  return (
    <span className="mono" style={{ fontWeight: 700, color: light ? "#fff" : undefined }}>
      {fmtClock(p.t)} <span style={{ opacity: 0.7, fontWeight: 500 }}>/ {fmtClock(p.duration)}</span>
    </span>
  );
}

export function TranscriptList({ lines, hot }: { lines: { start_ms: number; text: string }[]; hot: { start_ms: number; end_ms: number; label: string }[] }) {
  const p = usePlayer()!;
  const current = lines.reduce((i, l, k) => (l.start_ms <= p.t ? k : i), -1);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!p.playing) return;
    ref.current?.querySelector(".now")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [current, p.playing]);
  if (!lines.length) return <p className="muted">No transcript was recorded for this lecture.</p>;
  return (
    <div ref={ref} style={{ maxHeight: 520, overflowY: "auto" }}>
      {lines.map((l, i) => {
        const h = hot.find((x) => l.start_ms >= x.start_ms && l.start_ms < x.end_ms && !lines.slice(0, i).some((o) => o.start_ms >= x.start_ms && o.start_ms < x.end_ms));
        return (
          <div
            key={i}
            className={`tline ${h ? "hl" : ""} ${i === current ? "now" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => p.seek(l.start_ms)}
            onKeyDown={(e) => e.key === "Enter" && p.seek(l.start_ms)}
            style={{ margin: h ? "6px 0" : undefined }}
          >
            <b className="mono">{fmtClock(l.start_ms)}</b>
            {h && <b style={{ color: "var(--violet)" }}>· {h.label} </b>}
            {l.text}
          </div>
        );
      })}
    </div>
  );
}

// ---------- the confusion chart ----------
// Bars per minute (per 30 s for short lectures): how many students tapped Lost
// then. Hotspots are highlighted and labelled, your own moments sit under the
// bars, and hovering or tapping a bar says exactly what it means.

interface Peak { start_ms: number; end_ms: number; students: number; label?: string; badge?: string }

function niceMax(v: number) {
  if (v <= 4) return 4;
  // Even steps, so the middle gridline is a whole number of students.
  const step = v <= 10 ? 2 : v <= 20 ? 4 : v <= 50 ? 10 : 20;
  return Math.ceil(v / step) * step;
}

export function ConfusionCurve({
  buckets,
  duration,
  height = 140,
  mine = [],
  peaks = [],
  dark,
  showAxis = true,
  playhead = true,
}: {
  buckets: { start_ms: number; students: number }[];
  duration: number;
  height?: number;
  mine?: number[];
  peaks?: Peak[];
  dark?: boolean;
  showAxis?: boolean;
  playhead?: boolean;
}) {
  const p = usePlayer();
  const [hover, setHover] = useState<number | null>(null);
  const dur = Math.max(duration, 1);
  const binMs = dur > 20 * 60_000 ? 60_000 : 30_000;
  const bins = useMemo(() => {
    const n = Math.max(1, Math.ceil(dur / binMs));
    const out = Array.from({ length: n }, (_, i) => ({ start: i * binMs, students: 0 }));
    // Each 30-second bucket counts a student once; a bin shows its busiest 30 seconds.
    for (const b of buckets) {
      const k = Math.min(n - 1, Math.floor(b.start_ms / binMs));
      out[k].students = Math.max(out[k].students, b.students);
    }
    return out;
  }, [buckets, dur, binMs]);
  const top = niceMax(Math.max(0, ...bins.map((b) => b.students)));
  const ticks = [0, top / 2, top];
  const pctX = (ms: number) => `${(Math.min(Math.max(ms, 0), dur) / dur) * 100}%`;
  const inPeak = (b: { start: number }) => peaks.findIndex((pk) => b.start + binMs > pk.start_ms && b.start < pk.end_ms);
  const empty = bins.every((b) => b.students === 0);
  const step = dur > 60 * 60_000 ? 15 : dur > 25 * 60_000 ? 10 : 5;
  const xTicks: number[] = [];
  for (let m = 0; m * 60_000 <= dur; m += step) xTicks.push(m * 60_000);
  const h = bins[hover ?? -1];
  const hp = h ? inPeak(h) : -1;
  const seek = (ms: number) => p?.seek(ms);
  const peakTop = peaks.length ? 30 : 6;

  return (
    <div className={`cchart ${dark ? "dark" : ""}`} onMouseLeave={() => setHover(null)}>
      <div className="cchart-plot" style={{ height, paddingTop: peakTop }}>
        {/* y gridlines + labels */}
        {showAxis &&
          ticks.map((t) => (
            <div key={t} className="cchart-grid" style={{ bottom: `${(t / top) * height}px` }}>
              <span>{t}</span>
            </div>
          ))}
        {peaks.map((pk, i) => {
          const mid = (pk.start_ms + pk.end_ms) / 2;
          return (
            <button
              key={i}
              type="button"
              className="cchart-peak"
              style={{ left: pctX(mid) }}
              onClick={() => seek(pk.start_ms)}
              title={`${pk.label ? pk.label + ": " : ""}${pk.badge ?? `${pk.students} students`} lost, ${fmtClock(pk.start_ms)}–${fmtClock(pk.end_ms)}`}
            >
              {(pk.badge ?? `${pk.students} lost`) && <b>{pk.badge ?? `${pk.students} lost`}</b>}
              {pk.label && <span className="pk-name">{pk.label}</span>}
            </button>
          );
        })}
        <div className="cchart-bars" style={{ height }} role="img" aria-label={empty ? "No one tapped Lost in this lecture" : `Students who tapped Lost, per ${binMs === 60_000 ? "minute" : "30 seconds"}. Highest: ${Math.max(...bins.map((b) => b.students))} students.`}>
          {bins.map((b, i) => {
            const pk = inPeak(b);
            return (
              <button
                key={i}
                type="button"
                className={`cchart-bar ${pk >= 0 ? "hot" : ""} ${hover === i ? "on" : ""}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => {
                  setHover(i);
                  seek(pk >= 0 ? Math.max(peaks[pk].start_ms, b.start) : b.start);
                }}
                aria-label={`${fmtClock(b.start)}: ${b.students} student${b.students === 1 ? "" : "s"} lost`}
              >
                <span style={{ height: b.students ? `max(3px, ${(b.students / top) * 100}%)` : 0 }} />
              </button>
            );
          })}
          {p && playhead && p.t > 0 && <span className="cchart-head" style={{ left: pctX(p.t) }} />}
          {empty && <p className="cchart-empty">No one tapped Lost in this lecture.</p>}
        </div>
      </div>
      {mine.length > 0 && (
        <div className="cchart-mine" aria-label="Your Lost moments">
          {mine.map((ms, i) => (
            <button key={i} type="button" style={{ left: pctX(ms) }} onClick={() => seek(ms)} title={`You tapped Lost at ${fmtClock(ms)}`} aria-label={`You tapped Lost at ${fmtClock(ms)}`} />
          ))}
        </div>
      )}
      {showAxis && (
        <div className="cchart-x">
          {xTicks.map((t) => (
            <span key={t} style={{ left: pctX(t), transform: t === 0 ? "none" : t > dur * 0.93 ? "translateX(-100%)" : undefined }}>{fmtAxis(t)}</span>
          ))}
        </div>
      )}
      <p className="cchart-read" aria-live="polite">
        {h ? (
          <>
            <b className="mono">{fmtClock(h.start)}–{fmtClock(Math.min(dur, h.start + binMs))}</b> · {h.students} student{h.students === 1 ? "" : "s"} tapped Lost
            {hp >= 0 && peaks[hp].label ? ` · hotspot: ${peaks[hp].label}` : ""}
            {p ? " · tap to play from here" : ""}
          </>
        ) : (
          <>Each bar is {binMs === 60_000 ? "one minute" : "30 seconds"}; taller means more students were lost. Hover or tap a bar for details.</>
        )}
      </p>
    </div>
  );
}
