"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#090d1f", color: "#e6eaf7", fontFamily: "system-ui", display: "grid", placeItems: "center", minHeight: "100dvh" }}>
        <div style={{ textAlign: "center" }}>
          <h1>EduForge hit an unexpected error</h1>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 8, border: 0, background: "#ff7a2f", color: "#1a0b02", fontWeight: 600 }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
