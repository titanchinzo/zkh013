"use client";

import { Fragment, useState } from "react";
import { comparePersonnel } from "@/lib/hr";
import { cn } from "@/lib/utils";

const NEW = "\u0000new";
const base =
  "h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

/** Бүлэг сонгох (name="group"): байгаа бүлгүүдээс, эсвэл «+ Шинэ бүлэг…» сонгоод нэрийг нь бичнэ */
export function GroupSelect({ groups, defaultValue = "", className }: { groups: string[]; defaultValue?: string; className?: string }) {
  const [typing, setTyping] = useState(false);
  if (typing) {
    return (
      <input
        name="group"
        autoFocus
        maxLength={120}
        placeholder="Шинэ бүлгийн нэр (алба, рот…)"
        aria-label="Шинэ бүлэг"
        className={cn(base, className)}
      />
    );
  }
  const options = defaultValue && !groups.includes(defaultValue) ? [...groups, defaultValue] : groups;
  return (
    <select
      name="group"
      defaultValue={defaultValue}
      aria-label="Бүлэг"
      onChange={(e) => e.target.value === NEW && setTyping(true)}
      className={cn(base, className)}
    >
      <option value="">Бүлэггүй</option>
      {options.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
      <option value={NEW}>+ Шинэ бүлэг…</option>
    </select>
  );
}

type Selectable = { _id: string; rank: string; name: string; group?: string };

/** Хүн сонгох <option>-ууд бүлгээр нь (<optgroup>) — олон зуун хүнээс хурдан олно */
export function PersonOptions<P extends Selectable>({
  people,
  groups,
  label,
}: {
  people: P[];
  groups: string[];
  label: (p: P) => string;
}) {
  const buckets = new Map<string, P[]>();
  for (const p of [...people].sort(comparePersonnel(groups))) {
    const key = p.group ?? "";
    buckets.set(key, [...(buckets.get(key) ?? []), p]);
  }
  const grouped = [...buckets.keys()].some(Boolean);
  return (
    <>
      {[...buckets].map(([group, list]) => {
        const options = list.map((p) => (
          <option key={p._id} value={p._id}>
            {label(p)}
          </option>
        ));
        return grouped ? (
          <optgroup key={group || "-"} label={group || "Бүлэггүй"}>
            {options}
          </optgroup>
        ) : (
          <Fragment key="-">{options}</Fragment>
        );
      })}
    </>
  );
}
