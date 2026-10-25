"use strict";

const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const lostfoundRouter = require("./routes/lostfound");

const app = express();
const PORT = process.env.PORT || 3000;
const DB = "campus_canteen";

// ======================================================
// 1. MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const frontendPath = path.join(__dirname, "..", "lost_and_found");
const uploadsFolder = path.join(frontendPath, "uploads");
const backendUploadsFolder = path.join(__dirname, "uploads");

if (!fs.existsSync(backendUploadsFolder)) {
    fs.mkdirSync(backendUploadsFolder, { recursive: true });
}

app.use(
    "/food-images",
    express.static(path.join(__dirname, "food-images"))
);
app.use("/uploads", express.static(uploadsFolder));
app.use("/uploads", express.static(backendUploadsFolder));
app.use("/lost_and_found/uploads", express.static(uploadsFolder));
app.use("/lost_and_found/uploads", express.static(backendUploadsFolder));

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
    ssl:
        process.env.DB_SSL === "true" ||
        process.env.DB_SSL === "1"
            ? { rejectUnauthorized: false }
            : undefined
};

const db = mysql.createPool(poolConfig);

// Promise-based query helper for Razorpay routes.
function query(sql, params = []) {
    return db.promise().query(sql, params);
}

// ======================================================
// 3. LOST & FOUND ROUTER MOUNT
// ======================================================

app.use(
    "/api/lost-found",
    (req, res, next) => {
        req.db = db;
        next();
    },
    lostfoundRouter
);

function handleRouteError(message, res, err) {
    console.error(
        message,
        err && err.message ? err.message : err
    );

    if (!res.headersSent) {
        res.status(500).json({
            error: "Internal server error"
        });
    }
}

// ======================================================
// 3. DATABASE TABLE CONFIGURATION
// ======================================================

// The three canteens use separate database tables.
// Combine them into one virtual menu for the existing API.

const MENU_TABLE = `(
    SELECT
        item_id AS id,
        'cafeteria' AS canteen,
        item_name,
        category,
        price,
        availability,
        description,
        is_available
    FROM \`${DB}\`.\`campus_cafeteria\`

    UNION ALL

    SELECT
        item_id AS id,
        'timeless' AS canteen,
        item_name,
        category,
        price,
        availability,
        description,
        is_available
    FROM \`${DB}\`.\`cafe_timeless\`

    UNION ALL

    SELECT
        item_id AS id,
        'nescafe' AS canteen,
        item_name,
        category,
        price,
        availability,
        description,
        is_available
    FROM \`${DB}\`.\`nescafe\`
)`;

const FAVOURITES_TABLE =
    `\`${DB}\`.\`food_favourites\``;

// ======================================================
// 4. RAZORPAY INTEGRATION
// ======================================================

let razorpayClient;
let orderTablesPromise;

function getRazorpayClient() {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error("Razorpay is not configured");
    }

    if (!razorpayClient) {
        razorpayClient = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
    }

    return razorpayClient;
}

