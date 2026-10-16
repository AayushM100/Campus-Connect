
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
const PORT = process.env.PORT || 3000;
const DB_NAME = "campus_canteen";

app.use(cors());
app.use(express.json());

app.use(
    "/food-images",
    express.static(path.join(__dirname, "food-images"))
);

// ======================================================
// 2. MYSQL CONNECTION
// Uses only `db` throughout this file.
// ======================================================

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ...(process.env.DB_SSL === "true"
        ? { ssl: { rejectUnauthorized: false } }
        : {})
});

db.query("SELECT DATABASE() AS databaseName", (err, rows) => {
    if (err) {
        console.error("MySQL connection failed:", err.message);
        return;
    }

    console.log("MySQL connected successfully.");
    console.log("DATABASE USED:", rows[0].databaseName);
});

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
// 4. COMMON SQL FOR ALL MENU ITEMS
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
        FROM ${DB_NAME}.campus_cafeteria

        UNION ALL

        SELECT
            CAST(item_id AS CHAR),
            item_name,
            category,
            price,
            availability,
            description,
            'timeless'
        FROM ${DB_NAME}.cafe_timeless

        UNION ALL

        SELECT
            CAST(item_id AS CHAR),
            item_name,
            category,
            price,
            availability,
            description,
            'nescafe'
        FROM ${DB_NAME}.nescafe
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
    db.query("SELECT 1 AS connected", (err) => {
        if (err) {
            return res.status(500).json({
                status: "error",
                error: err.message
            });
        }

        res.json({
            status: "ok",
            database: DB_NAME
        });
    });
});

// ======================================================
// 6. GET ALL CANTEENS
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
            console.error("All menu query failed:", err.message);

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
        FROM ${DB_NAME}.${canteen.table}
        ORDER BY item_id
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Canteen menu query failed:", err.message);

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
        FROM ${DB_NAME}.${canteen.table}
        WHERE item_id = ?
        LIMIT 1
    `;

    db.query(sql, [req.params.id], (err, results) => {
        if (err) {
            console.error("Item query failed:", err.message);

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

    const verifySql = `
        SELECT item_id
        FROM ${DB_NAME}.${canteen.table}
        WHERE item_id = ?
        LIMIT 1
    `;

    db.query(verifySql, [itemId], (verifyErr, items) => {
        if (verifyErr) {
            console.error("Favourite verification failed:", verifyErr.message);

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
            INSERT IGNORE INTO ${DB_NAME}.food_favourites
                (visitor_id, canteen, item_id)
            VALUES (?, ?, ?)
        `;

        db.query(
            insertSql,
            [visitorId, canteenId, itemId],
            (err, result) => {
                if (err) {
                    console.error("Saving favourite failed:", err.message);

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
    const visitorId = String(req.params.visitorId || "").trim();

    if (!visitorId || visitorId.length > 100) {
        return res.status(400).json({
            error: "Valid visitor ID is required"
        });
    }

    const sql = `
        SELECT canteen, item_id
        FROM ${DB_NAME}.food_favourites
        WHERE visitor_id = ?
    `;

    db.query(sql, [visitorId], (err, results) => {
        if (err) {
            console.error("Loading favourites failed:", err.message);

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
// Body: { visitorId, canteen, item_id }
// ======================================================

app.delete("/api/favourites", (req, res) => {
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

    const sql = `
        DELETE FROM ${DB_NAME}.food_favourites
        WHERE visitor_id = ?
          AND canteen = ?
          AND item_id = ?
    `;

    db.query(sql, [visitorId, canteenId, itemId], (err, result) => {
        if (err) {
            console.error("Removing favourite failed:", err.message);

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
    });
});

// ======================================================
// 13. GET FAVOURITE COUNTS
// GET /api/favourites/counts
// ======================================================

app.get("/api/favourites/counts", (req, res) => {
    const sql = `
        SELECT
            canteen,
            item_id,
            COUNT(*) AS favourite_count
        FROM ${DB_NAME}.food_favourites
        GROUP BY canteen, item_id
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Favourite counts failed:", err.message);

            return res.status(500).json({
                error: "Could not load favourite counts",
                details: err.message
            });
        }

        res.json(results);
    });
});

// ======================================================
// 14. GET THE TOP FAVOURITED DISH
// GET /api/favourites/top
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
            FROM ${DB_NAME}.food_favourites
            GROUP BY canteen, item_id
        ) AS f
          ON f.canteen = menu.canteen
         AND f.item_id = menu.item_id

        ORDER BY favourite_count DESC, menu.item_name ASC
        LIMIT 1
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Top favourite query failed:", err.message);

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
// GET /api/campus-picks
// Returns the two most-favourited dishes.
// ======================================================


app.get("/api/campus-picks", (req, res) => {
    const sql = `
        SELECT
            menu.*,
            COUNT(f.id) AS favourite_count
        FROM (${menuUnionSql()}) AS menu

        INNER JOIN campus_canteen.food_favourites AS f
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
            console.error("Campus Picks query failed:", err.message);

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
    console.log(
        `Campus Connect Canteens Backend running at http://localhost:${PORT}`
    );
});
