/**
 * CampusConnect Client Firebase Configuration
 * Compatible with Web SDK v10 (compat mode)
 */
(function() {
    window.CAMPUS_CONNECT_FIREBASE_CONFIG = window.CAMPUS_CONNECT_FIREBASE_CONFIG || {
        apiKey: window.FIREBASE_API_KEY || "AIzaSyCampusConnectMockDevKey2026",
        authDomain: window.FIREBASE_AUTH_DOMAIN || "campusconnect-dypcoe.firebaseapp.com",
        projectId: window.FIREBASE_PROJECT_ID || "campusconnect-dypcoe",
        storageBucket: "campusconnect-dypcoe.firebasestorage.app",
        messagingSenderId: "123456789012",
        appId: "1:123456789012:web:abcdef123456"
    };

    // Determine Backend API Base URL
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    window.CAMPUS_CONNECT_API_BASE = isLocalhost
        ? "http://localhost:3000"
        : "https://campus-connect-1-0q94.onrender.com";

    window.CAMPUS_CONNECT_LF_API_BASE = isLocalhost
        ? "http://localhost:3000/api/lost-found"
        : "https://campus-connect-4n2t.onrender.com";
})();
