import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Use the public/icon.svg vector for the app icon (replaces the diamond).
export default function Icon() {
  return new ImageResponse(
    (
      <svg
        width={64}
        height={64}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g strokeWidth={8} strokeLinecap="round" fill="none">
          <path d="M52.80 34.92 A21 21 0 0 1 41.21 50.88" stroke="#b45309" />
          <path d="M35.65 52.68 A21 21 0 0 1 16.90 46.59" stroke="#d97706" />
          <path d="M13.46 41.86 A21 21 0 0 1 13.46 22.14" stroke="#f59e0b" />
          <path d="M16.90 17.41 A21 21 0 0 1 35.65 11.32" stroke="#fbbf24" />
          <path d="M41.21 13.13 A21 21 0 0 1 52.80 29.08" stroke="#c67b5c" />
        </g>
      </svg>
    ),
    { ...size },
  );
}
