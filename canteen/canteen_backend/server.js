
"use strict";

// ======================================================
// 1. IMPORTS AND CONFIGURATION
// ======================================================

require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const DB_NAME = process.env.DB_NAME || "campus_canteen";
const DB_PORT = Number(process.env.DB_PORT) || 3306;

// Validate the database name before using it in SQL identifiers.
if (!/^[a-zA-Z0-9_]+$/.test(DB_NAME)) {
    throw new Error("Invalid DB_NAME configuration.");
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

const missingVariables = [
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD"
].filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
    console.error(
        "Missing Render database environment variables:",
        missingVariables.join(", ")
    );
}

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
    keepAliveInitialDelay: 0,
    ...(process.env.DB_SSL === "true"
        ? { ssl: { rejectUnauthorized: false } }
        : {})
});

// Log useful errors without exposing database credentials.
function logDatabaseError(label, err) {
    console.error(label, {
        code: err.code || "UNKNOWN",
        errno: err.errno || null,
        message: err.message || "No error message provided"
    });
}

// Retry the startup connectivity check if the database is temporarily
// unavailable. This does not make invalid credentials or an unreachable
// database work; it helps diagnose temporary connection failures.
function checkDatabase(attempt = 1) {
    db.getConnection((err, connection) => {
        if (err) {
            logDatabaseError("MySQL connection failed:", err);

            if (attempt < 5) {
                const delay = attempt * 5000;

                console.log(
                    `Retrying database connection in ${delay / 1000} seconds (attempt ${attempt + 1}/5).`
                );

                setTimeout(() => checkDatabase(attempt + 1), delay);
            }

            return;
        }

        connection.query(
            "SELECT DATABASE() AS databaseName",
            (queryErr, rows) => {
                if (queryErr) {
                    logDatabaseError("MySQL startup query failed:", queryErr);
                } else {
                    console.log("MySQL connected successfully.");
                    console.log(
                        "DATABASE USED:",
                        rows[0].databaseName
                    );
                }

                connection.release();
            }
        );
    });
}

checkDatabase();

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
    return String(
        body?.visitorId ?? body?.visitor_id ?? ""
    ).trim();
}

function getItemId(body) {
    return String(
        body?.item_id ?? body?.itemId ?? ""
    ).trim();
}

// ======================================================
// 4. COMMON MENU SQL
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
// 5. HOME AND HEALTH ROUTES
// ======================================================

app.get("/", (req, res) => {
    res.json({
        message: "Campus Connect Canteens Backend is running!"
    });
});

app.get("/health", (req, res) => {
    db.query(
        "SELECT DATABASE() AS databaseName",
        (err, rows) => {
            if (err) {
                logDatabaseError("Health check database error:", err);

                return res.status(503).json({
                    status: "error",
                    error: "Database connection failed",
                    code: err.code || "UNKNOWN"
                });
            }

            res.json({
                status: "ok",
                database: rows[0].databaseName
            });
        }
    );
});

// ======================================================
// 6. GET CANTEENS
// ======================================================

app.get("/api/canteens", (req, res) => {
    res.json(
        Object.entries(canteens).map(([id, canteen]) => ({
            id,
            name: canteen.name
        }))
    );
});

// ======================================================
// 7. GET ALL MENU ITEMS
// ======================================================

app.get("/api/menu", (req, res) => {
    db.query(menuUnionSql(), (err, results) => {
        if (err) {
            logDatabaseError("All menu query failed:", err);

            return res.status(500).json({
                error: "Failed to fetch all menu items",
                details: err.message
            });
        }

        res.json(results);
    });
});

// ======================================================
// 8. GET MENU BY CANTEEN
// ======================================================

app.get("/api/menu/:canteen", (req, res) => {
    const canteen = getCanteen(req.params.canteen);

    if (!canteen) {
        return res.status(404).json({
            error: "Canteen not found"
        });
    }

    const sql = `
        SELECT
            item_id,
            item_name,
            category,
            price,
            availability,
            description
        FROM \`${DB_NAME}\`.\`${canteen.table}\`
        ORDER BY item_id
    `;

    db.query(sql, (err, results) => {
        if (err) {
            logDatabaseError("Canteen menu query failed:", err);

            return res.status(500).json({
                error: "Failed to fetch menu",
                details: err.message
            });
        }

        res.json(results);
    });
});

// ======================================================
// 9. GET ONE MENU ITEM
// ======================================================

app.get("/api/item/:canteen/:id", (req, res) => {
    const canteen = getCanteen(req.params.canteen);

    if (!canteen) {
        return res.status(404).json({
            error: "Canteen not found"
        });
    }

    const sql = `
        SELECT
            item_id,
            item_name,
            category,
            price,
            availability,
            description
        FROM \`${DB_NAME}\`.\`${canteen.table}\`
        WHERE item_id = ?
        LIMIT 1
    `;

    db.query(sql, [req.params.id], (err, results) => {
        if (err) {
            logDatabaseError("Item query failed:", err);

            return res.status(500).json({
                error: "Failed to fetch item",
                details: err.message
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                error: "Item not found"
            });
        }

        res.json(results[0]);
    });
});

