// Service worker do Portal Escolar: recebe os avisos (Web Push) mesmo com o site fechado.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Novo comunicado", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/comunicados" },
    }),
  );
});

// Tocar no aviso abre (ou traz para frente) a tela de comunicados
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/comunicados";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ("focus" in janela) {
          if ("navigate" in janela) janela.navigate(url).catch(() => {});
          return janela.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
