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
const PORT = Number(process.env.PORT || 3000);

// -----------------------------------------------------
// MIDDLEWARE
// -----------------------------------------------------

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// -----------------------------------------------------
// DATABASE CONNECTION (Aiven / Production / Local campusconnect)
// -----------------------------------------------------

const poolConfig = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "campusconnect",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
};

if (process.env.DB_SSL === "true" || process.env.DB_SSL === "1") {
    poolConfig.ssl = { rejectUnauthorized: false };
}

const db = mysql.createPool(poolConfig);

db.getConnection(function (error, connection) {
    if (error) {
        console.log("MySQL pool connection failed:", error.message || error);
        return;
    }

    console.log("MySQL pool connected successfully!");
    connection.release();
});

// -----------------------------------------------------
// PATH CONFIGURATION
// -----------------------------------------------------

const rootPath = path.join(__dirname, "..");
const frontendPath = path.join(rootPath, "lost_and_found");
const canteenPath = path.join(rootPath, "canteen");
const mainPath = path.join(rootPath, "Main");
const foodImagesFolder = path.join(__dirname, "food-images");
const uploadsFolder = path.join(frontendPath, "uploads");

if (!fs.existsSync(foodImagesFolder)) {
    fs.mkdirSync(foodImagesFolder, { recursive: true });
}

// -----------------------------------------------------
// LOST & FOUND ROUTES MOUNT
// -----------------------------------------------------

const lostFoundRoutes = require("./routes/lostfound");

app.use(
    "/api/lost-found",
    function (req, res, next) {
        req.db = db;
        next();
    },
    lostFoundRoutes
);

// -----------------------------------------------------
// STATIC FILES
// -----------------------------------------------------

app.use(express.static(rootPath));
app.use(express.static(frontendPath));
app.use("/Main", express.static(mainPath));
app.use("/canteen", express.static(canteenPath));
app.use("/lost_and_found", express.static(frontendPath));
app.use("/food-images", express.static(foodImagesFolder));
app.use("/uploads", express.static(uploadsFolder));
app.use("/lost_and_found/uploads", express.static(uploadsFolder));

// Also support uploaded images from the frontend directory
app.use(
    "/uploads",
    express.static(path.join(rootPath, "lost_and_found", "uploads"))
);

// -----------------------------------------------------
// HEALTH CHECK
// -----------------------------------------------------

