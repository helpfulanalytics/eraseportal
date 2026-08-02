import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Dynamic params
    const hasTitle = searchParams.has("title");
    const title = hasTitle
      ? searchParams.get("title")?.slice(0, 100)
      : "Client Workspace";
    const type = searchParams.get("type") || "Portal";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            backgroundImage: "linear-gradient(to bottom right, #111111, #000000)", // Premium dark gradient
            padding: "80px",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {/* Top Left: Logo & Type */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "auto" }}>
            <svg
              width="56"
              height="56"
              viewBox="0 0 269 269"
              fill="white"
            >
              <path d="M 120 0 C 53.726 0 0 53.726 0 120 L 100 120 C 111.046 120 120 111.046 120 100 Z" />
              <path d="M 136 0 C 202.274 0 256 53.726 256 120 L 156 120 C 144.954 120 136 111.046 136 100 Z" />
              <path d="M 120 256 C 53.726 256 0 202.274 0 136 L 100 136 C 111.046 136 120 144.954 120 156 Z" />
              <path d="M 136 256 L 256 256 L 256 136 L 156 136 C 144.954 136 136 144.954 136 156 Z" />
            </svg>
            <div
              style={{
                marginLeft: "24px",
                display: "flex",
                alignItems: "center",
                fontSize: 32,
                color: "#a1a1aa", // zinc-400
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              Erase Friction {type}
            </div>
          </div>
          
          {/* Bottom: Title */}
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 600,
              color: "white",
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              marginTop: "40px",
              maxWidth: "1000px",
            }}
          >
            {title}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error("Error generating OG image", e);
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
