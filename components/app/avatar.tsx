"use client";

import Image from "next/image";

/** Профайл зураг эсвэл нэрийн эхний үсэг. online өгвөл баруун доод буланд ногоон цэг (идэвхтэй) */
export function Avatar({
  person,
  size = 56,
  online,
}: {
  person: { name: string; photo?: string };
  size?: number;
  online?: boolean;
}) {
  const face = person.photo ? (
    <Image
      src={person.photo}
      alt=""
      width={size}
      height={size}
      unoptimized
      className="rounded-full object-cover border border-border shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="rounded-full bg-muted text-foreground font-bold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {person.name.trim().charAt(0).toUpperCase()}
    </span>
  );
  if (online === undefined) return face;
  const dot = Math.max(10, Math.round(size / 4));
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {face}
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full bg-green-500 ring-2 ring-background"
          style={{ width: dot, height: dot }}
          role="img"
          aria-label="Идэвхтэй"
        />
      )}
    </span>
  );
}
