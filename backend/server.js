
"use strict";

// ======================================================
// CAMPUS BITES - CANTEENS BACKEND
// Database: campus_canteen
//
// IMPORTANT:
// is_available = 1  -> Available
// is_available = 0  -> Not Available
//
// The database is the source of truth for availability.
// ======================================================

require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB = "campus_canteen";

// ======================================================
// 1. MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json());

app.use(
    "/food-images",
    express.static(path.join(__dirname, "food-images"))
);

// ======================================================
// 2. MYSQL CONNECTION
// ======================================================

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306),
    ssl:
        process.env.DB_SSL === "true"
            ? { rejectUnauthorized: false }
            : undefined
});

db.connect((err) => {
    if (err) {
        console.error("MySQL connection failed:", err.message);
        return;
    }

    console.log("MySQL connected successfully.");

    db.query(
        `SELECT 1 FROM ${DB}.menu_items LIMIT 1`,
        (error) => {
            if (error) {
                console.error(
                    "Menu table check failed:",
                    error.message
                );
            } else {
                console.log("Menu table is accessible.");
            }
        }
    );
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

function getCanteen(canteenId) {
    return canteens[
        String(canteenId || "").toLowerCase()
    ];
}

// ======================================================
// 4. NORMALIZE AVAILABILITY
// ======================================================

// The numeric database column is_available takes priority.
// availability is derived from it so the UI gets consistent data.
function normalizeMenuItem(item) {
    const available =
        Number(item.is_available) === 1;

    return {
        ...item,
        is_available: Number(item.is_available),
        availability: available
            ? "Available"
            : "Not Available"
    };
}

// ======================================================
// 5. DATABASE ERROR HANDLER
// ======================================================

function sendDbError(label, res, err) {
    console.error(`${label}:`, err.message);

    return res.status(500).json({
        error: "Database request failed"
    });
}

// ======================================================
// 6. HEALTH CHECK
// ======================================================

app.get("/", (req, res) => {
    res.json({
        message: "Campus Bites backend is running."
    });
});

app.get("/health", (req, res) => {
    db.query(
        `SELECT 1 FROM ${DB}.menu_items LIMIT 1`,
        (err) => {
            if (err) {
                return sendDbError(
                    "Health check failed",
                    res,
                    err
                );
            }

            res.json({
                status: "ok",
                database: DB
            });
        }
    );
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

// ======================================================
// 8. GET ALL MENU ITEMS
// ======================================================

app.get("/api/menu", (req, res) => {
    const sql = `
        SELECT
            id AS item_id,
            canteen,
            item_name,
            category,
            price,
            availability,
            description,
            is_available
        FROM ${DB}.menu_items
        ORDER BY item_name
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            return sendDbError(
                "Get all menu items failed",
                res,
                err
            );
        }

        res.set("Cache-Control", "no-store");

        res.json(rows.map(normalizeMenuItem));
    });
});

// ======================================================
// 9. GET MENU FOR ONE CANTEEN
// ======================================================

app.get("/api/menu/:canteen", (req, res) => {
    const canteenId = String(
        req.params.canteen || ""
    ).toLowerCase();

    const canteen = getCanteen(canteenId);

    if (!canteen) {
        return res.status(404).json({
            error: "Canteen not found"
        });
    }

    const sql = `
        SELECT
            id AS item_id,
            canteen,
            item_name,
            category,
            price,
            availability,
            description,
            is_available
        FROM ${DB}.${canteen.table}
        ORDER BY id
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            return sendDbError(
                `Get ${canteenId} menu failed`,
                res,
                err
            );
        }

        res.set("Cache-Control", "no-store");

        res.json(
            rows.map(item => ({
                ...normalizeMenuItem(item),
                canteen: canteenId
            }))
        );
    });
});

// ======================================================
// 10. GET ONE MENU ITEM
// ======================================================

app.get("/api/item/:canteen/:id", (req, res) => {
    const canteenId = String(
        req.params.canteen || ""
    ).toLowerCase();

    const canteen = getCanteen(canteenId);

    if (!canteen) {
        return res.status(404).json({
            error: "Canteen not found"
        });
    }

    const sql = `
        SELECT
            id AS item_id,
            canteen,
            item_name,
            category,
            price,
            availability,
            description,
            is_available
        FROM ${DB}.${canteen.table}
        WHERE id = ?
        LIMIT 1
    `;

    db.query(sql, [req.params.id], (err, rows) => {
        if (err) {
            return sendDbError(
                "Get menu item failed",
                res,
                err
            );
        }

        if (!rows.length) {
            return res.status(404).json({
                error: "Menu item not found"
            });
        }

        res.set("Cache-Control", "no-store");

        res.json(normalizeMenuItem(rows[0]));
    });
});

// ======================================================
// 11. ADD FAVOURITE
// ======================================================

app.post("/api/favourites", (req, res) => {
    const visitorId = String(
        req.body.visitorId ||
        req.body.visitor_id ||
        ""
    ).trim();

    const canteenId = String(
        req.body.canteen || ""
    ).toLowerCase();

    const itemId = String(
        req.body.item_id ?? ""
    ).trim();

    const canteen = getCanteen(canteenId);

    if (
        !visitorId ||
        visitorId.length > 100 ||
        !canteen ||
        !itemId
    ) {
        return res.status(400).json({
            error: "visitorId, canteen and item_id are required"
        });
    }

    const checkSql = `
        SELECT id
        FROM ${DB}.${canteen.table}
        WHERE id = ?
        LIMIT 1
    `;

    db.query(checkSql, [itemId], (checkErr, rows) => {
        if (checkErr) {
            return sendDbError(
                "Verify favourite failed",
                res,
                checkErr
            );
        }

        if (!rows.length) {
            return res.status(404).json({
                error: "Menu item not found"
            });
        }

        const insertSql = `
            INSERT IGNORE INTO ${DB}.food_favourites
                (visitor_id, canteen, item_id)
            VALUES (?, ?, ?)
        `;

        db.query(
            insertSql,
            [visitorId, canteenId, itemId],
            (err, result) => {
                if (err) {
                    return sendDbError(
                        "Save favourite failed",
                        res,
                        err
                    );
                }

                res.json({
                    success: true,
                    favourited: true,
                    alreadyFavourited:
                        result.affectedRows === 0
                });
            }
        );
    });
});

// ======================================================
// 12. GET FAVOURITES FOR A VISITOR
// ======================================================

app.get("/api/favourites/:visitorId", (req, res) => {
    const visitorId = String(
        req.params.visitorId || ""
    ).trim();

    if (!visitorId || visitorId.length > 100) {
        return res.status(400).json({
            error: "Valid visitor ID required"
        });
    }

    const sql = `
        SELECT canteen, item_id
        FROM ${DB}.food_favourites
        WHERE visitor_id = ?
    `;

    db.query(sql, [visitorId], (err, rows) => {
        if (err) {
            return sendDbError(
                "Load favourites failed",
                res,
                err
            );
        }

        res.json(rows);
    });
});

// ======================================================
// 13. DELETE FAVOURITE
// ======================================================

app.delete("/api/favourites", (req, res) => {
    const visitorId = String(
        req.body.visitorId ||
        req.body.visitor_id ||
        ""
    ).trim();

    const canteenId = String(
        req.body.canteen || ""
    ).toLowerCase();

    const itemId = String(
        req.body.item_id ?? ""
    ).trim();

    if (
        !visitorId ||
        visitorId.length > 100 ||
        !getCanteen(canteenId) ||
        !itemId
    ) {
        return res.status(400).json({
            error: "visitorId, canteen and item_id are required"
        });
    }

    const sql = `
        DELETE FROM ${DB}.food_favourites
        WHERE visitor_id = ?
          AND canteen = ?
          AND item_id = ?
    `;

    db.query(
        sql,
        [visitorId, canteenId, itemId],
        (err) => {
            if (err) {
                return sendDbError(
                    "Delete favourite failed",
                    res,
                    err
                );
            }

            res.json({
                success: true,
                favourited: false
            });
        }
    );
});

// ======================================================
// 14. FAVOURITE COUNTS
// ======================================================

app.get("/api/favourites/counts", (req, res) => {
    const sql = `
        SELECT
            canteen,
            item_id,
            COUNT(*) AS favourite_count
        FROM ${DB}.food_favourites
        GROUP BY canteen, item_id
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            return sendDbError(
                "Favourite counts failed",
                res,
                err
            );
        }

        res.json(rows);
    });
});

// ======================================================
// 15. TOP FAVOURITE
// ======================================================

app.get("/api/favourites/top", (req, res) => {
    const sql = `
        SELECT
            m.id AS item_id,
            m.canteen,
            m.item_name,
            m.category,
            m.price,
            m.availability,
            m.description,
            m.is_available,
            COUNT(f.item_id) AS favourite_count
        FROM ${DB}.menu_items AS m
        LEFT JOIN ${DB}.food_favourites AS f
          ON f.canteen = m.canteen
         AND f.item_id = m.id
        GROUP BY
            m.id,
            m.canteen,
            m.item_name,
            m.category,
            m.price,
            m.availability,
            m.description,
            m.is_available
        ORDER BY favourite_count DESC, m.item_name ASC
        LIMIT 1
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            return sendDbError(
                "Top favourite query failed",
                res,
                err
            );
        }

        if (!rows.length) {
            return res.status(404).json({
                error: "No menu items found"
            });
        }

        res.json(normalizeMenuItem(rows[0]));
    });
});

// ======================================================
// 16. CAMPUS PICKS
// ======================================================

app.get("/api/campus-picks", (req, res) => {
    const sql = `
        SELECT
            m.id AS item_id,
            m.canteen,
            m.item_name,
            m.category,
            m.price,
            m.availability,
            m.description,
            m.is_available,
            COUNT(f.item_id) AS favourite_count
        FROM ${DB}.menu_items AS m
        INNER JOIN ${DB}.food_favourites AS f
          ON f.canteen = m.canteen
         AND f.item_id = m.id
        GROUP BY
            m.id,
            m.canteen,
            m.item_name,
            m.category,
            m.price,
            m.availability,
            m.description,
            m.is_available
        ORDER BY favourite_count DESC, m.item_name ASC
        LIMIT 2
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            return sendDbError(
                "Campus Picks query failed",
                res,
                err
            );
        }

        res.json(rows.map(normalizeMenuItem));
    });
});

// ======================================================
// 17. GLOBAL ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {
    console.error("Unhandled request error:", err.message);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        error: "Internal server error"
    });
});

// ======================================================
// 18. START SERVER
// ======================================================

app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `Campus Bites backend running on port ${PORT}`
    );
});
