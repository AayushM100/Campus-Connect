
"use strict";

// ======================================================
// CAMPUS BITES - CANTEENS BACKEND
// Database: campus_canteen
//
// Database availability:
// is_available = 1 -> Available
// is_available = 0 -> Not Available
//
// Menu tables:
// campus_cafeteria
// cafe_timeless
// nescafe
//
// Shared favourites table:
// food_favourites
// ======================================================

const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const DB = "campus_canteen";
const LF_DB = process.env.DB_NAME || "campusconnect";

// ======================================================
// 1. MIDDLEWARE AND STATIC FILES
// ======================================================

const rootPath = path.join(__dirname, "..");
const frontendPath = path.join(rootPath, "lost_and_found");
const canteenPath = path.join(rootPath, "canteen");
const foodImagesFolder = path.join(__dirname, "food-images");
const uploadsFolder = path.join(frontendPath, "uploads");
const backendUploadsFolder = path.join(__dirname, "uploads");

if (!fs.existsSync(foodImagesFolder)) {
    fs.mkdirSync(foodImagesFolder, { recursive: true });
}
if (!fs.existsSync(backendUploadsFolder)) {
    fs.mkdirSync(backendUploadsFolder, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/food-images", express.static(foodImagesFolder));
app.use("/uploads", express.static(uploadsFolder));
app.use("/uploads", express.static(backendUploadsFolder));
app.use("/lost_and_found/uploads", express.static(uploadsFolder));
app.use("/lost_and_found", express.static(frontendPath));
app.use("/canteen", express.static(canteenPath));

// ======================================================
// 2. MYSQL CONNECTION POOL
// ======================================================

const poolConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306),
    database: LF_DB,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    ssl: (process.env.DB_SSL === "true" || process.env.DB_SSL === "1")
        ? { rejectUnauthorized: false }
        : undefined
};

const db = mysql.createPool(poolConfig);

db.getConnection((err, connection) => {
    if (err) {
        console.error("MySQL connection failed:", err.message);
        return;
    }

    console.log("MySQL connected successfully.");
    connection.release();

    // Verify the actual canteen tables, rather than
    // checking a potentially nonexistent menu_items table.
    const checks = [
        "campus_cafeteria",
        "cafe_timeless",
        "nescafe"
    ];

    checks.forEach((table) => {
        db.query(
            `SELECT item_id FROM \`${DB}\`.\`${table}\` LIMIT 1`,
            (error) => {
                if (error) {
                    console.error(
                        `Table check failed (${table}):`,
                        error.message
                    );
                } else {
                    console.log(`${table} is accessible.`);
                }
            }
        );
    });

    db.query(`SELECT serial_number FROM \`${LF_DB}\`.\`lost_items\` LIMIT 1`, (error) => {
        if (error) {
            console.error("Table check failed (lost_items):", error.message);
        } else {
            console.log("lost_items is accessible.");
        }
    });

    db.query(`SELECT serial_number FROM \`${LF_DB}\`.\`found_items\` LIMIT 1`, (error) => {
        if (error) {
            console.error("Table check failed (found_items):", error.message);
        } else {
            console.log("found_items is accessible.");
        }
    });
});

// ======================================================
// 3. LOST & FOUND ROUTER MOUNT
// ======================================================

const lostFoundRoutes = require("./routes/lostfound");

app.use(
    "/api/lost-found",
    (req, res, next) => {
        req.db = db;
        next();
    },
    lostFoundRoutes
);

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

// Only use table names from the fixed configuration above.
function getMenuTable(canteenId) {
    const canteen = getCanteen(canteenId);

    if (!canteen) {
        return null;
    }

    return `\`${DB}\`.\`${canteen.table}\``;
}

// ======================================================
// 4. MENU SQL HELPERS
// ======================================================

