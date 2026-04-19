// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyA1Vdo9i5uSfZCtfxpQCQINKWYYq8is7Rs",
  authDomain: "mirza-4612a.firebaseapp.com",
  projectId: "mirza-4612a",
  storageBucket: "mirza-4612a.firebasestorage.app",
  messagingSenderId: "140016070482",
  appId: "1:140016070482:web:1fafc0c490e2edc165548b",
  measurementId: "G-0XHBEYNMNF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// روش جدید برای فعال‌سازی persistence
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});