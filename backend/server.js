
"use strict";

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

// ======================================================
// 1. MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json());

app.use("/food-images", express.static(
    require("path").join(__dirname, "food-images")
));

//RAZORPAY INTEGRATION
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 1. Create a Razorpay Order
app.post("/api/create-order", async (req, res) => {
    try {
        const { amount, canteen, customer_name, customer_phone } = req.body;

        // Razorpay expects amount in paise (1 INR = 100 paise)
        const options = {
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // Save pending order to database
        await query(`
            INSERT INTO orders (razorpay_order_id, canteen, customer_name, customer_phone, total_amount, status)
            VALUES (?, ?, ?, ?, ?, 'PENDING')
        `, [razorpayOrder.id, canteen, customer_name, customer_phone, amount]);

        res.json({
            order_id: razorpayOrder.id,
            currency: razorpayOrder.currency,
            amount: razorpayOrder.amount,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (err) {
        handleRouteError("Razorpay order creation failed:", res, err);
    }
});

// 2. Verify Razorpay Payment Signature
app.post("/api/verify-payment", async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // Verify HMAC-SHA256 signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature === razorpay_signature) {
            // Update order status in DB to PAID
            await query(`
                UPDATE orders 
                SET razorpay_payment_id = ?, status = 'PAID' 
                WHERE razorpay_order_id = ?
            `, [razorpay_payment_id, razorpay_order_id]);

            res.json({ success: true, message: "Payment verified successfully" });
        } else {
            res.status(400).json({ success: false, error: "Invalid payment signature" });
        }
    } catch (err) {
        handleRouteError("Payment verification failed:", res, err);
    }
});


// ======================================================
// 2. MYSQL CONNECTION
// ======================================================

const poolConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306),
    database: DB,
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
