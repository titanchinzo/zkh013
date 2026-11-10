// Зарлан мэдээллийн аппын service worker: серверээс ирсэн мэдэгдлийг утсан дээр харуулж, дарахад аппыг нээнэ.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "013 анги", {
      body: data.body || "",
      icon: "/app-icon-192.png",
      badge: "/app-icon-192.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      data: { url: data.url || "/app" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/app", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(url));
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
