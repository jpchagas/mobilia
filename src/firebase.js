import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Fill these in from your Firebase project settings (Project settings > General > Your apps).
// Keep this file safe to commit — these are public client identifiers, not secrets —
// but never commit your Firebase Admin/service-account keys anywhere in this repo.
const firebaseConfig = {
  apiKey: "AIzaSyDlxe8hc8fwW0j9M8Ve4cKDrqAT0USJTa0",
  authDomain: "mobilia-99550.firebaseapp.com",
  projectId: "mobilia-99550",
  storageBucket: "mobilia-99550.firebasestorage.app",
  messagingSenderId: "112692801261",
  appId: "1:112692801261:web:bce0471f657087734f66e4"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
