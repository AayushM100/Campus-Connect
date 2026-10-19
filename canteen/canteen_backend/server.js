"use strict";

// ======================================================
// 1. IMPORTS AND CONFIGURATION
// ======================================================

require("dotenv").config();

const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const DB_NAME = process.env.DB_NAME || "campus_canteen";
const DB_PORT = Number(process.env.DB_PORT) || 3306;

if (!/^[a-zA-Z0-9_]+$/.test(DB_NAME)) {
    throw new Error("Invalid DB_NAME configuration.");
}

if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD) {
    console.error("Missing DB_HOST, DB_USER, or DB_PASSWORD environment variable.");
}

app.use(cors());
app.use(express.json());

app.use(
    "/food-images",
    express.static(path.join(__dirname, "food-images"))
);

// ======================================================
// 2. MYSQL CONNECTION POOL
// ======================================================

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT,

    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,

    ...(process.env.DB_SSL === "true"
        ? { ssl: { rejectUnauthorized: false } }
        : {})
});

// Prevent unhandled 'error' events from crashing the process.
db.on("error", (err) => {
    console.error("Pool connection error:", err.code || "UNKNOWN", err.message);
});

function logDatabaseError(label, err) {
    console.error(label, {
        code: err.code || "UNKNOWN",
        errno: err.errno || null,
        message: err.message || "No error message"
    });
}

// Use the pool for every query.
// Do not manually close the pool while the server is running.
const POOL_ERRORS = new Set([
    "ECONNRESET",
    "PROTOCOL_CONNECTION_LOST",
    "EPIPE",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ER_CON_COUNT_ERROR"
]);

async function query(sql, params = []) {
    try {
        const [rows] = await db.execute(sql, params);
        return rows;
    } catch (err) {
        // Retry once if it's a connection-level error
        if (POOL_ERRORS.has(err.code)) {
            console.warn(
                "Connection error, retrying:",
                err.code
            );
            const [rows] = await db.execute(sql, params);
            return rows;
        }
        throw err;
    }
}   

// ======================================================
// 3. CANTEEN CONFIGURATION
// ======================================================

const canteens = {
    cafeteria: {
        name: "Cafeteria",
        table: "campus_cafeteria"
    },
    timeless: {
        name: "Timeless",
        table: "cafe_timeless"
    },
    nescafe: {
        name: "Nescafe",
        table: "nescafe"
    }
};

function getCanteen(id) {
    return canteens[String(id || "").toLowerCase()];
}

function getVisitorId(body) {
    return String(body?.visitorId ?? body?.visitor_id ?? "").trim();
}

function getItemId(body) {
    return String(body?.item_id ?? body?.itemId ?? "").trim();
}

// ======================================================
// 4. COMMON MENU QUERY
// ======================================================

function menuUnionSql() {
    return `
        SELECT
            CAST(item_id AS CHAR) AS item_id,
            item_name,
            category,
            price,
            availability,
            description,
            'cafeteria' AS canteen
        FROM \`${DB_NAME}\`.campus_cafeteria

        UNION ALL

        SELECT
            CAST(item_id AS CHAR) AS item_id,
            item_name,
            category,
            price,
            availability,
            description,
            'timeless' AS canteen
        FROM \`${DB_NAME}\`.cafe_timeless

        UNION ALL

        SELECT
            CAST(item_id AS CHAR) AS item_id,
            item_name,
            category,
            price,
            availability,
            description,
            'nescafe' AS canteen
        FROM \`${DB_NAME}\`.nescafe
    `;
}

// ======================================================
// 5. ERROR HANDLER FOR ASYNC ROUTES
// ======================================================

function handleRouteError(label, res, err) {
    logDatabaseError(label, err);

    if (!res.headersSent) {
        res.status(500).json({
            error: "Database request failed",
            code: err.code || "UNKNOWN",
            details: err.message || "Unknown database error"
        });
    }
}

// ======================================================
// 6. HOME AND HEALTH
// ======================================================

app.get("/", (req, res) => {
    res.json({
        message: "Campus Connect Canteens Backend is running!"
    });
});

app.get("/health", async (req, res) => {
    try {
        const rows = await query(
            "SELECT DATABASE() AS databaseName"
        );

        res.json({
            status: "ok",
            database: rows[0].databaseName
        });
    } catch (err) {
        logDatabaseError("Health check database error:", err);

        res.status(503).json({
            status: "error",
            code: err.code || "UNKNOWN",
            message: err.message || "Database connection failed"
        });
    }
});