// The checkout is deployable against the existing database without a separate
// manual migration. A matching SQL migration is also included in backend/sql.
function ensureOrderTables() {
    if (!orderTablesPromise) {
        orderTablesPromise = Promise.all([
            query(`CREATE TABLE IF NOT EXISTS orders (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                razorpay_order_id VARCHAR(64) NOT NULL,
                razorpay_payment_id VARCHAR(64) DEFAULT NULL,
                canteen VARCHAR(100) NOT NULL,
                customer_name VARCHAR(80) NOT NULL,
                department VARCHAR(80) NOT NULL,
                customer_phone VARCHAR(15) NOT NULL,
                total_amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY unique_razorpay_order (razorpay_order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`),
            query(`CREATE TABLE IF NOT EXISTS order_items (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                razorpay_order_id VARCHAR(64) NOT NULL,
                item_name VARCHAR(150) NOT NULL,
                quantity INT UNSIGNED NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                PRIMARY KEY (id),
                KEY order_items_razorpay_order (razorpay_order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
        ]);
    }

    return orderTablesPromise;
}

function validateCustomerDetails(body) {
    const customerName = String(body.customer_name || "").trim();
    const department = String(body.department || "").trim();
    const phone = String(body.customer_phone || "").replace(/\D/g, "");
    const rollNumber = String(body.roll_number || "").trim();

    if (
        !customerName || customerName.length > 80 ||
        !department || department.length > 80 ||
        !/^\d{10}$/.test(phone) ||
        rollNumber.length > 40
    ) {
        return null;
    }

    return { customerName, department, phone, rollNumber };
}

async function getVerifiedCart(cartItems) {
    if (!Array.isArray(cartItems) || !cartItems.length || cartItems.length > 30) {
        throw new Error("Your cart is empty or invalid");
    }

    const verifiedItems = [];
    for (const rawItem of cartItems) {
        const itemId = Number(rawItem && rawItem.item_id);
        const quantity = Number(rawItem && rawItem.quantity);
        const canteen = normalizeCanteen(rawItem && rawItem.canteen);

        if (!Number.isInteger(itemId) || itemId < 1 ||
            !Number.isInteger(quantity) || quantity < 1 || quantity > 20 ||
            !canteen) {
            throw new Error("One or more cart items are invalid");
        }

        const [rows] = await query(
            `SELECT item_name, price, is_available
             FROM ${menuFrom()}
             WHERE id = ? AND LOWER(canteen) = ?
             LIMIT 1`,
            [itemId, canteen]
        );
        const menuItem = rows[0];
        if (!menuItem || Number(menuItem.is_available) !== 1) {
            throw new Error("An item in your cart is no longer available");
        }

        verifiedItems.push({
            item_id: itemId,
            canteen,
            item_name: String(menuItem.item_name),
            price: Number(menuItem.price),
            quantity
        });
    }

    const totalAmount = Number(verifiedItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
    ).toFixed(2));

    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || totalAmount > 10000) {
        throw new Error("The order total is invalid");
    }

    return { verifiedItems, totalAmount };
}

// Create Razorpay order.
app.post("/api/create-order", async (req, res) => {
    try {
        const customer = validateCustomerDetails(req.body || {});
        if (!customer) {
            return res.status(400).json({
                error: "Enter a name, department and a valid 10-digit phone number"
            });
        }

        const { verifiedItems, totalAmount } = await getVerifiedCart(
            req.body && req.body.cart_items
        );

        const options = {
            amount: Math.round(totalAmount * 100),
            currency: "INR",
            receipt: `cb_${Date.now()}`,
            notes: {
                department: customer.department,
                roll_number: customer.rollNumber || "Not provided"
            }
        };

        const razorpayOrder = await getRazorpayClient().orders.create(options);
        const canteensInOrder = [...new Set(
            verifiedItems.map((item) => item.canteen)
        )].join(", ");

        // Payment must not be blocked merely because the database account has
        // no CREATE privilege for the optional local order-audit tables.
        // The Razorpay order and its signature verification remain mandatory.
        let orderRecorded = true;
        try {
            await ensureOrderTables();
            await query(`
                INSERT INTO orders (razorpay_order_id, canteen, customer_name, department, customer_phone, total_amount, status)
                VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
            `, [
                razorpayOrder.id,
                canteensInOrder,
                customer.customerName,
                customer.department,
                customer.phone,
                totalAmount
            ]);

            for (const item of verifiedItems) {
                await query(`
                    INSERT INTO order_items (razorpay_order_id, item_name, quantity, price)
                    VALUES (?, ?, ?, ?)
                `, [razorpayOrder.id, item.item_name, item.quantity, item.price]);
            }
        } catch (databaseError) {
            orderRecorded = false;
            console.error(
                "Order audit could not be saved; continuing with Razorpay checkout:",
                databaseError.message
            );
        }

        res.json({ 
            order_id: razorpayOrder.id, 
            currency: razorpayOrder.currency, 
            amount: razorpayOrder.amount, 
            key: process.env.RAZORPAY_KEY_ID,
            order_recorded: orderRecorded
        });
    } catch (err) {
        if (err && /configured/i.test(err.message || "")) {
            return res.status(503).json({ error: err.message });
        }
        if (err && /cart|item|total/i.test(err.message || "")) {
            return res.status(400).json({ error: err.message });
        }
        handleRouteError("Razorpay order creation failed:", res, err);
    }
});

// Verify Razorpay payment signature.
app.post("/api/verify-payment", async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature
        ) {
            return res.status(400).json({
                success: false,
                error: "Payment verification details are missing"
            });
        }

        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({
                success: false,
                error: "Razorpay is not configured"
            });
        }

        const body =
            razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(body)
            .digest("hex");

        const signatureBuffer = Buffer.from(
            expectedSignature,
            "hex"
        );

        const receivedBuffer = Buffer.from(
            razorpay_signature,
            "hex"
        );

        const signatureIsValid =
            signatureBuffer.length === receivedBuffer.length &&
            crypto.timingSafeEqual(
                signatureBuffer,
                receivedBuffer
            );

        if (!signatureIsValid) {
            return res.status(400).json({
                success: false,
                error: "Invalid payment signature"
            });
        }

        let orderRecorded = true;
        try {
            await ensureOrderTables();
            const [result] = await query(
                `UPDATE orders
                 SET razorpay_payment_id = ?,
                     status = 'PAID'
                 WHERE razorpay_order_id = ?
                   AND status = 'PENDING'`,
                [
                    razorpay_payment_id,
                    razorpay_order_id
                ]
            );

            if (result.affectedRows === 0) {
                const [orders] = await query(
                    `SELECT status
                     FROM orders
                     WHERE razorpay_order_id = ?
                     LIMIT 1`,
                    [razorpay_order_id]
                );

                if (orders.length && orders[0].status !== "PAID") {
                    throw new Error("Order could not be marked as paid");
                }
            }
        } catch (databaseError) {
            orderRecorded = false;
            console.error(
                "Payment was verified but the order audit could not be updated:",
                databaseError.message
            );
        }

        return res.json({
            success: true,
            message: "Payment verified successfully",
            order_recorded: orderRecorded
        });
    } catch (err) {
        handleRouteError(
            "Payment verification failed:",
            res,
            err
        );
    }
});

// ======================================================
// 5. CANTEEN CONFIGURATION
// ======================================================

const canteens = {
    cafeteria: "Cafeteria",
    timeless: "Timeless",
    nescafe: "Nescafe"
};

function normalizeCanteen(value) {
    const key = String(value || "")
        .trim()
        .toLowerCase();

    return Object.prototype.hasOwnProperty.call(
        canteens,
        key
    )
        ? key
        : null;
}

function normalizeItem(row) {
    const available = Number(row.is_available) === 1;

    return {
        ...row,
        id: row.id == null
            ? undefined
            : Number(row.id),
        item_id: String(row.id),
        canteen: String(row.canteen || "").toLowerCase(),
        is_available: Number(row.is_available),
        availability: available
            ? "Available"
            : "Not Available"
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

// Use the same virtual menu with a specific SQL alias.
// This prevents invalid SQL when joining favourites.
function menuFrom(alias = "menu_items") {
    return `${MENU_TABLE} AS ${alias}`;
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
        `SELECT 1 FROM ${menuFrom()} LIMIT 1`,
        (err) => {
            if (err) {
                console.error(
                    "Health check failed:",
                    err.message
                );

                return res.status(500).json({
                    status: "error"
                });
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
        Object.entries(canteens).map(
            ([id, name]) => ({ id, name })
        )
    );
});

// ======================================================
// 8. GET ALL MENU ITEMS
// GET /api/menu
// ======================================================

app.get("/api/menu", (req, res) => {
    const sql = `
        SELECT ${MENU_COLUMNS}
        FROM ${menuFrom()}
        ORDER BY item_name
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.error(
                "Get all menu items failed:",
                err.message
            );

            return res.status(500).json({
                error: "Could not load menu items"
            });
        }

        res.set("Cache-Control", "no-store");
        res.json(rows.map(normalizeItem));
    });
});