// ======================================================
// 10. ADD A FOOD FAVOURITE
// POST /api/favourites
// Body: { visitorId, canteen, item_id }
// ======================================================

app.post("/api/favourites", (req, res) => {
    const visitorId = getVisitorId(req.body);
    const canteenId = String(
        req.body?.canteen || ""
    ).toLowerCase();

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

    const verifySql = `
        SELECT item_id
        FROM \`${DB_NAME}\`.\`${canteen.table}\`
        WHERE item_id = ?
        LIMIT 1
    `;

    db.query(verifySql, [itemId], (verifyErr, items) => {
        if (verifyErr) {
            logDatabaseError("Favourite verification failed:", verifyErr);

            return res.status(500).json({
                error: "Could not verify menu item",
                details: verifyErr.message
            });
        }

        if (items.length === 0) {
            return res.status(404).json({
                error: "Menu item not found"
            });
        }

        const insertSql = `
            INSERT IGNORE INTO \`${DB_NAME}\`.food_favourites
                (visitor_id, canteen, item_id)
            VALUES (?, ?, ?)
        `;

        db.query(
            insertSql,
            [visitorId, canteenId, itemId],
            (err, result) => {
                if (err) {
                    logDatabaseError("Saving favourite failed:", err);

                    return res.status(500).json({
                        error: "Could not save favourite",
                        details: err.message
                    });
                }

                res.json({
                    success: true,
                    favourited: true,
                    alreadyFavourited: result.affectedRows === 0
                });
            }
        );
    });
});

// ======================================================
// 11. GET A VISITOR'S FAVOURITES
// GET /api/favourites/:visitorId
// ======================================================

app.get("/api/favourites/:visitorId", (req, res) => {
    const visitorId = String(
        req.params.visitorId || ""
    ).trim();

    if (!visitorId || visitorId.length > 100) {
        return res.status(400).json({
            error: "Valid visitor ID is required"
        });
    }

    const sql = `
        SELECT canteen, item_id
        FROM \`${DB_NAME}\`.food_favourites
        WHERE visitor_id = ?
    `;

    db.query(sql, [visitorId], (err, results) => {
        if (err) {
            logDatabaseError("Loading favourites failed:", err);

            return res.status(500).json({
                error: "Could not load favourites",
                details: err.message
            });
        }

        res.json(results);
    });
});

// ======================================================
// 12. REMOVE A FOOD FAVOURITE
// DELETE /api/favourites
// ======================================================

app.delete("/api/favourites", (req, res) => {
    const visitorId = getVisitorId(req.body);
    const canteenId = String(
        req.body?.canteen || ""
    ).toLowerCase();

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

    const sql = `
        DELETE FROM \`${DB_NAME}\`.food_favourites
        WHERE visitor_id = ?
          AND canteen = ?
          AND item_id = ?
    `;

    db.query(
        sql,
        [visitorId, canteenId, itemId],
        (err, result) => {
            if (err) {
                logDatabaseError("Removing favourite failed:", err);

                return res.status(500).json({
                    error: "Could not remove favourite",
                    details: err.message
                });
            }

            res.json({
                success: true,
                favourited: false,
                removed: result.affectedRows > 0
            });
        }
    );
});

// ======================================================
// 13. GET FAVOURITE COUNTS
// ======================================================

app.get("/api/favourites/counts", (req, res) => {
    const sql = `
        SELECT
            canteen,
            item_id,
            COUNT(*) AS favourite_count
        FROM \`${DB_NAME}\`.food_favourites
        GROUP BY canteen, item_id
    `;

    db.query(sql, (err, results) => {
        if (err) {
            logDatabaseError("Favourite counts failed:", err);

            return res.status(500).json({
                error: "Could not load favourite counts",
                details: err.message
            });
        }

        res.json(results);
    });
});

// ======================================================
// 14. GET TOP FAVOURITED DISH
// ======================================================

app.get("/api/favourites/top", (req, res) => {
    const sql = `
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
    `;

    db.query(sql, (err, results) => {
        if (err) {
            logDatabaseError("Top favourite query failed:", err);

            return res.status(500).json({
                error: "Could not load top favourite",
                details: err.message
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                error: "No menu items found"
            });
        }

        res.json(results[0]);
    });
});

// ======================================================
// 15. CAMPUS PICKS
// Returns the two most-favourited dishes.
// ======================================================

app.get("/api/campus-picks", (req, res) => {
    const sql = `
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

        ORDER BY
            favourite_count DESC,
            menu.item_name ASC

        LIMIT 2
    `;

    db.query(sql, (err, results) => {
        if (err) {
            logDatabaseError("Campus Picks query failed:", err);

            return res.status(500).json({
                error: "Failed to load Campus Picks",
                details: err.message
            });
        }

        res.json(results);
    });
});

// ======================================================
// 16. START SERVER
// ======================================================

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Campus Connect Canteens Backend running on port ${PORT}`);
});
