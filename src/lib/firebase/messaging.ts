import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { firebaseApp } from "./client";

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    if (!("Notification" in window)) {
      console.warn("This browser does not support desktop notification");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const supported = await isSupported();
      if (!supported) {
        console.warn("Firebase Messaging is not supported in this browser.");
        return null;
      }

      const messaging = getMessaging(firebaseApp());
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      
      const token = await getToken(messaging, { vapidKey });
      return token;
    }
  } catch (error) {
    console.error("An error occurred while retrieving token.", error);
  }
  return null;
}

export async function setupForegroundMessaging(): Promise<(() => void) | void> {
  try {
    const supported = await isSupported();
    if (!supported) return;

    const messaging = getMessaging(firebaseApp());
    
    return onMessage(messaging, (payload) => {
      console.log("Received foreground message ", payload);
      
      const notificationTitle = payload.notification?.title || "New Activity";
      const notificationOptions = {
        body: payload.notification?.body,
        icon: "/favicon.ico",
        data: payload.data
      };

      if (Notification.permission === "granted") {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(notificationTitle, notificationOptions);
        });
      }
    });
  } catch (err) {
    console.error("Foreground messaging setup failed:", err);
  }
}