// ======================================================
// 9. GET MENU FOR ONE CANTEEN
// ======================================================

app.get("/api/menu/:canteen", (req, res) => {
    const canteen = normalizeCanteen(
        req.params.canteen
    );

    if (!canteen) {
        return res.status(404).json({
            error: "Canteen not found"
        });
    }

    const sql = `
        SELECT ${MENU_COLUMNS}
        FROM ${menuFrom()}
        WHERE LOWER(canteen) = ?
        ORDER BY item_name
    `;

    db.query(sql, [canteen], (err, rows) => {
        if (err) {
            console.error(
                `Get ${canteen} menu failed:`,
                err.message
            );

            return res.status(500).json({
                error: "Could not load menu items"
            });
        }

        res.set("Cache-Control", "no-store");
        res.json(rows.map(normalizeItem));
    });
});

// ======================================================
// 10. GET ONE MENU ITEM
// GET /api/item/cafeteria/25
// ======================================================

app.get("/api/item/:canteen/:id", (req, res) => {
    const canteen = normalizeCanteen(
        req.params.canteen
    );

    const itemId = Number(req.params.id);

    if (
        !canteen ||
        !Number.isInteger(itemId) ||
        itemId < 1
    ) {
        return res.status(400).json({
            error: "Invalid canteen or item ID"
        });
    }

    const sql = `
        SELECT ${MENU_COLUMNS}
        FROM ${menuFrom()}
        WHERE id = ?
          AND LOWER(canteen) = ?
        LIMIT 1
    `;

    db.query(
        sql,
        [itemId, canteen],
        (err, rows) => {
            if (err) {
                console.error(
                    "Get menu item failed:",
                    err.message
                );

                return res.status(500).json({
                    error: "Could not load menu item"
                });
            }

            if (!rows.length) {
                return res.status(404).json({
                    error: "Menu item not found"
                });
            }

            res.set("Cache-Control", "no-store");
            res.json(normalizeItem(rows[0]));
        }
    );
});

// ======================================================
// 11. ADD FAVOURITE
// POST /api/favourites
// ======================================================

