import { ImageResponse } from "next/og";

// Le logo : trois lignes de texte, la première surlignée
export function brandIcon(px: number, rounded = true) {
  const u = px / 64;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#2A44D8",
          borderRadius: rounded ? 14 * u : 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 14 * u,
            top: 16 * u,
            width: 36 * u,
            height: 9 * u,
            borderRadius: 4.5 * u,
            background: "#FFE27A",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 14 * u,
            top: 30 * u,
            width: 36 * u,
            height: 6 * u,
            borderRadius: 3 * u,
            background: "#FFFFFF",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 14 * u,
            top: 41 * u,
            width: 22 * u,
            height: 6 * u,
            borderRadius: 3 * u,
            background: "#C9D2F7",
          }}
        />
      </div>
    ),
    { width: px, height: px }
  );
}