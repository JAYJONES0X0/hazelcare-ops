interface NexusLoaderProps {
  size?: number;
  gap?: number;
  color?: string;
  light?: string;
  mid?: string;
  dark?: string;
}

export const NexusLoader = ({
  size = 28,
  gap = 6,
  color = "#2dd4bf",
  light = "#5eead4",
  mid = "#14b8a6",
  dark = "#0f766e",
}: NexusLoaderProps) => {
  const s = size;
  const g = gap;

  return (
    <div
      style={{
        width: `calc(3 * (${1.353 * s}px + ${g}px))`,
        display: "grid",
        justifyItems: "end",
        aspectRatio: "3",
        overflow: "hidden",
        mask: `linear-gradient(90deg, transparent, #000 15px calc(100% - 15px), transparent)`,
        WebkitMask: `linear-gradient(90deg, transparent, #000 15px calc(100% - 15px), transparent)`,
      }}
    >
      <div
        style={{
          content: "",
          width: "200%",
          background: `linear-gradient(90deg, ${color} 50%, transparent 0), conic-gradient(from -90deg at ${s}px ${0.353 * s}px, ${light} 135deg, ${dark} 0 270deg, ${mid} 0)`,
          backgroundBlendMode: "multiply",
          backgroundSize: `calc(100%/3) 100%, calc(100%/6) 100%`,
          maskSize: `calc(100%/6) 100%`,
          WebkitMaskSize: `calc(100%/6) 100%`,
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
          mask: `linear-gradient(to bottom right, transparent calc(0.25 * ${s}px), #000 0 calc(100% - calc(0.25 * ${s}px) - ${1.414 * g}px), transparent 0), conic-gradient(from -90deg at right ${g}px bottom ${g}px, #000 90deg, transparent 0)`,
          WebkitMask: `linear-gradient(to bottom right, transparent calc(0.25 * ${s}px), #000 0 calc(100% - calc(0.25 * ${s}px) - ${1.414 * g}px), transparent 0), conic-gradient(from -90deg at right ${g}px bottom ${g}px, #000 90deg, transparent 0)`,
          animation: "nexus-shuffle 1s infinite linear",
        }}
      />
      <style>{`
        @keyframes nexus-shuffle {
          to { transform: translate(calc(100% / 3)); }
        }
      `}</style>
    </div>
  );
};

export const RadarLoader = ({ color = "#2dd4bf", size = 60 }: { color?: string; size?: number }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      border: `3px solid ${color}20`,
      borderTopColor: color,
      borderRightColor: color,
      animation: "nexus-radar 0.8s infinite linear",
      boxShadow: `0 0 20px ${color}30, inset 0 0 20px ${color}10`,
    }}
  >
    <style>{`
      @keyframes nexus-radar {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

export const PulseGridLoader = ({ color = "#2dd4bf" }: { color?: string }) => (
  <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
    {[0, 1, 2].map(i => (
      <div
        key={i}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          animation: `nexus-pulse 1.2s ease-in-out infinite`,
          animationDelay: `${i * 0.2}s`,
        }}
      />
    ))}
    <style>{`
      @keyframes nexus-pulse {
        0%, 100% { transform: scale(0.4); opacity: 0.3; box-shadow: 0 0 0 0 ${color}00; }
        50% { transform: scale(1); opacity: 1; box-shadow: 0 0 12px ${color}60; }
      }
    `}</style>
  </div>
);
