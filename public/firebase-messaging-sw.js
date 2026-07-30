importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

let messaging = null;

async function initFirebase() {
  if (messaging) return messaging;
  try {
    const res = await fetch("/api/firebase-config");
    const config = await res.json();
    if (!config.projectId) {
      console.warn("FCM: No project ID in config");
      return null;
    }
    const app = firebase.initializeApp(config);
    messaging = firebase.messaging(app);

    // This handles messages received while the app is in the background
    messaging.onBackgroundMessage((payload) => {
      console.log("[firebase-messaging-sw.js] Received background message ", payload);
      
      const notificationTitle = payload.notification?.title || "New Activity";
      const notificationOptions = {
        body: payload.notification?.body,
        icon: "/favicon.ico",
        // Pass the URL to open when clicked
        data: payload.data
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });

    return messaging;
  } catch (error) {
    console.error("Failed to initialize FCM in service worker", error);
    return null;
  }
}

// Initialize as soon as the service worker evaluates
initFirebase();

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url;
  
  if (urlToOpen) {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((windowClients) => {
        // Check if there is already a window/tab open with the target URL
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          // If so, just focus it.
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        // If not, then open the target URL in a new window/tab.
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
    );
  }
});
