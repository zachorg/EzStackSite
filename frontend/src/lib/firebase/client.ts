let initializedApp: import("firebase/app").FirebaseApp | null = null;

function getConfig(): import("firebase/app").FirebaseOptions {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !authDomain || !projectId) {
    const missing = [
      !apiKey ? "NEXT_PUBLIC_FIREBASE_API_KEY" : null,
      !authDomain ? "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" : null,
      !projectId ? "NEXT_PUBLIC_FIREBASE_PROJECT_ID" : null,
    ].filter(Boolean);
    throw new Error(
      `Firebase client config missing: ${missing.join(", ")}. Check your environment variables.`
    );
  }

  return { apiKey, authDomain, projectId };
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

