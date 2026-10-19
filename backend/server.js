"use strict";

require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB = "campus_canteen";

app.use(cors());
app.use(express.json());

app.use(
    "/food-images",
    express.static(path.join(__dirname, "food-images"))
);

// =====================================================
// 1. DATABASE CONNECTION
// =====================================================

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306),
    database: DB,
    ssl: process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined
});

db.connect((error) => {
    if (error) {
        console.error("MySQL connection failed:", error.message);
        return;
    }

    console.log("Connected to MySQL.");

    db.query(
        "SELECT id, is_available FROM menu_items LIMIT 1",
        (queryError) => {
            if (queryError) {
                console.error(
                    "menu_items table check failed:",
                    queryError.message
                );
            } else {
                console.log("menu_items table is accessible.");
            }
        }
    );
});

// =====================================================
// 2. CANTEEN HELPERS
// =====================================================

const canteens = {
    cafeteria: "Cafeteria",
    timeless: "Timeless",
    nescafe: "Nescafe"
};

function normaliseCanteen(value) {
    const id = String(value || "").trim().toLowerCase();

    return Object.prototype.hasOwnProperty.call(canteens, id)
        ? id
        : null;
}

function sendDbError(label, res, error) {
    console.error(`${label}:`, error.message);

    return res.status(500).json({
        error: "Database request failed"
    });
}

// =====================================================
// 3. ROOT AND HEALTH CHECK
// =====================================================

app.get("/", (req, res) => {
    res.json({
        message: "Campus Bites backend is running."
    });
});

app.get("/health", (req, res) => {
    db.query(
        "SELECT 1 FROM menu_items LIMIT 1",
        (error) => {
            if (error) {
                return sendDbError("Health check failed", res, error);
            }

            res.json({
                status: "ok",
                database: DB
            });
        }
    );
});

// =====================================================
// 4. GET CANTEENS
// =====================================================

app.get("/api/canteens", (req, res) => {
    res.json(
        Object.entries(canteens).map(([id, name]) => ({
            id,
            name
        }))
    );
});

// =====================================================
// 5. GET ALL MENU ITEMS
//
// Actual database columns:
// id, canteen, item_name, category, price,
// availability, description, is_available
//
// Alias id AS item_id for compatibility with menu.js.
// =====================================================

const menuSelect = `
    SELECT
        id AS item_id,
        canteen,
        item_name,
        category,
        price,
        availability,
        description,
        is_available
    FROM menu_items
`;

app.get("/api/menu", (req, res) => {
    db.query(
        `${menuSelect} ORDER BY category, item_name`,
        (error, rows) => {
            if (error) {
                return sendDbError("Get all menu items failed", res, error);
            }

            res.set("Cache-Control", "no-store");
            res.json(rows);
        }
    );
});

// =====================================================
// 6. GET MENU FOR ONE CANTEEN
// =====================================================

app.get("/api/menu/:canteen", (req, res) => {
    const canteen = normaliseCanteen(req.params.canteen);

    if (!canteen) {
        return res.status(404).json({
            error: "Canteen not found"
        });
    }

    db.query(
        `${menuSelect} WHERE LOWER(canteen) = ? ORDER BY id`,
        [canteen],
        (error, rows) => {
            if (error) {
                return sendDbError("Get canteen menu failed", res, error);
            }

            res.set("Cache-Control", "no-store");
            res.json(rows);
        }
    );
});

// =====================================================
// 7. GET ONE MENU ITEM
// =====================================================

app.get("/api/item/:canteen/:id", (req, res) => {
    const canteen = normaliseCanteen(req.params.canteen);
    const itemId = Number(req.params.id);

    if (!canteen || !Number.isInteger(itemId) || itemId <= 0) {
        return res.status(400).json({
            error: "Invalid canteen or item ID"
        });
    }

    db.query(
        `${menuSelect} WHERE LOWER(canteen) = ? AND id = ? LIMIT 1`,
        [canteen, itemId],
        (error, rows) => {
            if (error) {
                return sendDbError("Get menu item failed", res, error);
            }

            if (rows.length === 0) {
                return res.status(404).json({
                    error: "Menu item not found"
                });
            }

            res.set("Cache-Control", "no-store");
            res.json(rows[0]);
        }
    );
});

// =====================================================
// 8. SAVE FAVOURITE
//
// Keeps the existing food_favourites table.
// =====================================================

