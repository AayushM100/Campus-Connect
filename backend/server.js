
"use strict";

require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB = "campus_canteen";
const MENU_TABLE = `\`${DB}\`.\`menu_items\``;
const FAVOURITES_TABLE = `\`${DB}\`.\`food_favourites\``;

app.use(cors());
app.use(express.json());
app.use(
    "/food-images",
    express.static(path.join(__dirname, "food-images"))
);

// ------------------------------------------------------
// MYSQL
// ------------------------------------------------------

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

    console.log("MySQL connected successfully.");

    db.query(
        `SELECT id, canteen, is_available FROM ${MENU_TABLE} LIMIT 1`,
        (error) => {
            if (error) {
                console.error("Menu table check failed:", error.message);
            } else {
                console.log("Shared menu_items table is accessible.");
            }
        }
    );
});

// ------------------------------------------------------
// CANTEENS
// ------------------------------------------------------

const canteens = {
    cafeteria: "Cafeteria",
    timeless: "Timeless",
    nescafe: "Nescafe"
};

function normalizeCanteen(value) {
    const key = String(value || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(canteens, key)
        ? key
        : null;
}

function normalizeItem(row) {
    const available = Number(row.is_available) === 1;

    return {
        ...row,
        id: row.id == null ? undefined : Number(row.id),
        item_id: String(row.id),
        canteen: String(row.canteen || "").toLowerCase(),
        is_available: Number(row.is_available),
        availability: available ? "Available" : "Not Available"
    };
}

const MENU_COLUMNS = `
    id,
    canteen,
    item_name,
    category,
    price,
    availability,
    description,
    is_available
`;

// ------------------------------------------------------
// HEALTH
// ------------------------------------------------------

app.get("/", (req, res) => {
    res.json({ message: "Campus Bites backend is running." });
});

app.get("/health", (req, res) => {
    db.query(`SELECT 1 FROM ${MENU_TABLE} LIMIT 1`, (err) => {
        if (err) {
            console.error("Health check failed:", err.message);
            return res.status(500).json({ status: "error" });
        }

        res.json({ status: "ok", database: DB });
    });
});

// ------------------------------------------------------
// GET CANTEENS
// ------------------------------------------------------

app.get("/api/canteens", (req, res) => {
    res.json(
        Object.entries(canteens).map(([id, name]) => ({ id, name }))
    );
});

// ------------------------------------------------------
// GET ALL MENU ITEMS
// GET /api/menu
// ------------------------------------------------------

app.get("/api/menu", (req, res) => {
    const sql = `
        SELECT ${MENU_COLUMNS}
        FROM ${MENU_TABLE}
        ORDER BY item_name
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.error("Get all menu items failed:", err.message);
            return res.status(500).json({
                error: "Could not load menu items"
            });
        }

        res.set("Cache-Control", "no-store");
        res.json(rows.map(normalizeItem));
    });
});

// ------------------------------------------------------
// GET MENU FOR ONE CANTEEN
// GET /api/menu/cafeteria
// GET /api/menu/timeless
// GET /api/menu/nescafe
// ------------------------------------------------------

app.get("/api/menu/:canteen", (req, res) => {
    const canteen = normalizeCanteen(req.params.canteen);

    if (!canteen) {
        return res.status(404).json({ error: "Canteen not found" });
    }

    const sql = `
        SELECT ${MENU_COLUMNS}
        FROM ${MENU_TABLE}
        WHERE LOWER(canteen) = ?
        ORDER BY item_name
    `;

    db.query(sql, [canteen], (err, rows) => {
        if (err) {
            console.error(`Get ${canteen} menu failed:`, err.message);
            return res.status(500).json({
                error: "Could not load menu items"
            });
        }

        res.set("Cache-Control", "no-store");
        res.json(rows.map(normalizeItem));
    });
});

// ------------------------------------------------------
// GET ONE MENU ITEM
// GET /api/item/cafeteria/25
// ------------------------------------------------------

app.get("/api/item/:canteen/:id", (req, res) => {
    const canteen = normalizeCanteen(req.params.canteen);
    const itemId = Number(req.params.id);

    if (!canteen || !Number.isInteger(itemId) || itemId < 1) {
        return res.status(400).json({ error: "Invalid canteen or item ID" });
    }

    const sql = `
        SELECT ${MENU_COLUMNS}
        FROM ${MENU_TABLE}
        WHERE id = ? AND LOWER(canteen) = ?
        LIMIT 1
    `;

    db.query(sql, [itemId, canteen], (err, rows) => {
        if (err) {
            console.error("Get menu item failed:", err.message);
            return res.status(500).json({
                error: "Could not load menu item"
            });
        }

        if (!rows.length) {
            return res.status(404).json({ error: "Menu item not found" });
        }

        res.set("Cache-Control", "no-store");
        res.json(normalizeItem(rows[0]));
    });
});

// ------------------------------------------------------
// ADD FAVOURITE
// POST /api/favourites
// ------------------------------------------------------

app.post("/api/favourites", (req, res) => {
    const visitorId = String(
        req.body.visitorId || req.body.visitor_id || ""
    ).trim();

    const canteen = normalizeCanteen(req.body.canteen);
    const itemId = Number(req.body.item_id);

    if (
        !visitorId ||
        visitorId.length > 100 ||
        !canteen ||
        !Number.isInteger(itemId) ||
        itemId < 1
    ) {
        return res.status(400).json({
            error: "visitorId, canteen and valid item_id are required"
        });
    }

    db.query(
        `SELECT id FROM ${MENU_TABLE}
         WHERE id = ? AND LOWER(canteen) = ? LIMIT 1`,
        [itemId, canteen],
        (checkErr, rows) => {
            if (checkErr) {
                console.error("Verify favourite failed:", checkErr.message);
                return res.status(500).json({
                    error: "Could not verify menu item"
                });
            }

            if (!rows.length) {
                return res.status(404).json({
                    error: "Menu item not found"
                });
            }

            const sql = `
                INSERT IGNORE INTO ${FAVOURITES_TABLE}
                    (visitor_id, canteen, item_id)
                VALUES (?, ?, ?)
            `;

            db.query(sql, [visitorId, canteen, itemId], (err, result) => {
                if (err) {
                    console.error("Save favourite failed:", err.message);
                    return res.status(500).json({
                        error: "Could not save favourite"
                    });
                }

                res.json({
                    success: true,
                    favourited: true,
                    alreadyFavourited: result.affectedRows === 0
                });
            });
        }
    );
});

// ------------------------------------------------------
// GET FAVOURITES FOR A VISITOR
// GET /api/favourites/:visitorId
// ------------------------------------------------------

app.get("/api/favourites/:visitorId", (req, res) => {
    const visitorId = String(req.params.visitorId || "").trim();

    if (!visitorId || visitorId.length > 100) {
        return res.status(400).json({ error: "Valid visitor ID required" });
    }

    db.query(
        `SELECT canteen, item_id FROM ${FAVOURITES_TABLE}
         WHERE visitor_id = ?`,
        [visitorId],
        (err, rows) => {
            if (err) {
                console.error("Load favourites failed:", err.message);
                return res.status(500).json({
                    error: "Could not load favourites"
                });
            }

            res.json(rows);
        }
    );
});

// ------------------------------------------------------
// DELETE FAVOURITE
// DELETE /api/favourites
// ------------------------------------------------------

app.delete("/api/favourites", (req, res) => {
    const visitorId = String(
        req.body.visitorId || req.body.visitor_id || ""
    ).trim();

    const canteen = normalizeCanteen(req.body.canteen);
    const itemId = Number(req.body.item_id);

    if (
        !visitorId ||
        visitorId.length > 100 ||
        !canteen ||
        !Number.isInteger(itemId) ||
        itemId < 1
    ) {
        return res.status(400).json({
            error: "visitorId, canteen and valid item_id are required"
        });
    }

    db.query(
        `DELETE FROM ${FAVOURITES_TABLE}
         WHERE visitor_id = ? AND canteen = ? AND item_id = ?`,
        [visitorId, canteen, itemId],
        (err) => {
            if (err) {
                console.error("Delete favourite failed:", err.message);
                return res.status(500).json({
                    error: "Could not delete favourite"
                });
            }

            res.json({ success: true, favourited: false });
        }
    );
});

// ------------------------------------------------------
// FAVOURITE COUNTS
// GET /api/favourites/counts
// ------------------------------------------------------

app.get("/api/favourites/counts", (req, res) => {
    db.query(
        `SELECT canteen, item_id, COUNT(*) AS favourite_count
         FROM ${FAVOURITES_TABLE}
         GROUP BY canteen, item_id`,
        (err, rows) => {
            if (err) {
                console.error("Favourite counts failed:", err.message);
                return res.status(500).json({
                    error: "Could not load favourite counts"
                });
            }

            res.json(rows);
        }
    );
});

// ------------------------------------------------------
// TOP FAVOURITE
// GET /api/favourites/top
// ------------------------------------------------------

app.get("/api/favourites/top", (req, res) => {
    const sql = `
        SELECT
            m.id,
            m.canteen,
            m.item_name,
            m.category,
            m.price,
            m.availability,
            m.description,
            m.is_available,
            COUNT(f.item_id) AS favourite_count
        FROM ${MENU_TABLE} AS m
        LEFT JOIN ${FAVOURITES_TABLE} AS f
          ON LOWER(f.canteen) = LOWER(m.canteen)
         AND CAST(f.item_id AS CHAR) = CAST(m.id AS CHAR)
        GROUP BY
            m.id, m.canteen, m.item_name, m.category, m.price,
            m.availability, m.description, m.is_available
        ORDER BY favourite_count DESC, m.item_name ASC
        LIMIT 1
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.error("Top favourite query failed:", err.message);
            return res.status(500).json({
                error: "Could not load top favourite"
            });
        }

        if (!rows.length) {
            return res.status(404).json({ error: "No menu items found" });
        }

        res.json({
            ...normalizeItem(rows[0]),
            favourite_count: Number(rows[0].favourite_count)
        });
    });
});

