import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Brand mark: violet diamond on the dark brand surface.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0b0a10",
          borderRadius: "12px",
          color: "#7c5cff",
          fontSize: "40px",
        }}
      >
        ◆
      </div>
    ),
    { ...size },
  );
}
