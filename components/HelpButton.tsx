"use client";
// "How to use Lost and Found": a round ? button that opens a short guide for
// students or professors. Esc, the Close button or a tap outside closes it.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Role = "student" | "professor";
interface Step { icon: string; title: string; body: string }

const GUIDE: Record<Role, { title: string; intro: string; steps: Step[]; faq: [string, string][] }> = {
  student: {
    title: "How to use Lost and Found",
    intro: "Tap Lost in lecture when you lose the thread. Later, review exactly those moments.",
    steps: [
      { icon: "＋", title: "Join your class once", body: "On Home, tap “Join a class” and type the class code or scan the QR code your professor shows. You only do this once per class." },
      { icon: "●", title: "Open the live lecture", body: "When your professor starts a lecture, a “Live now” card shows up on Home. Tap “Join lecture”." },
      { icon: "!", title: "Tap Lost when you're confused", body: "Press the big Lost button the moment you lose track. A short tutor explains what was just said, so you can catch up without missing more." },
      { icon: "▶", title: "Review after class", body: "Open the lecture from Home to replay the recording, read the transcript and see where the whole class got lost. Your tutor chats are saved there too." },
      { icon: "✓", title: "Mark each moment", body: "For every Lost moment, choose “Got it” or “Still fuzzy”. Anything still fuzzy goes into your study plan." },
      { icon: "★", title: "Study what you missed", body: "“Your next step” on Home and the Study tab turn your fuzzy moments into short checks, ordered by your next exam." },
    ],
    faq: [
      ["Can my professor see that I tapped Lost?", "No. Professors only see totals, like “27 students lost at 21:30”. They never see who tapped or what you asked the tutor."],
      ["What does the graph show?", "Each bar is a minute of the lecture. Taller bars mean more students tapped Lost then. Dark bars are hotspots, and yellow triangles are your own taps. Tap a bar to play from there."],
      ["Do I need my microphone or camera?", "No. Only the camera, and only if you choose to scan a QR code to join."],
    ],
  },
  professor: {
    title: "How to use Lost and Found",
    intro: "Start a lecture and teach as usual. Afterwards, see where students got lost and fix it.",
    steps: [
      { icon: "＋", title: "Create a class", body: "Click “New class”, add the course code and title, and pick the quarter. You can change these later with “Edit class”." },
      { icon: "#", title: "Share the class code", body: "Show the class code or “Show QR code” on screen in your first lecture. Students join once. Give TAs the TA code from Edit class." },
      { icon: "●", title: "Start the lecture", body: "On the class page, click “Start lecture” and allow the microphone. It records and transcribes live, so the AI tutor knows what you just said. Only you can stop it." },
      { icon: "■", title: "Stop when you're done", body: "Click “Stop lecture”. Students' Lost buttons close, and the analysis is ready a few minutes later." },
      { icon: "↗", title: "Read the insights", body: "Each lecture shows a graph of when students tapped Lost, plus the hotspots, what you were saying then and what students asked the tutor." },
      { icon: "✎", title: "Publish clarifications", body: "Each hotspot has a drafted clarification. Edit it, attach a link or video, and publish it to the class. Term trends shows the topics that keep coming up." },
    ],
    faq: [
      ["Can I see which students were lost?", "No. To keep it honest and low-pressure, you see counts and percentages only. The People list in Edit class shows who's enrolled, never who tapped."],
      ["How do I read the graph?", "Each bar is one minute. Its height is how many students tapped Lost in that minute. Dark bars are hotspots, and the label shows how many students were lost across the hotspot. Hover over a bar for the exact numbers."],
      ["Can the tutor give away homework answers?", "Not for anything you list under “Graded work the tutor must not answer” in Edit class. For those, it gives hints or a similar example instead."],
    ],
  },
};

export default function HelpButton({ role, light }: { role: Role; light?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const g = GUIDE[role];
  return (
    <>
      <button type="button" className={`help-btn ${light ? "light" : ""}`} onClick={() => setOpen(true)} aria-label="How to use Lost and Found" title="How to use Lost and Found">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9.5" />
          <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.4-2.6 4" />
          <path d="M12 17.6h.01" />
        </svg>
      </button>
      {open && createPortal(
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(e) => e.stopPropagation()}>
            <div className="between" style={{ alignItems: "flex-start", gap: 12 }}>
              <div>
                <p className="eyebrow">{role === "student" ? "For students" : "For professors and TAs"}</p>
                <h2 id="help-title" style={{ marginTop: 4 }}>{g.title}</h2>
              </div>
              <button type="button" className="help-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>
            <p className="muted" style={{ marginTop: 6 }}>{g.intro}</p>
            <ol className="help-steps">
              {g.steps.map((s, i) => (
                <li key={i}>
                  <span className="help-ico" aria-hidden>{s.icon}</span>
                  <div>
                    <b>{i + 1}. {s.title}</b>
                    <p className="small muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <h3 style={{ marginTop: 18, fontSize: "1rem" }}>Common questions</h3>
            <div className="help-faq">
              {g.faq.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p className="small muted">{a}</p>
                </details>
              ))}
            </div>
            <button type="button" className="btn block" style={{ marginTop: 18 }} onClick={() => setOpen(false)}>Got it</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