// ------------------------------------------------------
// CAMPUS PICKS
// GET /api/campus-picks
// ------------------------------------------------------

app.get("/api/campus-picks", (req, res) => {
    const sql = `
        SELECT
            m.id,
            m.canteen,
            m.item_name,
            m.category,
            m.price,
            m.availability,
            m.description,
            m.is_available,
            COUNT(f.item_id) AS favourite_count
        FROM ${MENU_TABLE} AS m
        INNER JOIN ${FAVOURITES_TABLE} AS f
          ON LOWER(f.canteen) = LOWER(m.canteen)
         AND CAST(f.item_id AS CHAR) = CAST(m.id AS CHAR)
        GROUP BY
            m.id, m.canteen, m.item_name, m.category, m.price,
            m.availability, m.description, m.is_available
        ORDER BY favourite_count DESC, m.item_name ASC
        LIMIT 2
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.error("Campus Picks query failed:", err.message);
            return res.status(500).json({
                error: "Could not load Campus Picks"
            });
        }

        res.json(
            rows.map((row) => ({
                ...normalizeItem(row),
                favourite_count: Number(row.favourite_count)
            }))
        );
    });
});

// ------------------------------------------------------
// ERROR HANDLER
// ------------------------------------------------------

app.use((err, req, res, next) => {
    console.error("Unhandled request error:", err.message);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({ error: "Internal server error" });
});

// ------------------------------------------------------
// START SERVER
// ------------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Campus Bites backend running on port ${PORT}`);
});