app.get("/health", function (req, res) {
    res.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// -----------------------------------------------------
// EXPLICIT PAGE ROUTES
// -----------------------------------------------------

app.get(["/", "/index.html"], function (req, res) {
    res.sendFile(path.join(rootPath, "index.html"));
});

app.get("/landing.html", function (req, res) {
    res.sendFile(path.join(rootPath, "landing.html"));
});

app.get([
    "/lost",
    "/lost_and_found",
    "/lost_and_found/",
    "/lost_and_found/lost.html",
    "/lost_and_found/lost.php",
    "/lost_and_found/reportlostitem.php",
    "/lost_and_found/reportfounditem.php"
], function (req, res) {
    res.sendFile(path.join(frontendPath, "lost.html"));
});

app.get([
    "/lost_and_found/lost-items.html",
    "/lost_and_found/lost-items.php"
], function (req, res) {
    res.sendFile(path.join(frontendPath, "lost-items.html"));
});

app.get([
    "/lost_and_found/found-items.html",
    "/lost_and_found/found-items.php"
], function (req, res) {
    res.sendFile(path.join(frontendPath, "found-items.html"));
});

app.get([
    "/lost_and_found/browse.html",
    "/lost_and_found/browse.php"
], function (req, res) {
    res.sendFile(path.join(frontendPath, "browse.html"));
});

app.get(["/canteen", "/canteen/"], function (req, res) {
    res.sendFile(path.join(canteenPath, "index.html"));
});

// =====================================================
// CANTEEN HELPERS & APIS
// =====================================================

const canteens = {
    cafeteria: "Cafeteria",
    timeless: "Timeless",
    nescafe: "Nescafe"
};

function normaliseCanteen(value) {
    const id = String(value || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(canteens, id) ? id : null;
}

function sendDbError(label, res, error) {
    console.error(`${label}:`, error.message || error);
    return res.status(500).json({
        error: "Database request failed"
    });
}

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

// 1. GET CANTEENS LIST
app.get("/api/canteens", (req, res) => {
    res.json(
        Object.entries(canteens).map(([id, name]) => ({
            id,
            name
        }))
    );
});

// 2. GET ALL MENU ITEMS
app.get("/api/menu", (req, res) => {
    const queries = {
        cafeteria: "SELECT item_id, item_name, category, price, availability, description FROM campus_cafeteria",
        timeless: "SELECT item_id, item_name, category, price, availability, description FROM cafe_timeless",
        nescafe: "SELECT item_id, item_name, category, price, availability, description FROM nescafe"
    };

    db.query(queries.cafeteria, function (errCaf, cafeteria) {
        if (errCaf) return sendDbError("Get all menu items failed", res, errCaf);

        db.query(queries.timeless, function (errTime, timeless) {
            if (errTime) return sendDbError("Get all menu items failed", res, errTime);

            db.query(queries.nescafe, function (errNesc, nescafe) {
                if (errNesc) return sendDbError("Get all menu items failed", res, errNesc);

                const allItems = [
                    ...(cafeteria || []).map(item => ({ ...item, canteen: "cafeteria" })),
                    ...(timeless || []).map(item => ({ ...item, canteen: "timeless" })),
                    ...(nescafe || []).map(item => ({ ...item, canteen: "nescafe" }))
                ];
                res.set("Cache-Control", "no-store");
                res.json(allItems);
            });
        });
    });
});

// 3. GET ALL CANTEENS MENU (legacy /api/menu/all format)
app.get("/api/menu/all", function (req, res) {
    const queries = {
        cafeteria: "SELECT item_id, item_name, category, price, availability, description FROM campus_cafeteria",
        timeless: "SELECT item_id, item_name, category, price, availability, description FROM cafe_timeless",
        nescafe: "SELECT item_id, item_name, category, price, availability, description FROM nescafe"
    };

    db.query(queries.cafeteria, function (error, cafeteria) {
        if (error) {
            console.log("Cafeteria error:", error);
            return res.status(500).json({ error: "Could not load cafeteria menu" });
        }

        db.query(queries.timeless, function (errTime, timeless) {
            if (errTime) {
                console.log("Timeless error:", errTime);
                return res.status(500).json({ error: "Could not load Timeless menu" });
            }

            db.query(queries.nescafe, function (errNesc, nescafe) {
                if (errNesc) {
                    console.log("Nescafe error:", errNesc);
                    return res.status(500).json({ error: "Could not load Nescafe menu" });
                }

                const allItems = [
                    ...(cafeteria || []).map(item => ({ ...item, canteen: "Cafeteria" })),
                    ...(timeless || []).map(item => ({ ...item, canteen: "Timeless" })),
                    ...(nescafe || []).map(item => ({ ...item, canteen: "Nescafe" }))
                ];

                res.json(allItems);
            });
        });
    });
});

// 4. GET MENU FOR ONE CANTEEN
app.get("/api/menu/:canteen", (req, res) => {
    const rawCanteen = req.params.canteen;
    const canteen = normaliseCanteen(rawCanteen) || rawCanteen.toLowerCase();
    const tableNames = {
        cafeteria: "campus_cafeteria",
        timeless: "cafe_timeless",
        nescafe: "nescafe"
    };

    const tableName = tableNames[canteen];

    if (!tableName) {
        return res.status(404).json({ error: "Canteen not found" });
    }

    const query = `
        SELECT item_id, item_name, category, price,
               availability, description
        FROM ${tableName}
    `;

    db.query(query, function (tbErr, results) {
        if (tbErr) {
            return sendDbError("Get canteen menu failed", res, tbErr);
        }

        res.set("Cache-Control", "no-store");
        res.json(results.map(item => ({ ...item, canteen })));
    });
});

// 5. GET ONE MENU ITEM
app.get("/api/item/:canteen/:id", (req, res) => {
    const rawCanteen = req.params.canteen;
    const canteen = normaliseCanteen(rawCanteen) || rawCanteen.toLowerCase();
    const itemId = Number(req.params.id);

    if (!canteen || !Number.isInteger(itemId) || itemId <= 0) {
        return res.status(400).json({
            error: "Invalid canteen or item ID"
        });
    }

    const tableNames = {
        cafeteria: "campus_cafeteria",
        timeless: "cafe_timeless",
        nescafe: "nescafe"
    };
    const tableName = tableNames[canteen];

    if (!tableName) {
        return res.status(404).json({ error: "Menu item not found" });
    }

    const query = `
        SELECT item_id, item_name, category, price,
               availability, description
        FROM ${tableName}
        WHERE item_id = ?
        LIMIT 1
    `;

    db.query(query, [itemId], (tbErr, results) => {
        if (tbErr || !results || results.length === 0) {
            return res.status(404).json({ error: "Menu item not found" });
        }

        res.set("Cache-Control", "no-store");
        res.json({ ...results[0], canteen });
    });
});

// 6. SAVE FAVOURITE
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
                alreadyFavourited: result ? result.affectedRows === 0 : false
            });
        }
    );
});

