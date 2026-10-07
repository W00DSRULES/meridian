import type { Glyph } from "@/lib/types";

export function GlyphMark({ glyph }: { glyph: Glyph }) {
  const common = {
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (glyph === "compass") {
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="10" />
        <path d="M16 6.5v2.2M16 23.3V25.5M6.5 16h2.2M23.3 16H25.5" />
        <path d="m18.8 13.2-6.2 2.2 2.2 6.2 6.2-2.2z" />
      </svg>
    );
  }
  if (glyph === "quill") {
    return (
      <svg {...common}>
        <path d="M9 23c6-1 12-8 14-16-6 2-12 7-14 16z" />
        <path d="M12.5 19.5c2.2-2.4 5-5 8-7" />
        <path d="M9 23c1.2 1.4 2.4 2.2 4.2 2.6" />
      </svg>
    );
  }
  if (glyph === "lantern") {
    return (
      <svg {...common}>
        <path d="M13 8h6M16 8V6" />
        <rect x="11" y="10" width="10" height="12" rx="1.5" />
        <path d="M16 14v4M11 22h10" />
      </svg>
    );
  }
  if (glyph === "lens") {
    return (
      <svg {...common}>
        <circle cx="14" cy="14" r="6.5" />
        <path d="m19 19 6 6" />
        <path d="M11.5 14h5M14 11.5v5" />
      </svg>
    );
  }
  if (glyph === "sprout") {
    return (
      <svg {...common}>
        <path d="M16 26V14" />
        <path d="M16 18c-4-1-7-5-7-9 5 0 8 3 8 9z" />
        <path d="M16 16c4-1 7-4 8-8-5 .2-8 3-8 8z" />
      </svg>
    );
  }
  if (glyph === "beacon") {
    return (
      <svg {...common}>
        <path d="M16 26V12" />
        <path d="M12 26h8" />
        <path d="M16 12c3 0 5-2.2 5-5H11c0 2.8 2 5 5 5z" />
        <path d="M8 14c2 1.4 4.2 2 8 2s6-.6 8-2" />
      </svg>
    );
  }
  if (glyph === "keystone") {
    return (
      <svg {...common}>
        <path d="M8 24V14l8-6 8 6v10" />
        <path d="M13 24v-6h6v6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="16" cy="12" r="3.2" />
      <path d="M16 15.2V22" />
      <path d="M10 22h12" />
      <path d="M12 25h8" />
    </svg>
  );
}
