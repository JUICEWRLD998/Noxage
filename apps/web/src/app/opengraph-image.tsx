import { ImageResponse } from "next/og";

export const alt = "Noxage — Public liquidity. Private strategy.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Violet-glass OG card on the dark brand surface. Satori supports flexbox
// only, so everything is nested flex divs with inline styles.
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#0b0a10",
          backgroundImage:
            "radial-gradient(42% 55% at 82% 20%, rgba(124, 92, 255, 0.35), transparent), radial-gradient(50% 60% at 12% 85%, rgba(88, 60, 200, 0.25), transparent)",
          color: "#f2f0fa",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "34px",
            color: "#b9a8ff",
          }}
        >
          <span>◆</span>
          <span style={{ letterSpacing: "0.06em" }}>NOXAGE</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "36px",
            fontSize: "88px",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          <span>Public liquidity.</span>
          <span style={{ color: "#b9a8ff" }}>Private strategy.</span>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "36px",
            fontSize: "30px",
            color: "#a9a4bd",
            maxWidth: "820px",
          }}
        >
          Sealed trade intents, encrypted netting, residual-only settlement on
          unmodified Uniswap.
        </div>

        <div
          style={{
            display: "flex",
            gap: "28px",
            marginTop: "56px",
            fontSize: "24px",
            color: "#8f8aa8",
          }}
        >
          <span>ETH Sepolia</span>
          <span>·</span>
          <span>ERC-7984 confidential tokens</span>
          <span>·</span>
          <span>No mock data</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
