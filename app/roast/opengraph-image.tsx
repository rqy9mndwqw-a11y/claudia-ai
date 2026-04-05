import { ImageResponse } from "next/og";

// Note: no edge runtime — OpenNext bundles all routes in the default server function
export const alt = "Roast My Wallet — CLAUDIA AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0E0E14",
          position: "relative",
        }}
      >
        {/* Grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.04,
            backgroundImage:
              "linear-gradient(rgba(232,41,91,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(232,41,91,0.5) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />

        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(232,41,91,0.15) 0%, transparent 60%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            position: "relative",
          }}
        >
          {/* CLAUDIA brand */}
          <div
            style={{
              fontSize: 24,
              letterSpacing: 8,
              color: "#E8295B",
              fontFamily: "monospace",
              opacity: 0.6,
            }}
          >
            CLAUDIA AI
          </div>

          {/* Main title */}
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: "white",
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
            Roast My Wallet
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 22,
              color: "rgba(255,255,255,0.35)",
              fontFamily: "monospace",
              letterSpacing: 2,
              marginTop: 8,
            }}
          >
            Get destroyed by AI. Share the pain.
          </div>

          {/* URL */}
          <div
            style={{
              fontSize: 16,
              color: "#E8295B",
              fontFamily: "monospace",
              letterSpacing: 4,
              marginTop: 24,
              opacity: 0.8,
            }}
          >
            roast.claudia.wtf
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