app.post("/api/favourites", (req, res) => {
    const visitorId = String(
        req.body.visitorId ||
        req.body.visitor_id ||
        ""
    ).trim();

    const canteen = normalizeCanteen(
        req.body.canteen
    );

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
        `SELECT id
         FROM ${menuFrom()}
         WHERE id = ?
           AND LOWER(canteen) = ?
         LIMIT 1`,
        [itemId, canteen],
        (checkErr, rows) => {
            if (checkErr) {
                console.error(
                    "Verify favourite failed:",
                    checkErr.message
                );

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

            db.query(
                sql,
                [visitorId, canteen, itemId],
                (err, result) => {
                    if (err) {
                        console.error(
                            "Save favourite failed:",
                            err.message
                        );

                        return res.status(500).json({
                            error: "Could not save favourite"
                        });
                    }

                    res.json({
                        success: true,
                        favourited: true,
                        alreadyFavourited:
                            result.affectedRows === 0
                    });
                }
            );
        }
    );
});

// ======================================================
// 12. GET FAVOURITES FOR A VISITOR
// GET /api/favourites/:visitorId
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

    db.query(
        `SELECT canteen, item_id
         FROM ${FAVOURITES_TABLE}
         WHERE visitor_id = ?`,
        [visitorId],
        (err, rows) => {
            if (err) {
                console.error(
                    "Load favourites failed:",
                    err.message
                );

                return res.status(500).json({
                    error: "Could not load favourites"
                });
            }

            res.json(rows);
        }
    );
});

// ======================================================
// 13. DELETE FAVOURITE
// DELETE /api/favourites
// ======================================================

app.delete("/api/favourites", (req, res) => {
    const visitorId = String(
        req.body.visitorId ||
        req.body.visitor_id ||
        ""
    ).trim();

    const canteen = normalizeCanteen(
        req.body.canteen
    );

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
         WHERE visitor_id = ?
           AND canteen = ?
           AND item_id = ?`,
        [visitorId, canteen, itemId],
        (err) => {
            if (err) {
                console.error(
                    "Delete favourite failed:",
                    err.message
                );

                return res.status(500).json({
                    error: "Could not delete favourite"
                });
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
// GET /api/favourites/counts
// ======================================================

app.get("/api/favourites/counts", (req, res) => {
    db.query(
        `SELECT
            canteen,
            item_id,
            COUNT(*) AS favourite_count
         FROM ${FAVOURITES_TABLE}
         GROUP BY canteen, item_id`,
        (err, rows) => {
            if (err) {
                console.error(
                    "Favourite counts failed:",
                    err.message
                );

                return res.status(500).json({
                    error: "Could not load favourite counts"
                });
            }

            res.json(rows);
        }
    );
});

// ======================================================
// 15. TOP FAVOURITE
// GET /api/favourites/top
// ======================================================

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
        FROM ${menuFrom("m")}
        LEFT JOIN ${FAVOURITES_TABLE} AS f
          ON LOWER(f.canteen) = LOWER(m.canteen)
         AND CAST(f.item_id AS CHAR) = CAST(m.id AS CHAR)
        GROUP BY
            m.id,
            m.canteen,
            m.item_name,
            m.category,
            m.price,
            m.availability,
            m.description,
            m.is_available
        ORDER BY
            favourite_count DESC,
            m.item_name ASC
        LIMIT 1
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.error(
                "Top favourite query failed:",
                err.message
            );

            return res.status(500).json({
                error: "Could not load top favourite"
            });
        }

        if (!rows.length) {
            return res.status(404).json({
                error: "No menu items found"
            });
        }

        res.json({
            ...normalizeItem(rows[0]),
            favourite_count:
                Number(rows[0].favourite_count)
        });
    });
});

// ======================================================
// 16. CAMPUS PICKS
// GET /api/campus-picks
// ======================================================

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
        FROM ${menuFrom("m")}
        INNER JOIN ${FAVOURITES_TABLE} AS f
          ON LOWER(f.canteen) = LOWER(m.canteen)
         AND CAST(f.item_id AS CHAR) = CAST(m.id AS CHAR)
        GROUP BY
            m.id,
            m.canteen,
            m.item_name,
            m.category,
            m.price,
            m.availability,
            m.description,
            m.is_available
        ORDER BY
            favourite_count DESC,
            m.item_name ASC
        LIMIT 2
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.error(
                "Campus Picks query failed:",
                err.message
            );

            return res.status(500).json({
                error: "Could not load Campus Picks"
            });
        }

        res.json(
            rows.map((row) => ({
                ...normalizeItem(row),
                favourite_count:
                    Number(row.favourite_count)
            }))
        );
    });
});

// ======================================================
// 17. ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {
    console.error(
        "Unhandled request error:",
        err.message
    );

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
