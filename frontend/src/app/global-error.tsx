"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ 
        backgroundColor: "#020617", 
        color: "#f8fafc", 
        fontFamily: "sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        margin: 0,
        textAlign: "center",
        padding: "20px"
      }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.2em" }}>
          System Failure
        </h2>
        <p style={{ color: "#94a3b8", maxWidth: "400px", margin: "10px 0 30px" }}>
          A critical error has occurred at the system level.
        </p>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => reset()}
            style={{
              padding: "8px 16px",
              backgroundColor: "#7c3aed",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "500",
              cursor: "pointer"
            }}
          >
            REBOOT SYSTEM
          </button>
          <a
            href="/"
            style={{
              padding: "8px 16px",
              backgroundColor: "transparent",
              color: "#f8fafc",
              border: "1px solid #1e293b",
              borderRadius: "8px",
              fontWeight: "500",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center"
            }}
          >
            RETURN TO BASE
          </a>
        </div>
      </body>
    </html>
  );
}
