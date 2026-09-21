import React from "react";

export default function Logomark({ size = 34 }) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 100 90" fill="none" aria-hidden="true">
      <path d="M4 4 L24 4 L24 86 L4 86 Z" fill="var(--slate)" />
      <path d="M76 4 L96 4 L96 86 L76 86 Z" fill="var(--slate)" />
      <path d="M28 18 L50 32 L50 58 L28 44 Z" fill="var(--clay)" />
      <path d="M72 18 L50 32 L50 58 L72 44 Z" fill="var(--clay)" />
      <path d="M28 50 L44 60 L44 86 L28 76 Z" fill="var(--slate)" />
      <path d="M72 50 L56 60 L56 86 L72 76 Z" fill="var(--slate)" />
    </svg>
  );
}
