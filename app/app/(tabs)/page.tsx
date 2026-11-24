import Link from "next/link";
import { requireUser } from "@/lib/server";
import { studentDashboard } from "@/lib/views";
import { ago } from "@/lib/format";
import HelpButton from "@/components/HelpButton";

export const dynamic = "force-dynamic";

const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const today = () => new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const MARK_LABEL = { got_it: "figured out", fuzzy: "still fuzzy", open: "not reviewed yet" } as const;

// Home, read top to bottom: what's live → the one thing to do next →
// how your Lost moments are going → each lecture → your classes.
export default async function Home() {
  const u = await requireUser("/app");
  const d = await studentDashboard(u);
  const learning = d.classes.some((c) => c.role === "student");
  const [first, ...more] = d.study_next;
  const t = d.totals;
  const seg = (n: number) => `${t.lost ? (n / t.lost) * 100 : 0}%`;
  return (
    <div className="dash">
      <header className="dash-head">
        <div>
          <p className="eyebrow">{today()}</p>
          <h1>Hi, {d.first_name}</h1>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <HelpButton role="student" />
          <Link className="btn sm" href="/join">+ Join a class</Link>
        </div>
      </header>

      {d.live.map((l) => (
        <div key={l.code} className="card dark live-card">
          <p className="small bold"><span className="dot pulse" style={{ marginRight: 8 }} />Live now · started {ago(l.started_at)}</p>
          <p className="small" style={{ color: "var(--on-dark-muted)", marginTop: 12 }}>{l.class_short} · Lecture {l.lecture_no}</p>
          <h2 style={{ fontSize: "1.35rem", marginTop: 2 }}>{l.title}</h2>
          <Link className="btn gold block" href={`/app/live/${l.code}`} style={{ marginTop: 16 }}>Join lecture</Link>
        </div>
      ))}

      {learning && (
        <>
          {/* 1. The one next step */}
          <section className="card dark next-card">
            <div className="between" style={{ alignItems: "flex-start", gap: 12 }}>
              <p className="eyebrow light">{first ? "Your next step" : "You're all caught up"}</p>
              {d.next_exam && (
                <Link className="exam-chip" href={`/app/study?class=${d.next_exam.class_code}`}>
                  <b>{d.next_exam.days}</b> day{d.next_exam.days === 1 ? "" : "s"} to {d.next_exam.name} · {d.next_exam.class_short}
                </Link>
              )}
            </div>
            {first ? (
              <>
                <h2 className="next-title">Review {first.name}</h2>
                <p className="next-why">{first.reason} <span className="nowrap">{first.class_short} · about {first.minutes} min</span></p>
                <div className="row" style={{ marginTop: 16, gap: 10 }}>
                  <Link className="btn gold" href={`/app/study/check?class=${first.class_code}&topic=${encodeURIComponent(first.key)}`}>
                    {first.kind === "check" ? "Start a quick check" : "Start a 5-question check"}
                  </Link>
                  <Link className="btn outline-light" href={`/app/moments/${first.event_id}?again=1`}>Explain it again</Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="next-title">{t.lost ? "Every weak spot is cleared" : "Nothing to review yet"}</h2>
                <p className="next-why">
                  {t.lost
                    ? "You marked all your Lost moments as figured out. Nice work."
                    : "In your next lecture, tap Lost whenever you lose the thread. Those moments turn into your study plan here."}
                </p>
              </>
            )}
          </section>

          <div className="dash-grid">
            <section className="dash-col">
              {/* 2. Progress on Lost moments */}
              <section className="card stack">
                <div className="between">
                  <h2>Your Lost moments</h2>
                  <Link className="small bold" href="/app/moments">See all</Link>
                </div>
                <p className="small muted">
                  {t.lost
                    ? `You tapped Lost ${plural(t.lost, "time")} across ${plural(t.lectures, "lecture")}. Mark each one "Got it" or "Still fuzzy" after reviewing it.`
                    : `You've attended ${plural(t.lectures, "lecture")} and haven't tapped Lost yet.`}
                </p>
                {t.lost > 0 && (
                  <>
                    <div className="progress3" role="img" aria-label={`${t.got_it} figured out, ${t.fuzzy} still fuzzy, ${t.open} not reviewed yet`}>
                      <span className="m-got_it" style={{ width: seg(t.got_it) }} />
                      <span className="m-fuzzy" style={{ width: seg(t.fuzzy) }} />
                      <span className="m-open" style={{ width: seg(t.open) }} />
                    </div>
                    <div className="key3">
                      <span><i className="mk m-got_it" /><b>{t.got_it}</b> figured out</span>
                      <span><i className="mk m-fuzzy" /><b>{t.fuzzy}</b> still fuzzy</span>
                      <span><i className="mk m-open" /><b>{t.open}</b> not reviewed yet</span>
                    </div>
                  </>
                )}
              </section>

              {/* 3. More to review */}
              {more.length > 0 && (
                <section className="card stack">
                  <h2>Also worth reviewing</h2>
                  {more.map((p) => (
                    <Link key={`${p.class_code}-${p.key}`} className="review-row" href={`/app/study/check?class=${p.class_code}&topic=${encodeURIComponent(p.key)}`}>
                      <span className="grow">
                        <b>{p.name}</b>
                        <span className="tiny muted" style={{ display: "block" }}>{p.class_short} · {p.minutes} min · {p.reason}</span>
                      </span>
                      <span className="chev" aria-hidden="true">›</span>
                    </Link>
                  ))}
                  <Link className="small bold" href="/app/study">Open your full study plan</Link>
                </section>
              )}
            </section>

            {/* 4. Lecture by lecture */}
            <section className="dash-col">
              <section className="card stack">
                <div className="between">
                  <h2>Lecture by lecture</h2>
                </div>
                <p className="small muted">Each dot is one time you tapped Lost. Open a lecture to replay those parts and see where the class got lost.</p>
                {d.recent.length ? (
                  d.recent.map((l) => (
                    <Link key={l.code} href={`/app/lecture/${l.code}`} className="lec-row">
                      <span className="grow" style={{ minWidth: 0 }}>
                        <b className="clip">{l.title}</b>
                        <span className="tiny muted" style={{ display: "block" }}>{l.class_short} · Lecture {l.no} · {day(l.started_at)}</span>
                      </span>
                      <span className="marks" aria-label={l.lost ? `${plural(l.lost, "Lost moment")}: ${l.got_it} figured out, ${l.fuzzy} still fuzzy` : "No Lost moments"}>
                        {l.marks.length ? l.marks.map((m, i) => <i key={i} className={`mk m-${m}`} title={MARK_LABEL[m]} />) : <span className="tiny muted">Not lost</span>}
                      </span>
                      <span className="chev" aria-hidden="true">›</span>
                    </Link>
                  ))
                ) : (
                  <p className="small muted">Lectures you join show up here after class.</p>
                )}
                {d.recent.length > 0 && (
                  <div className="key3 tiny">
                    <span><i className="mk m-got_it" />figured out</span>
                    <span><i className="mk m-fuzzy" />still fuzzy</span>
                    <span><i className="mk m-open" />not reviewed</span>
                  </div>
                )}
              </section>
            </section>
          </div>
        </>
      )}

      {/* 5. Classes */}
      <h2 className="section-title">Your classes</h2>
      <div className="stack">
        {d.classes.map((c) => (
          <Link key={c.code} className="card class-card" href={c.role === "student" ? `/app/class/${c.code}` : `/teach/${c.code}`}>
            <div className="between" style={{ alignItems: "flex-start", gap: 10 }}>
              <h3 style={{ fontSize: "1.1rem" }}>{c.name}</h3>
              {c.live_code && <span className="tag live-tag"><span className="dot pulse" /> Live</span>}
            </div>
            <p className="muted small" style={{ marginTop: 2 }}>
              {plural(c.lectures, "lecture")} ·{" "}
              {c.role !== "student" ? "you teach this class" : c.my_lost ? `you tapped Lost ${plural(c.my_lost, "time")}` : "no Lost moments yet"}
            </p>
          </Link>
        ))}
        {!d.classes.length && (
          <div className="card center stack" style={{ padding: 28 }}>
            <p className="muted">You haven&apos;t joined a class yet. Ask your professor for the class code or QR code.</p>
            <Link className="btn" href="/join">Join a class</Link>
          </div>
        )}
      </div>
    </div>
  );
}
