// ======================================================
// CAMPUS CONNECT - CANTEENS BACKEND
// Database: campus_canteen
// Uses the existing canteen tables:
//   campus_canteen.campus_cafeteria
//   campus_canteen.cafe_timeless
//   campus_canteen.nescafe
// ======================================================

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

// Connect to MySQL.
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306),
    ssl: process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined
});

db.connect((err) => {
    if (err) {
        console.error("MySQL connection failed:", err.message);
        return;
    }

    console.log("MySQL server connected.");

    db.query(
        `SELECT 1 FROM ${DB}.campus_cafeteria LIMIT 1`,
        (error) => {
            if (error) {
                console.error(
                    "Database/table check failed:",
                    error.message
                );
            } else {
                console.log(
                    `Database tables in ${DB} are reachable.`
                );
            }
        }
    );
});

// Canteen configuration.
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

// Build a query using the existing three tables.
function menuUnion() {
    return `
        SELECT
            CAST(item_id AS CHAR) AS item_id,
            item_name,
            category,
            price,
            availability,
            description,
            'cafeteria' AS canteen
        FROM ${DB}.campus_cafeteria

        UNION ALL

        SELECT
            CAST(item_id AS CHAR) AS item_id,
            item_name,
            category,
            price,
            availability,
            description,
            'timeless' AS canteen
        FROM ${DB}.cafe_timeless

        UNION ALL

        SELECT
            CAST(item_id AS CHAR) AS item_id,
            item_name,
            category,
            price,
            availability,
            description,
            'nescafe' AS canteen
        FROM ${DB}.nescafe
    `;
}

// Central database error response.
// This replaces the missing handleRouteError function.
function sendDbError(label, res, err) {
    console.error(`${label}:`, err.message);

    return res.status(500).json({
        error: "Database request failed",
        details: err.message
    });
}

// Root route.
app.get("/", (req, res) => {
    res.json({
        message: "Campus Connect Canteens Backend is running!"
    });
});

// Health check.
app.get("/health", (req, res) => {
    db.query(
        `SELECT 1 FROM ${DB}.food_favourites LIMIT 1`,
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

// Get all canteens.
app.get("/api/canteens", (req, res) => {
    res.json(
        Object.entries(canteens).map(([id, value]) => ({
            id,
            name: value.name
        }))
    );
});

// Get all menu items.
app.get("/api/menu", (req, res) => {
    const sql = `${menuUnion()} ORDER BY item_name`;

    db.query(sql, (err, rows) => {
        if (err) {
            return sendDbError(
                "Main menu query failed",
                res,
                err
            );
        }

        res.json(rows);
    });
});

// Get menu items for a specific canteen.
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
            CAST(item_id AS CHAR) AS item_id,
            item_name,
            category,
            price,
            availability,
            description,
            '${canteenId}' AS canteen
        FROM ${DB}.${canteen.table}
        ORDER BY item_id
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            return sendDbError(
                "Canteen menu query failed",
                res,
                err
            );
        }

        res.json(rows);
    });
});

// Get one menu item.
app.get("/api/item/:canteen/:id", (req, res) => {
    const canteen = getCanteen(req.params.canteen);

    if (!canteen) {
        return res.status(404).json({
            error: "Canteen not found"
        });
    }

    const sql = `
        SELECT
            CAST(item_id AS CHAR) AS item_id,
            item_name,
            category,
            price,
            availability,
            description
        FROM ${DB}.${canteen.table}
        WHERE item_id = ?
        LIMIT 1
    `;

    db.query(sql, [req.params.id], (err, rows) => {
        if (err) {
            return sendDbError(
                "Item lookup failed",
                res,
                err
            );
        }

        if (!rows.length) {
            return res.status(404).json({
                error: "Item not found"
            });
        }

        res.json(rows[0]);
    });
});

// Save a favourite.
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
        !itemId ||
        itemId.length > 100
    ) {
        return res.status(400).json({
            error: "visitorId, canteen and item_id are required"
        });
    }

    const checkSql = `
        SELECT item_id
        FROM ${DB}.${canteen.table}
        WHERE item_id = ?
        LIMIT 1
    `;

    db.query(checkSql, [itemId], (checkError, items) => {
        if (checkError) {
            return sendDbError(
                "Verify favourite item failed",
                res,
                checkError
            );
        }

        if (!items.length) {
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

// Load favourites for a visitor.
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

// Remove a favourite.
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
        !itemId ||
        itemId.length > 100
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
                    "Remove favourite failed",
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

// Get favourite counts for all dishes.
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

// Get the most-favourited dish.
app.get("/api/favourites/top", (req, res) => {
    const sql = `
        SELECT
            menu.*,
            COALESCE(f.favourite_count, 0) AS favourite_count
        FROM (${menuUnion()}) AS menu
        LEFT JOIN (
            SELECT
                canteen,
                item_id,
                COUNT(*) AS favourite_count
            FROM ${DB}.food_favourites
            GROUP BY canteen, item_id
        ) AS f
          ON f.canteen = menu.canteen
         AND f.item_id = menu.item_id
        ORDER BY favourite_count DESC, menu.item_name ASC
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

        res.json(rows[0]);
    });
});

// Get the top two Campus Picks.
app.get("/api/campus-picks", (req, res) => {
    const sql = `
        SELECT
            menu.*,
            COUNT(f.item_id) AS favourite_count
        FROM (${menuUnion()}) AS menu
        INNER JOIN ${DB}.food_favourites AS f
          ON f.canteen = menu.canteen
         AND f.item_id = menu.item_id
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
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            return sendDbError(
                "Campus Picks query failed",
                res,
                err
            );
        }

        res.json(rows);
    });
});

// Handle Express errors.
app.use((err, req, res, next) => {
    console.error("Unhandled request error:", err.message);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        error: "Internal server error"
    });
});

// Start the server.
app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `Campus Connect Canteens Backend running on port ${PORT}`
    );
});