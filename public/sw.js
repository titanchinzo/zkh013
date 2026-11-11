// Утсан дээрх аппын service worker: серверээс ирсэн мэдэгдлийг (зарлан мэдээлэл, харуулын сануулга, чатын зурвас)
// утсан дээр харуулж, дарахад аппын тухайн хэсгийг нээнэ.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const chat = data.kind === "chat";
  // Чатын зурвас, мэдээний хяналт — бусад аппынх шиг энгийн мэдэгдэл
  const quiet = chat || data.kind === "news";
  const tasks = [
    self.registration.showNotification(data.title || "013 анги", {
      body: data.body || "",
      icon: (chat && data.icon) || "/app-icon-192.png",
      badge: "/app-icon-192.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      // Зарлан мэдээлэл дарах хүртэл дэлгэц дээр үлдэнэ; чатын зурвас, мэдээ бусад аппынх шиг өөрөө алга болно
      requireInteraction: !quiet,
      vibrate: quiet ? [200, 100, 200] : [300, 100, 300, 100, 300],
      timestamp: Date.now(),
      data: { url: data.url || "/app" },
    }),
  ];
  // Аппын дүрс дээрх уншаагүй зурвасын тоо
  if (chat && typeof data.badge === "number" && self.navigator.setAppBadge) {
    tasks.push(self.navigator.setAppBadge(data.badge).catch(() => {}));
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/app", self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Апп нээлттэй бол түүн рүү шилжиж, тухайн хэсгийг (жишээ нь чатыг) нээлгэнэ
      const app = windows.find((w) => new URL(w.url).pathname === "/app");
      if (!app) return self.clients.openWindow(url.href);
      app.postMessage({ type: "open", url: url.pathname + url.search });
      return app.focus();
    })
  );
});
