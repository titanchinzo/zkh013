"use client";

import { useState } from "react";
import { Input, Textarea } from "@/components/ui/input";
import { CONTACT_LIMITS } from "@/lib/contact";
import { cn } from "@/lib/utils";

export type ContactLabels = {
  name: string;
  email: string;
  subject: string;
  message: string;
  namePlaceholder: string;
  subjectPlaceholder: string;
  messagePlaceholder: string;
  submit: string;
  sending: string;
  sent: string;
  error: string;
};

/** Холбоо барих форм (MGL горимд шошго нь талбарынхаа зүүн талд босоо) */
export function ContactForm({ labels, vertical }: { labels: ContactLabels; vertical?: boolean }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // await-ийн дараа e.currentTarget нь null болдог тул формыг урьдчилан авна
    const formElement = e.currentTarget;
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(formElement))),
      });
      if (res.ok) formElement.reset();
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  const fields = [
    {
      label: labels.name,
      control: (
        <Input name="name" maxLength={CONTACT_LIMITS.name} placeholder={vertical ? undefined : labels.namePlaceholder} required />
      ),
    },
    {
      label: labels.email,
      control: <Input type="email" name="email" maxLength={CONTACT_LIMITS.email} placeholder="your@email.com" required />,
    },
    {
      label: labels.subject,
      control: (
        <Input
          name="subject"
          maxLength={CONTACT_LIMITS.subject}
          placeholder={vertical ? undefined : labels.subjectPlaceholder}
          required
        />
      ),
    },
    {
      label: labels.message,
      control: (
        <Textarea
          name="message"
          maxLength={CONTACT_LIMITS.message}
          placeholder={vertical ? undefined : labels.messagePlaceholder}
          required
        />
      ),
    },
  ];
  // Спам бот илрүүлэх нууц талбар — хүнд харагдахгүй, бөглөгдвөл сервер зурвасыг хадгалахгүй
  const honeypot = <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />;
  const statusText =
    status === "sent" ? labels.sent : status === "error" ? labels.error : null;

  if (vertical) {
    return (
      <form className="flex flex-row gap-4" onSubmit={handleSubmit}>
        {honeypot}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {fields.map((field) => (
            <label key={field.label} className="flex min-h-24 flex-row items-center gap-3">
              <span className="mgl-v shrink-0 text-sm text-foreground">{field.label}</span>
              <span className="min-w-0 flex-1">{field.control}</span>
            </label>
          ))}
        </div>
        <div className="flex shrink-0 flex-row gap-2">
          <button
            type="submit"
            disabled={status === "sending"}
            className="mgl-v rounded-md bg-primary px-3 py-6 text-base text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {status === "sending" ? labels.sending : labels.submit}
          </button>
          {statusText && (
            <p className={cn("mgl-v text-sm", status === "sent" ? "text-primary" : "text-red-400")}>{statusText}</p>
          )}
        </div>
      </form>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {honeypot}
      {fields.map((field) => (
        <div key={field.label}>
          <label className="block text-sm font-semibold text-foreground mb-2">{field.label}</label>
          {field.control}
        </div>
      ))}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full h-10 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:opacity-50"
      >
        {status === "sending" ? labels.sending : labels.submit}
      </button>
      {statusText && (
        <p className={cn("text-sm text-center", status === "sent" ? "text-primary" : "text-red-400")}>{statusText}</p>
      )}
    </form>
  );
}
