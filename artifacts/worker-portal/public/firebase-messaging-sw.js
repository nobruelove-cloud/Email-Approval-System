importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Parse Firebase configuration from query parameters if passed during SW registration
const urlParams = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: urlParams.get('apiKey') || '',
  authDomain: urlParams.get('authDomain') || '',
  projectId: urlParams.get('projectId') || '',
  storageBucket: urlParams.get('storageBucket') || '',
  messagingSenderId: urlParams.get('messagingSenderId') || '',
  appId: urlParams.get('appId') || '',
};

if (firebaseConfig.projectId && firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
} else if (firebase.apps.length === 0) {
  try {
    firebase.initializeApp();
  } catch (e) {
    console.warn('[firebase-messaging-sw.js] Initializing default app without config:', e);
  }
}

let messaging;
try {
  messaging = firebase.messaging();
} catch (e) {
  console.warn('[firebase-messaging-sw.js] Failed to initialize messaging:', e);
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    const notificationTitle = payload?.notification?.title || payload?.data?.title || 'Notifikasi Baru';
    const notificationOptions = {
      body: payload?.notification?.body || payload?.data?.body || '',
      icon: payload?.notification?.icon || '/android-chrome-192x192.png',
      vibrate: [],
      silent: true,
      data: payload?.data || {},
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}
