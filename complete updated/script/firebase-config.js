// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

const storageBucket = "mirza-4612a.appspot.com";

const firebaseConfig = {
  apiKey: "AIzaSyA1Vdo9i5uSfZCtfxpQCQINKWYYq8is7Rs",
  authDomain: "mirza-4612a.firebaseapp.com",
  projectId: "mirza-4612a",
  storageBucket,
  messagingSenderId: "140016070482",
  appId: "1:140016070482:web:1fafc0c490e2edc165548b",
  measurementId: "G-0XHBEYNMNF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app, `gs://${storageBucket}`);

// روش جدید برای فعال سازی persistence
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});
