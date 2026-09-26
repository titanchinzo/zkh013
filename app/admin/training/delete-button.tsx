"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteTrainingButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!confirm("Энэ материалыг устгах уу? Оруулсан файл нь мөн устана.")) return;
    setDeleting(true);
    const res = await fetch(`/api/training/${id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      alert("Устгаж чадсангүй");
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={remove}
      disabled={deleting}
      className="px-3 py-1.5 text-xs font-semibold rounded-md border border-red-400/40 text-red-400 disabled:opacity-50"
    >
      {deleting ? "Устгаж байна..." : "Устгах"}
    </button>
  );
}
