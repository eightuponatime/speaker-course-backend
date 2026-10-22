import { useId } from "react";

export function UmbraLogo({ size = 30 }: { size?: number }) {
  const clipId = useId();

  return (
    <svg width={size} height={size} viewBox="0 0 260 260" aria-hidden="true">
      <defs><clipPath id={clipId}><circle cx="130" cy="130" r="108" /></clipPath></defs>
      <circle cx="130" cy="130" r="108" fill="#C8102E" />
      <circle cx="130" cy="104" r="112" fill="#0A0A0B" clipPath={`url(#${clipId})`} />
      <circle cx="130" cy="130" r="108" fill="none" stroke="#EDE8DF" strokeWidth="10" />
    </svg>
  );
}
