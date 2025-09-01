import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let app: App | undefined;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

if (!getApps().length) {
  const projectId = getRequiredEnv("FIREBASE_PROJECT_ID").trim();
  const clientEmail = getRequiredEnv("FIREBASE_CLIENT_EMAIL").trim();
  const rawPrivateKey = getRequiredEnv("FIREBASE_PRIVATE_KEY");
  const privateKey = rawPrivateKey
    // Convert literal \n to newlines
    .replace(/\\n/g, "\n")
    // Trim surrounding quotes if present
    .replace(/^"([\s\S]*)"$/m, "$1")
    .replace(/^'([\s\S]*)'$/m, "$1");

  app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
} else {
  app = getApps()[0] as App;
}

export const adminAuth = getAuth(app);
export const db = getFirestore(app);