// ======================================================
// 7. GET CANTEENS
// ======================================================

app.get("/api/canteens", (req, res) => {
    res.json(
        Object.entries(canteens).map(([id, canteen]) => ({
            id,
            name: canteen.name
        }))
    );
});


// Route 1: Get ALL menu items (used by Browse Cuisine / menu.html)
app.get("/api/menu", async (req, res) => {
    try {
        const rows = await query(`
            SELECT
                id,
                canteen,
                item_name AS name,
                category,
                price,
                availability,
                description,
                is_available
            FROM \`${process.env.DB_NAME}\`.menu_items
            ORDER BY id
        `);
        res.json(rows);
    } catch (err) {
        handleRouteError("Main menu query failed:", res, err);
    }
});

// Route 2: Get menu items for a specific canteen
app.get("/api/menu/:canteen", async (req, res) => {
    const canteenInfo = getCanteen(req.params.canteen);

    if (!canteenInfo) {
        return res.status(404).json({ error: "Canteen not found" });
    }

    try {
        const rows = await query(`
            SELECT
                id,
                canteen,
                item_name AS name,
                category,
                price,
                availability,
                description,
                is_available
            FROM \`${process.env.DB_NAME}\`.menu_items
            WHERE canteen = ?
            ORDER BY id
        `, [req.params.canteen]);

        res.json(rows);
    } catch (err) {
        handleRouteError("Canteen menu query failed:", res, err);
    }
});

// ======================================================
// 10. GET ONE MENU ITEM
// ======================================================

app.get("/api/item/:canteen/:id", async (req, res) => {
    const canteenInfo = getCanteen(req.params.canteen);

    if (!canteenInfo) {
        return res.status(404).json({
            error: "Canteen not found"
        });
    }

    try {
        const rows = await query(`
            SELECT
                id,
                canteen,
                item_name AS name,
                category,
                price,
                availability,
                description,
                is_available
            FROM \`${process.env.DB_NAME}\`.menu_items
            ORDER BY id`);

        if (rows.length === 0) {
            return res.status(404).json({
                error: "Item not found"
            });
        }

        res.json(rows[0]);
    } catch (err) {
        handleRouteError("Item query failed:", res, err);
    }
});
// ======================================================
// 11. ADD A FOOD FAVOURITE
// POST /api/favourites
// ======================================================

app.post("/api/favourites", async (req, res) => {
    const visitorId = getVisitorId(req.body);
    const canteenId = String(req.body?.canteen || "").toLowerCase();
    const itemId = getItemId(req.body);
    const canteen = getCanteen(canteenId);

    if (
        !visitorId ||
        visitorId.length > 100 ||
        !canteen ||
        !itemId ||
        itemId.length > 100
    ) {
        return res.status(400).json({
            error: "Valid visitorId, canteen and item_id are required"
        });
    }

    try {
        const items = await query(`
            SELECT item_id
            FROM \`${DB_NAME}\`.\`${canteen.table}\`
            WHERE item_id = ?
            LIMIT 1
        `, [itemId]);

        if (items.length === 0) {
            return res.status(404).json({
                error: "Menu item not found"
            });
        }

        const result = await query(`
            INSERT IGNORE INTO \`${DB_NAME}\`.food_favourites
                (visitor_id, canteen, item_id)
            VALUES (?, ?, ?)
        `, [visitorId, canteenId, itemId]);

        res.json({
            success: true,
            favourited: true,
            alreadyFavourited: result.affectedRows === 0
        });
    } catch (err) {
        handleRouteError("Saving favourite failed:", res, err);
    }
});

// ======================================================
// 12. GET A VISITOR'S FAVOURITES
// ======================================================

app.get("/api/favourites/:visitorId", async (req, res) => {
    const visitorId = String(req.params.visitorId || "").trim();

    if (!visitorId || visitorId.length > 100) {
        return res.status(400).json({
            error: "Valid visitor ID is required"
        });
    }

    try {
        const rows = await query(`
            SELECT canteen, item_id
            FROM \`${DB_NAME}\`.food_favourites
            WHERE visitor_id = ?
        `, [visitorId]);

        res.json(rows);
    } catch (err) {
        handleRouteError("Loading favourites failed:", res, err);
    }
});

// ======================================================
// 13. REMOVE A FOOD FAVOURITE
// DELETE /api/favourites
// ======================================================

