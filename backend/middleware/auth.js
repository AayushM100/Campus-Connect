const { initializeApp, getApps, cert, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

let firebaseInitialized = false;
let isDevMockEnabled = false;

function initFirebase() {
    if (getApps().length > 0) {
        firebaseInitialized = true;
        return;
    }

    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            let serviceAccount;
            try {
                serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            } catch {
                // Handle base64 encoded JSON
                const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf-8");
                serviceAccount = JSON.parse(decoded);
            }
            initializeApp({
                credential: cert(serviceAccount)
            });
            firebaseInitialized = true;
            console.log("[AUTH] Firebase Admin initialized with service account.");
        } else if (
            process.env.FIREBASE_PROJECT_ID &&
            process.env.FIREBASE_CLIENT_EMAIL &&
            process.env.FIREBASE_PRIVATE_KEY
        ) {
            initializeApp({
                credential: cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
                })
            });
            firebaseInitialized = true;
            console.log("[AUTH] Firebase Admin initialized with environment credentials.");
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            initializeApp({
                credential: applicationDefault()
            });
            firebaseInitialized = true;
            console.log("[AUTH] Firebase Admin initialized with applicationDefault.");
        } else {
            // Development fallback mode: allows offline testing and development without hard-coding secrets
            isDevMockEnabled = true;
            console.warn("[AUTH] Notice: Firebase credentials not found in env. Running in DEV_MOCK fallback mode.");
        }
    } catch (err) {
        console.error("[AUTH] Error initializing Firebase Admin:", err.message);
        isDevMockEnabled = true;
    }
}

initFirebase();

function isFirebaseAuthReady() {
    return firebaseInitialized;
}

/**
 * Middleware: Requires a valid Firebase ID Token in the Authorization header.
 * Sets `req.user = { uid, email, email_verified, name }`.
 */
async function verifyFirebaseToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Authentication required",
            code: "AUTH_REQUIRED"
        });
    }

    const token = authHeader.split("Bearer ")[1].trim();

    if (!token) {
        return res.status(401).json({
            error: "Token missing",
            code: "TOKEN_MISSING"
        });
    }

    if (firebaseInitialized) {
        try {
            const auth = getAuth();
            const decodedToken = await auth.verifyIdToken(token);
            req.user = {
                uid: decodedToken.uid,
                email: decodedToken.email || "",
                email_verified: Boolean(decodedToken.email_verified),
                name: decodedToken.name || ""
            };
            return next();
        } catch (error) {
            console.error("[AUTH] Token verification failed:", error.message);
            return res.status(401).json({
                error: "Invalid or expired authentication token",
                code: "TOKEN_INVALID",
                details: error.message
            });
        }
    }

    // Dev/Mock fallback when Firebase credentials are not yet configured in local environment
    if (isDevMockEnabled || process.env.NODE_ENV === "test" || process.env.ALLOW_DEV_AUTH === "true") {
        try {
            if (token.startsWith("mock_") || token.startsWith("test_")) {
                const parts = token.split("_");
                const uid = parts[1] || "mock-student-uid";
                const email = parts[2] ? decodeURIComponent(parts[2]) : `${uid}@dypcoe.edu.in`;
                req.user = {
                    uid: uid,
                    email: email,
                    email_verified: true,
                    name: "Test Student"
                };
                return next();
            }

            // Decode unverified JWT payload for local simulation if valid JWT structure
            const jwtParts = token.split(".");
            if (jwtParts.length === 3) {
                const payload = JSON.parse(Buffer.from(jwtParts[1], "base64").toString("utf-8"));
                req.user = {
                    uid: payload.user_id || payload.sub || payload.uid || "dev-user",
                    email: payload.email || "",
                    email_verified: Boolean(payload.email_verified),
                    name: payload.name || ""
                };
                return next();
            }
        } catch (e) {
            // fallthrough
        }

        return res.status(401).json({
            error: "Invalid mock token in development mode",
            code: "DEV_TOKEN_INVALID"
        });
    }

    return res.status(503).json({
        error: "Authentication service temporarily unavailable",
        code: "AUTH_UNAVAILABLE"
    });
}

/**
 * Middleware: Optional authentication.
 * If Authorization header is present and valid, attaches `req.user`.
 * If missing, `req.user = null` and proceeds without error.
 */
async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        req.user = null;
        return next();
    }

    const token = authHeader.split("Bearer ")[1].trim();
    if (!token) {
        req.user = null;
        return next();
    }

    if (firebaseInitialized) {
        try {
            const auth = getAuth();
            const decodedToken = await auth.verifyIdToken(token);
            req.user = {
                uid: decodedToken.uid,
                email: decodedToken.email || "",
                email_verified: Boolean(decodedToken.email_verified),
                name: decodedToken.name || ""
            };
        } catch (error) {
            // Invalid optional token: treat as guest
            req.user = null;
        }
        return next();
    }

    if (isDevMockEnabled || process.env.NODE_ENV === "test" || process.env.ALLOW_DEV_AUTH === "true") {
        try {
            if (token.startsWith("mock_") || token.startsWith("test_")) {
                const parts = token.split("_");
                const uid = parts[1] || "mock-student-uid";
                const email = parts[2] ? decodeURIComponent(parts[2]) : `${uid}@dypcoe.edu.in`;
                req.user = {
                    uid: uid,
                    email: email,
                    email_verified: true,
                    name: "Test Student"
                };
            } else {
                const jwtParts = token.split(".");
                if (jwtParts.length === 3) {
                    const payload = JSON.parse(Buffer.from(jwtParts[1], "base64").toString("utf-8"));
                    req.user = {
                        uid: payload.user_id || payload.sub || payload.uid || "dev-user",
                        email: payload.email || "",
                        email_verified: Boolean(payload.email_verified),
                        name: payload.name || ""
                    };
                } else {
                    req.user = null;
                }
            }
        } catch (e) {
            req.user = null;
        }
        return next();
    }

    req.user = null;
    return next();
}

module.exports = {
    getAuth,
    verifyFirebaseToken,
    optionalAuth,
    isFirebaseAuthReady
};
