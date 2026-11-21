"use client";

import { useCallback, useEffect, useState } from "react";
import { todayUb, weekStart } from "@/lib/hr";

// Харуул хоногийн манааны 7 хоногийн (Даваа–Ням) хуваарь: ачаалах, өдөр бүрийн хүмүүсийг өөрчлөх, хадгалах.
// Хүний нөөцийн вэб хуудас (/admin/duty) болон утсан дээрх апп хоёулаа ашиглана.

export type DutyPerson = { _id: string; rank: string; name: string; position: string; group?: string; active: boolean };
export type DutyWeekData = {
  weekStart: string;
  week: { date: string; duty: string[]; reminded: string[] }[];
  personnel: DutyPerson[];
  groups: string[];
};

const UNSAVED = "Хадгалаагүй өөрчлөлт байна. Орхих уу?";

export function useDutyWeek() {
  const [start, setStart] = useState(() => weekStart(todayUb()));
  const [data, setData] = useState<DutyWeekData | null>(null);
  const [duty, setDuty] = useState<Record<string, string[]>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const load = useCallback(async (from: string) => {
    const res = await fetch(`/api/hr/days/${from}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setMessage({ text: "Хуваарийг ачаалж чадсангүй", error: true });
      return;
    }
    const d: DutyWeekData = await res.json();
    setData(d);
    setDuty(Object.fromEntries(d.week.map((w) => [w.date, w.duty])));
    setDirty(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the shown week
    load(start);
  }, [start, load]);

  /** Хадгалаагүй өөрчлөлттэй бол асууна — орхиж болох эсэх */
  const canLeave = () => !dirty || confirm(UNSAVED);

  function go(from: string) {
    if (from === start || !canLeave()) return;
    setMessage(null);
    setStart(from);
  }

  function change(date: string, ids: string[]) {
    setDuty((current) => ({ ...current, [date]: ids }));
    setDirty(true);
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/hr/days/${start}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duty }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setMessage({ text: (await res?.json().catch(() => null))?.error ?? "Алдаа гарлаа", error: true });
      return;
    }
    await load(start);
    setMessage({ text: "Хадгаллаа. Шинээр томилогдсон хүмүүсийн утсанд мэдэгдэл очно.", error: false });
  }

  // Өөр 7 хоног руу шилжсэний дараа хуучин өгөгдлийг харуулахгүй
  const ready = data?.weekStart === start ? data : null;
  return { start, ready, duty, dirty, saving, message, go, change, save, canLeave };
}