app.delete("/api/favourites", async (req, res) => {
    const visitorId = getVisitorId(req.body);
    const canteenId = String(req.body?.canteen || "").toLowerCase();
    const itemId = getItemId(req.body);

    if (
        !visitorId ||
        visitorId.length > 100 ||
        !getCanteen(canteenId) ||
        !itemId ||
        itemId.length > 100
    ) {
        return res.status(400).json({
            error: "Valid visitorId, canteen and item_id are required"
        });
    }

    try {
        const result = await query(`
            DELETE FROM \`${DB_NAME}\`.food_favourites
            WHERE visitor_id = ?
              AND canteen = ?
              AND item_id = ?
        `, [visitorId, canteenId, itemId]);

        res.json({
            success: true,
            favourited: false,
            removed: result.affectedRows > 0
        });
    } catch (err) {
        handleRouteError("Removing favourite failed:", res, err);
    }
});

// ======================================================
// 14. GET FAVOURITE COUNTS
// ======================================================

app.get("/api/favourites/counts", async (req, res) => {
    try {
        const rows = await query(`
            SELECT
                canteen,
                item_id,
                COUNT(*) AS favourite_count
            FROM \`${DB_NAME}\`.food_favourites
            GROUP BY canteen, item_id
        `);

        res.json(rows);
    } catch (err) {
        handleRouteError("Favourite counts failed:", res, err);
    }
});

// ======================================================
// 15. GET TOP FAVOURITED DISH
// ======================================================

app.get("/api/favourites/top", async (req, res) => {
    try {
        const rows = await query(`
            SELECT
                menu.*,
                COALESCE(f.favourite_count, 0) AS favourite_count
            FROM (${menuUnionSql()}) AS menu

            LEFT JOIN (
                SELECT
                    canteen,
                    item_id,
                    COUNT(*) AS favourite_count
                FROM \`${DB_NAME}\`.food_favourites
                GROUP BY canteen, item_id
            ) AS f
              ON f.canteen = menu.canteen
             AND f.item_id = menu.item_id

            ORDER BY favourite_count DESC, menu.item_name ASC
            LIMIT 1
        `);

        if (rows.length === 0) {
            return res.status(404).json({
                error: "No menu items found"
            });
        }

        res.json(rows[0]);
    } catch (err) {
        handleRouteError("Top favourite query failed:", res, err);
    }
});

// ======================================================
// 16. CAMPUS PICKS
// Returns the two most-favourited dishes.
// ======================================================

app.get("/api/campus-picks", async (req, res) => {
    try {
        const rows = await query(`
            SELECT
                menu.*,
                COUNT(f.id) AS favourite_count
            FROM (${menuUnionSql()}) AS menu

            INNER JOIN \`${DB_NAME}\`.food_favourites AS f
              ON CONVERT(f.canteen USING utf8mb4)
                    COLLATE utf8mb4_unicode_ci
                 =
                 CONVERT(menu.canteen USING utf8mb4)
                    COLLATE utf8mb4_unicode_ci

             AND CONVERT(f.item_id USING utf8mb4)
                    COLLATE utf8mb4_unicode_ci
                 =
                 CONVERT(menu.item_id USING utf8mb4)
                    COLLATE utf8mb4_unicode_ci

            GROUP BY
                menu.item_id,
                menu.item_name,
                menu.category,
                menu.price,
                menu.availability,
                menu.description,
                menu.canteen

            ORDER BY favourite_count DESC, menu.item_name ASC
            LIMIT 2
        `);

        res.json(rows);
    } catch (err) {
        handleRouteError("Campus Picks query failed:", res, err);
    }
});

// ======================================================
// 17. START SERVER
// ======================================================

async function startServer() {
    try {
        const rows = await query(
            "SELECT DATABASE() AS databaseName"
        );

        console.log("MySQL connected successfully.");
        console.log("DATABASE USED:", rows[0].databaseName);
    } catch (err) {
        logDatabaseError("Initial MySQL connection failed:", err);
        console.error(
            "The API server will start, but database routes will fail until MySQL is reachable."
        );
    }

    const server = app.listen(PORT, "0.0.0.0", () => {
        console.log(
            `Campus Connect Canteens Backend running on port ${PORT}`
        );
    });

    // Graceful shutdown (important on Render / PaaS)
    process.on("SIGTERM", async () => {
        console.log("SIGTERM received. Shutting down gracefully...");
        server.close(async () => {
            await db.end();
            process.exit(0);
        });
    });

    process.on("SIGINT", async () => {
        console.log("SIGINT received. Shutting down gracefully...");
        server.close(async () => {
            await db.end();
            process.exit(0);
        });
    });
}

startServer();   