/**
 * CampusConnect Shared Authentication Service
 * Wraps Firebase Web Auth and connects with Node.js backend.
 */
(function() {
    let authInitialized = false;
    let authStateListeners = [];
    let currentUser = null;
    let mockMode = false;

    function getApiBase() {
        return window.CAMPUS_CONNECT_API_BASE || "https://campus-connect-1-0q94.onrender.com";
    }

    function getLostFoundApiBase() {
        return window.CAMPUS_CONNECT_LF_API_BASE || "https://campus-connect-4n2t.onrender.com";
    }

    function initFirebase() {
        if (authInitialized) return;

        if (typeof window.firebase !== "undefined" && window.firebase.apps && window.CAMPUS_CONNECT_FIREBASE_CONFIG) {
            try {
                if (!window.firebase.apps.length) {
                    window.firebase.initializeApp(window.CAMPUS_CONNECT_FIREBASE_CONFIG);
                }
                const auth = window.firebase.auth();
                auth.onAuthStateChanged(function(user) {
                    currentUser = user;
                    if (user) {
                        localStorage.setItem("campusConnect_uid", user.uid);
                        localStorage.setItem("campusConnect_email", user.email || "");
                        // Sync guest favourites automatically on sign in
                        CampusAuth.syncGuestFavourites().catch(function(e) {
                            console.warn("Auto-sync favourites notice:", e);
                        });
                    } else {
                        localStorage.removeItem("campusConnect_uid");
                        localStorage.removeItem("campusConnect_email");
                    }
                    notifyListeners(user);
                });
                authInitialized = true;
                return;
            } catch (err) {
                console.warn("[CampusAuth] Real Firebase init notice:", err.message);
            }
        }

        // Mock fallback mode if Firebase CDN fails or offline
        mockMode = true;
        authInitialized = true;
        const savedMockUid = localStorage.getItem("campusConnect_mock_uid");
        if (savedMockUid) {
            currentUser = {
                uid: savedMockUid,
                email: localStorage.getItem("campusConnect_mock_email") || `${savedMockUid}@dypcoe.edu.in`,
                displayName: localStorage.getItem("studentName") || "Student",
                getIdToken: function() {
                    return Promise.resolve(`test_${savedMockUid}_${encodeURIComponent(currentUser.email)}`);
                }
            };
        }
        setTimeout(function() {
            notifyListeners(currentUser);
        }, 50);
    }

    function notifyListeners(user) {
        authStateListeners.forEach(function(listener) {
            try {
                listener(user);
            } catch (e) {
                console.error("Auth listener error:", e);
            }
        });
    }

    const CampusAuth = {
        init: function() {
            initFirebase();
        },

        getCurrentUser: function() {
            return currentUser;
        },

        isLoggedIn: function() {
            return Boolean(currentUser);
        },

        onAuthStateChanged: function(callback) {
            authStateListeners.push(callback);
            if (authInitialized) {
                callback(currentUser);
            }
            return function() {
                authStateListeners = authStateListeners.filter(function(cb) { return cb !== callback; });
            };
        },

        getIdToken: async function() {
            if (!currentUser) return null;
            if (currentUser.getIdToken) {
                return await currentUser.getIdToken();
            }
            return `test_${currentUser.uid}_${encodeURIComponent(currentUser.email || "student@dypcoe.edu.in")}`;
        },

        signIn: async function(email, password) {
            initFirebase();
            if (window.firebase && window.firebase.auth && !mockMode) {
                try {
                    const result = await window.firebase.auth().signInWithEmailAndPassword(email, password);
                    currentUser = result.user;
                    localStorage.setItem("studentName", (currentUser.displayName || email.split("@")[0]));
                    return { success: true, user: currentUser };
                } catch (err) {
                    console.warn("Firebase signin failed, trying dev fallback if applicable:", err.message);
                    if (err.code === "auth/network-request-failed" || err.code === "auth/invalid-api-key") {
                        // Switch to dev fallback for testing
                        mockMode = true;
                    } else {
                        throw err;
                    }
                }
            }

            // Dev mock login
            const cleanUid = email.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
            const displayName = email.split("@")[0];
            currentUser = {
                uid: cleanUid,
                email: email,
                displayName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
                getIdToken: function() {
                    return Promise.resolve(`test_${cleanUid}_${encodeURIComponent(email)}`);
                }
            };
            localStorage.setItem("campusConnect_mock_uid", cleanUid);
            localStorage.setItem("campusConnect_mock_email", email);
            localStorage.setItem("studentName", currentUser.displayName);
            notifyListeners(currentUser);
            return { success: true, user: currentUser };
        },

        signUp: async function(email, password, displayName) {
            initFirebase();
            if (window.firebase && window.firebase.auth && !mockMode) {
                try {
                    const result = await window.firebase.auth().createUserWithEmailAndPassword(email, password);
                    if (displayName && result.user.updateProfile) {
                        await result.user.updateProfile({ displayName: displayName });
                    }
                    if (result.user.sendEmailVerification) {
                        result.user.sendEmailVerification().catch(function() {});
                    }
                    currentUser = result.user;
                    localStorage.setItem("studentName", displayName || email.split("@")[0]);
                    return { success: true, user: currentUser };
                } catch (err) {
                    console.warn("Firebase signup failed, trying dev fallback if applicable:", err.message);
                    if (err.code === "auth/network-request-failed" || err.code === "auth/invalid-api-key") {
                        mockMode = true;
                    } else {
                        throw err;
                    }
                }
            }

            // Dev mock signup
            const cleanUid = email.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
            currentUser = {
                uid: cleanUid,
                email: email,
                displayName: displayName || (email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1)),
                getIdToken: function() {
                    return Promise.resolve(`test_${cleanUid}_${encodeURIComponent(email)}`);
                }
            };
            localStorage.setItem("campusConnect_mock_uid", cleanUid);
            localStorage.setItem("campusConnect_mock_email", email);
            localStorage.setItem("studentName", currentUser.displayName);
            notifyListeners(currentUser);
            return { success: true, user: currentUser };
        },

        sendPasswordReset: async function(email) {
            initFirebase();
            if (window.firebase && window.firebase.auth && !mockMode) {
                return await window.firebase.auth().sendPasswordResetEmail(email);
            }
            return Promise.resolve();
        },

        signOut: async function() {
            initFirebase();
            if (window.firebase && window.firebase.auth && !mockMode) {
                await window.firebase.auth().signOut();
            }
            currentUser = null;
            localStorage.removeItem("campusConnect_mock_uid");
            localStorage.removeItem("campusConnect_mock_email");
            localStorage.removeItem("campusConnect_uid");
            localStorage.removeItem("campusConnect_email");
            localStorage.removeItem("studentName");
            notifyListeners(null);
            return { success: true };
        },

        syncGuestFavourites: async function() {
            if (!currentUser) return { synced: 0 };
            const visitorId = localStorage.getItem("campusBites_visitorId") || localStorage.getItem("visitorId") || "";
            if (!visitorId) return { synced: 0 };

            const token = await this.getIdToken();
            if (!token) return { synced: 0 };

            try {
                const res = await fetch(`${getApiBase()}/api/favourites/sync`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ visitorId: visitorId })
                });
                if (res.ok) {
                    const data = await res.json();
                    return data;
                }
            } catch (e) {
                console.warn("[CampusAuth] Favourites sync notice:", e.message);
            }
            return { synced: 0 };
        },

        fetchProfile: async function() {
            const token = await this.getIdToken();
            if (!token) return null;

            const res = await fetch(`${getApiBase()}/api/auth/profile`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error("Could not load profile");
            return await res.json();
        },

        updateProfile: async function(profileData) {
            const token = await this.getIdToken();
            if (!token) throw new Error("Authentication required");

            const res = await fetch(`${getApiBase()}/api/auth/profile`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(profileData)
            });
            if (!res.ok) throw new Error("Could not update profile");
            return await res.json();
        },

        fetchMyOrders: async function() {
            const token = await this.getIdToken();
            if (!token) return { orders: [] };

            const res = await fetch(`${getApiBase()}/api/orders/my-orders`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error("Could not load orders");
            return await res.json();
        },

        fetchMyReports: async function() {
            const token = await this.getIdToken();
            if (!token) return { lost: [], found: [] };

            const res = await fetch(`${getLostFoundApiBase()}/my-reports`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error("Could not load your reports");
            return await res.json();
        },

        deleteReport: async function(id, type) {
            const token = await this.getIdToken();
            if (!token) throw new Error("Authentication required");

            const res = await fetch(`${getLostFoundApiBase()}/item/${id}?type=${encodeURIComponent(type || "")}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Could not delete report");
            }
            return data;
        },

        deleteAccount: async function() {
            const token = await this.getIdToken();
            if (!token) throw new Error("Authentication required");

            const res = await fetch(`${getApiBase()}/api/auth/delete-account`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error("Could not delete account data");
            await this.signOut();
            return { success: true };
        }
    };

    window.CampusAuth = CampusAuth;
    // Auto-init on page load
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function() { CampusAuth.init(); });
    } else {
        CampusAuth.init();
    }
})();
