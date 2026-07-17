import { Link, Outlet } from "react-router-dom";

function Mark() {
  // Small waveform glyph — the product's speech-analysis subject, in miniature.
  const bars = [7, 13, 5, 16, 9, 14, 6];
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
      <svg width="18" height="18" viewBox="0 0 22 22" aria-hidden>
        {bars.map((h, i) => (
          <rect key={i} x={2 + i * 3} y={(22 - h) / 2} width="1.6" height={h} rx="0.8" fill="white" />
        ))}
      </svg>
    </span>
  );
}

export function Layout() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/80 shadow-bar backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2.5 px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Mark />
            <span className="text-[15px] font-semibold tracking-tight text-ink">Transcript Analysis</span>
          </Link>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
