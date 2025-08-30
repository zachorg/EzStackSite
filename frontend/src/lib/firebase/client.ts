let initializedApp: import("firebase/app").FirebaseApp | null = null;

function getConfig() {
  const config: import("firebase/app").FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  };
  return config;
}

export async function getClientAuth() {
  if (typeof window === "undefined") {
    throw new Error("getClientAuth can only be called in the browser");
  }
  const { initializeApp, getApps } = await import("firebase/app");
  const { getAuth } = await import("firebase/auth");
  if (!initializedApp) {
    const cfg = getConfig();
    initializedApp = getApps().length
      ? (getApps()[0]! as import("firebase/app").FirebaseApp)
      : initializeApp(cfg);
  }
  return getAuth(initializedApp!);
}

export async function getGoogleProvider() {
  const { GoogleAuthProvider } = await import("firebase/auth");
  return new GoogleAuthProvider();
}