// 7. GET FAVOURITES FOR A VISITOR
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

// 8. REMOVE FAVOURITE
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

// 9. FAVOURITE COUNTS
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

// 10. TOP FAVOURITE DISH
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
            if (!error && rows && rows.length > 0) {
                return res.json(rows[0]);
            }

            // Fallback: return first item from cafeteria
            db.query(
                "SELECT item_id, item_name, category, price, availability, description FROM campus_cafeteria LIMIT 1",
                (fbErr, fbRows) => {
                    if (fbErr || !fbRows || fbRows.length === 0) {
                        return res.status(404).json({ error: "No menu items found" });
                    }
                    res.json({ ...fbRows[0], canteen: "cafeteria", favourite_count: 0 });
                }
            );
        }
    );
});

// 11. TODAY'S CAMPUS PICKS
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
            if (!error && rows && rows.length > 0) {
                res.set("Cache-Control", "no-store");
                return res.json(rows);
            }

            // Fallback: picks from campus_cafeteria
            db.query(
                "SELECT item_id, item_name, category, price, availability, description FROM campus_cafeteria LIMIT 2",
                (fbErr, fbRows) => {
                    if (fbErr || !fbRows || fbRows.length === 0) {
                        return sendDbError("Get Campus Picks failed", res, fbErr || new Error("No items found"));
                    }
                    res.set("Cache-Control", "no-store");
                    res.json(fbRows.map(item => ({ ...item, canteen: "cafeteria", favourite_count: 0 })));
                }
            );
        }
    );
});

// 12. FOOD IMAGE GENERATOR
app.get(
    "/api/food-image/:canteen/:foodName",
    async function (req, res) {
        const canteen = req.params.canteen;
        const foodName = req.params.foodName;

        const safeCanteen = canteen.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const safeFoodName = foodName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const fileName = safeCanteen + "-" + safeFoodName + ".jpg";
        const filePath = path.join(foodImagesFolder, fileName);

        if (fs.existsSync(filePath)) {
            console.log("Using saved image:", fileName);
            return res.json({
                image: "/food-images/" + fileName
            });
        }

        console.log("Generating AI image for:", foodName);

        const prompt =
            "Professional realistic food photography of " +
            foodName +
            ", Indian college cafeteria food, appetizing presentation, " +
            "served on a clean ceramic plate, warm natural lighting, " +
            "close-up food photography, realistic texture, high quality, " +
            "no people, no text, no watermark";

        const imageURL =
            "https://image.pollinations.ai/prompt/" +
            encodeURIComponent(prompt) +
            "?model=flux&width=600&height=400&nologo=true&private=true";

        try {
            const response = await fetch(imageURL);

            if (!response.ok) {
                throw new Error(
                    "AI image generation failed: " + response.status
                );
            }

            const imageBuffer = Buffer.from(
                await response.arrayBuffer()
            );

            fs.writeFileSync(filePath, imageBuffer);

            console.log("Image saved:", fileName);

            res.json({
                image: "/food-images/" + fileName
            });
        } catch (error) {
            console.log("AI image error:", error.message);

            res.status(500).json({
                error: "Could not generate food image"
            });
        }
    }
);

// -----------------------------------------------------
// GLOBAL ERROR HANDLER
// -----------------------------------------------------

app.use((error, req, res, next) => {
    console.error("Unhandled request error:", error.message || error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        error: "Internal server error"
    });
});

// -----------------------------------------------------
// START SERVER
// -----------------------------------------------------

app.listen(PORT, "0.0.0.0", function () {
    console.log(`Server running at http://localhost:${PORT}`);
});