// Build a common menu query from the three real tables.
// item_id is used instead of the nonexistent id column.
function buildMenuUnion() {
    return Object.entries(canteens)
        .map(([canteenId, canteen]) => `
            SELECT
                CAST(item_id AS CHAR) AS item_id,
                '${canteenId}' AS canteen,
                item_name,
                category,
                price,
                description,
                is_available
            FROM \`${DB}\`.\`${canteen.table}\`
        `)
        .join("\nUNION ALL\n");
}

// Normalize the numeric database availability value.
// The UI can use either is_available or availability.
function normalizeMenuItem(item) {
    const isAvailable = Number(item.is_available) === 1;

    return {
        ...item,
        item_id: String(item.item_id),
        is_available: Number(item.is_available),
        availability: isAvailable
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
        `SELECT item_id FROM \`${DB}\`.\`campus_cafeteria\` LIMIT 1`,
        (err) => {
            if (err) {
                return sendDbError("Health check failed", res, err);
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
// GET /api/menu
// ======================================================

app.get("/api/menu", (req, res) => {
    const sql = `
        ${buildMenuUnion()}
        ORDER BY item_name
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            return sendDbError("Get all menu items failed", res, err);
        }

        res.set("Cache-Control", "no-store");
        res.json(rows.map(normalizeMenuItem));
    });
});

// ======================================================
// 9. GET MENU FOR ONE CANTEEN
// GET /api/menu/cafeteria
// GET /api/menu/timeless
// GET /api/menu/nescafe
// ======================================================

app.get("/api/menu/:canteen", (req, res) => {
    const canteenId = String(req.params.canteen || "").toLowerCase();
    const table = getMenuTable(canteenId);

    if (!table) {
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
            description,
            is_available
        FROM ${table}
        ORDER BY item_id
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
            rows.map((item) =>
                normalizeMenuItem({
                    ...item,
                    canteen: canteenId
                })
            )
        );
    });
});

// ======================================================
// 10. GET ONE MENU ITEM
// GET /api/item/cafeteria/1
// ======================================================

app.get("/api/item/:canteen/:id", (req, res) => {
    const canteenId = String(req.params.canteen || "").toLowerCase();
    const table = getMenuTable(canteenId);

    if (!table) {
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
            description,
            is_available
        FROM ${table}
        WHERE item_id = ?
        LIMIT 1
    `;

    db.query(sql, [req.params.id], (err, rows) => {
        if (err) {
            return sendDbError("Get menu item failed", res, err);
        }

        if (!rows.length) {
            return res.status(404).json({
                error: "Menu item not found"
            });
        }

        res.set("Cache-Control", "no-store");

        res.json(
            normalizeMenuItem({
                ...rows[0],
                canteen: canteenId
            })
        );
    });
});

// ======================================================
// 11. ADD FAVOURITE
// POST /api/favourites
// ======================================================

app.post("/api/favourites", (req, res) => {
    const visitorId = String(
        req.body.visitorId || req.body.visitor_id || ""
    ).trim();

    const canteenId = String(req.body.canteen || "").toLowerCase();

    const itemId = String(req.body.item_id ?? "").trim();
    const table = getMenuTable(canteenId);

    if (
        !visitorId ||
        visitorId.length > 100 ||
        !table ||
        !itemId
    ) {
        return res.status(400).json({
            error: "visitorId, canteen and item_id are required"
        });
    }

    const checkSql = `
        SELECT item_id
        FROM ${table}
        WHERE item_id = ?
        LIMIT 1
    `;

    db.query(checkSql, [itemId], (checkErr, rows) => {
        if (checkErr) {
            return sendDbError("Verify favourite failed", res, checkErr);
        }

        if (!rows.length) {
            return res.status(404).json({
                error: "Menu item not found"
            });
        }

        const insertSql = `
            INSERT IGNORE INTO \`${DB}\`.\`food_favourites\`
                (visitor_id, canteen, item_id)
            VALUES (?, ?, ?)
        `;

        db.query(
            insertSql,
            [visitorId, canteenId, itemId],
            (err, result) => {
                if (err) {
                    return sendDbError("Save favourite failed", res, err);
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
// 12. GET FAVOURITES FOR A VISITOR
// GET /api/favourites/:visitorId
// ======================================================

app.get("/api/favourites/:visitorId", (req, res) => {
    const visitorId = String(req.params.visitorId || "").trim();

    if (!visitorId || visitorId.length > 100) {
        return res.status(400).json({
            error: "Valid visitor ID required"
        });
    }

    const sql = `
        SELECT canteen, item_id
        FROM \`${DB}\`.\`food_favourites\`
        WHERE visitor_id = ?
    `;

    db.query(sql, [visitorId], (err, rows) => {
        if (err) {
            return sendDbError("Load favourites failed", res, err);
        }

        res.json(rows);
    });
});

// ======================================================
// 13. DELETE FAVOURITE
// DELETE /api/favourites
// ======================================================

app.delete("/api/favourites", (req, res) => {
    const visitorId = String(
        req.body.visitorId || req.body.visitor_id || ""
    ).trim();

    const canteenId = String(req.body.canteen || "").toLowerCase();
    const itemId = String(req.body.item_id ?? "").trim();

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
        DELETE FROM \`${DB}\`.\`food_favourites\`
        WHERE visitor_id = ?
          AND canteen = ?
          AND item_id = ?
    `;

    db.query(sql, [visitorId, canteenId, itemId], (err) => {
        if (err) {
            return sendDbError("Delete favourite failed", res, err);
        }

        res.json({
            success: true,
            favourited: false
        });
    });
});

// ======================================================
// 14. FAVOURITE COUNTS
// GET /api/favourites/counts
// ======================================================

app.get("/api/favourites/counts", (req, res) => {
    const sql = `
        SELECT
            canteen,
            item_id,
            COUNT(*) AS favourite_count
        FROM \`${DB}\`.\`food_favourites\`
        GROUP BY canteen, item_id
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            return sendDbError("Favourite counts failed", res, err);
        }

        res.json(rows);
    });
});

// ======================================================
// 15. TOP FAVOURITE
// GET /api/favourites/top
// ======================================================

app.get("/api/favourites/top", (req, res) => {
    const sql = `
        SELECT
            m.item_id,
            m.canteen,
            m.item_name,
            m.category,
            m.price,
            m.description,
            m.is_available,
            COUNT(f.item_id) AS favourite_count
        FROM (${buildMenuUnion()}) AS m
        LEFT JOIN \`${DB}\`.\`food_favourites\` AS f
          ON f.canteen = m.canteen
         AND CAST(f.item_id AS CHAR) = m.item_id
        GROUP BY
            m.item_id,
            m.canteen,
            m.item_name,
            m.category,
            m.price,
            m.description,
            m.is_available
        ORDER BY favourite_count DESC, m.item_name ASC
        LIMIT 1
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            return sendDbError("Top favourite query failed", res, err);
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
// GET /api/campus-picks
// ======================================================

app.get("/api/campus-picks", (req, res) => {
    const sql = `
        SELECT
            m.item_id,
            m.canteen,
            m.item_name,
            m.category,
            m.price,
            m.description,
            m.is_available,
            COUNT(f.item_id) AS favourite_count
        FROM (${buildMenuUnion()}) AS m
        INNER JOIN \`${DB}\`.\`food_favourites\` AS f
          ON f.canteen = m.canteen
         AND CAST(f.item_id AS CHAR) = m.item_id
        GROUP BY
            m.item_id,
            m.canteen,
            m.item_name,
            m.category,
            m.price,
            m.description,
            m.is_available
        ORDER BY favourite_count DESC, m.item_name ASC
        LIMIT 2
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            return sendDbError("Campus Picks query failed", res, err);
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
    console.log(`Campus Bites backend running on port ${PORT}`);
});