app.post("/api/favourites", (req, res) => {
    const visitorId = String(
        req.body.visitorId || req.body.visitor_id || ""
    ).trim();

    const canteen = normaliseCanteen(req.body.canteen);
    const itemId = Number(req.body.item_id);

    if (
        !visitorId ||
        visitorId.length > 100 ||
        !canteen ||
        !Number.isInteger(itemId) ||
        itemId <= 0
    ) {
        return res.status(400).json({
            error: "visitorId, canteen and item_id are required"
        });
    }

    db.query(
        `SELECT id FROM menu_items
         WHERE LOWER(canteen) = ? AND id = ?
         LIMIT 1`,
        [canteen, itemId],
        (checkError, rows) => {
            if (checkError) {
                return sendDbError(
                    "Validate favourite failed",
                    res,
                    checkError
                );
            }

            if (rows.length === 0) {
                return res.status(404).json({
                    error: "Menu item not found"
                });
            }

            db.query(
                `INSERT IGNORE INTO food_favourites
                    (visitor_id, canteen, item_id)
                 VALUES (?, ?, ?)`,
                [visitorId, canteen, itemId],
                (insertError, result) => {
                    if (insertError) {
                        return sendDbError(
                            "Save favourite failed",
                            res,
                            insertError
                        );
                    }

                    res.json({
                        success: true,
                        favourited: true,
                        alreadyFavourited: result.affectedRows === 0
                    });
                }
            );
        }
    );
});

// =====================================================
// 9. GET FAVOURITES FOR A VISITOR
// =====================================================

app.get("/api/favourites/:visitorId", (req, res) => {
    const visitorId = String(req.params.visitorId || "").trim();

    if (!visitorId || visitorId.length > 100) {
        return res.status(400).json({
            error: "Valid visitor ID required"
        });
    }

    db.query(
        `SELECT canteen, item_id
         FROM food_favourites
         WHERE visitor_id = ?`,
        [visitorId],
        (error, rows) => {
            if (error) {
                return sendDbError("Get favourites failed", res, error);
            }

            res.json(rows);
        }
    );
});

// =====================================================
// 10. REMOVE FAVOURITE
// =====================================================

app.delete("/api/favourites", (req, res) => {
    const visitorId = String(
        req.body.visitorId || req.body.visitor_id || ""
    ).trim();

    const canteen = normaliseCanteen(req.body.canteen);
    const itemId = Number(req.body.item_id);

    if (
        !visitorId ||
        visitorId.length > 100 ||
        !canteen ||
        !Number.isInteger(itemId) ||
        itemId <= 0
    ) {
        return res.status(400).json({
            error: "visitorId, canteen and item_id are required"
        });
    }

    db.query(
        `DELETE FROM food_favourites
         WHERE visitor_id = ? AND canteen = ? AND item_id = ?`,
        [visitorId, canteen, itemId],
        (error) => {
            if (error) {
                return sendDbError("Remove favourite failed", res, error);
            }

            res.json({
                success: true,
                favourited: false
            });
        }
    );
});

// =====================================================
// 11. FAVOURITE COUNTS
// =====================================================

app.get("/api/favourites/counts", (req, res) => {
    db.query(
        `SELECT canteen, item_id, COUNT(*) AS favourite_count
         FROM food_favourites
         GROUP BY canteen, item_id`,
        (error, rows) => {
            if (error) {
                return sendDbError(
                    "Get favourite counts failed",
                    res,
                    error
                );
            }

            res.json(rows);
        }
    );
});

// =====================================================
// 12. TOP FAVOURITE DISH
// =====================================================

app.get("/api/favourites/top", (req, res) => {
    db.query(
        `SELECT
            m.id AS item_id,
            m.canteen,
            m.item_name,
            m.category,
            m.price,
            m.availability,
            m.description,
            m.is_available,
            COUNT(f.item_id) AS favourite_count
         FROM menu_items m
         LEFT JOIN food_favourites f
           ON f.canteen = m.canteen
          AND f.item_id = m.id
         GROUP BY
            m.id, m.canteen, m.item_name, m.category,
            m.price, m.availability, m.description, m.is_available
         ORDER BY favourite_count DESC, m.item_name ASC
         LIMIT 1`,
        (error, rows) => {
            if (error) {
                return sendDbError("Get top favourite failed", res, error);
            }

            if (rows.length === 0) {
                return res.status(404).json({
                    error: "No menu items found"
                });
            }

            res.json(rows[0]);
        }
    );
});

// =====================================================
// 13. TODAY'S CAMPUS PICKS
// =====================================================

app.get("/api/campus-picks", (req, res) => {
    db.query(
        `SELECT
            m.id AS item_id,
            m.canteen,
            m.item_name,
            m.category,
            m.price,
            m.availability,
            m.description,
            m.is_available,
            COUNT(f.item_id) AS favourite_count
         FROM menu_items m
         INNER JOIN food_favourites f
           ON f.canteen = m.canteen
          AND f.item_id = m.id
         GROUP BY
            m.id, m.canteen, m.item_name, m.category,
            m.price, m.availability, m.description, m.is_available
         ORDER BY favourite_count DESC, m.item_name ASC
         LIMIT 2`,
        (error, rows) => {
            if (error) {
                return sendDbError("Get Campus Picks failed", res, error);
            }

            res.set("Cache-Control", "no-store");
            res.json(rows);
        }
    );
});

// =====================================================
// 14. GLOBAL ERROR HANDLER
// =====================================================

app.use((error, req, res, next) => {
    console.error("Unhandled request error:", error.message);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        error: "Internal server error"
    });
});

// =====================================================
// 15. START SERVER
// =====================================================

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Campus Bites backend running on port ${PORT}`);
});