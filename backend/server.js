
"use strict";

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB = "campus_canteen";

app.use(cors());
app.use(express.json());
app.use(
    "/food-images",
    express.static(path.join(__dirname, "food-images"))
);

// Connect to MySQL. Table queries below explicitly use campus_canteen.
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

    db.query("SELECT DATABASE() AS selectedDatabase", (error, rows) => {
        if (error) {
            console.error("Database check failed:", error.message);
            return;
        }

        console.log("Default database:", rows[0].selectedDatabase);
        console.log("Queries explicitly use:", DB);
    });
});

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

function menuUnion() {
    return `
        SELECT item_id, item_name, category, price,
               availability, description, 'cafeteria' AS canteen
        FROM ${DB}.campus_cafeteria

        UNION ALL

        SELECT item_id, item_name, category, price,
               availability, description, 'timeless' AS canteen
        FROM ${DB}.cafe_timeless

        UNION ALL

        SELECT item_id, item_name, category, price,
               availability, description, 'nescafe' AS canteen
        FROM ${DB}.nescafe
    `;
}

app.get("/", (req, res) => {
    res.json({ message: "Campus Connect Canteens Backend is running!" });
});

app.get("/health", (req, res) => {
    db.query(`SELECT 1 FROM ${DB}.food_favourites LIMIT 1`, (err) => {
        if (err) {
            return res.status(500).json({
                status: "error",
                message: err.message
            });
        }

        res.json({ status: "ok", database: DB });
    });
});

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
    db.query(menuUnion(), (err, results) => {
        if (err) {
            console.error("Menu error:", err.message);
            return res.status(500).json({ error: err.message });
        }

        res.json(results);
    });
});

// Get menu items for one canteen.
app.get("/api/menu/:canteen", (req, res) => {
    const canteen = getCanteen(req.params.canteen);

    if (!canteen) {
        return res.status(404).json({ error: "Canteen not found" });
    }

    const sql = `
        SELECT item_id, item_name, category, price,
               availability, description
        FROM ${DB}.${canteen.table}
        ORDER BY item_id
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Canteen menu error:", err.message);
            return res.status(500).json({ error: err.message });
        }

        res.json(results);
    });
});

// Get one menu item.
app.get("/api/item/:canteen/:id", (req, res) => {
    const canteen = getCanteen(req.params.canteen);

    if (!canteen) {
        return res.status(404).json({ error: "Canteen not found" });
    }

    const sql = `
        SELECT item_id, item_name, category, price,
               availability, description
        FROM ${DB}.${canteen.table}
        WHERE item_id = ?
        LIMIT 1
    `;

    db.query(sql, [req.params.id], (err, rows) => {
        if (err) {
            console.error("Item lookup error:", err.message);
            return res.status(500).json({ error: err.message });
        }

        if (!rows.length) {
            return res.status(404).json({ error: "Item not found" });
        }

        res.json(rows[0]);
    });
});

// Save a favourite.
app.post("/api/favourites", (req, res) => {
    const visitorId = String(
        req.body.visitorId || req.body.visitor_id || ""
    ).trim();

    const canteenId = String(req.body.canteen || "").toLowerCase();
    const itemId = String(req.body.item_id ?? "").trim();
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
            console.error("Verify item error:", checkError.message);
            return res.status(500).json({ error: checkError.message });
        }

        if (!items.length) {
            return res.status(404).json({ error: "Menu item not found" });
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
                    console.error("Save favourite error:", err.message);
                    return res.status(500).json({ error: err.message });
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

// Load favourites for a visitor.
app.get("/api/favourites/:visitorId", (req, res) => {
    const visitorId = String(req.params.visitorId || "").trim();

    if (!visitorId || visitorId.length > 100) {
        return res.status(400).json({ error: "Valid visitor ID required" });
    }

    const sql = `
        SELECT canteen, item_id
        FROM ${DB}.food_favourites
        WHERE visitor_id = ?
    `;

    db.query(sql, [visitorId], (err, rows) => {
        if (err) {
            console.error("Load favourites error:", err.message);
            return res.status(500).json({ error: err.message });
        }

        res.json(rows);
    });
});

// Remove a favourite.
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
        !itemId ||
        itemId.length > 100
    ) {
        return res.status(400).json({
            error: "visitorId, canteen and item_id are required"
        });
    }

    const sql = `
        DELETE FROM ${DB}.food_favourites
        WHERE visitor_id = ? AND canteen = ? AND item_id = ?
    `;

    db.query(sql, [visitorId, canteenId, itemId], (err) => {
        if (err) {
            console.error("Remove favourite error:", err.message);
            return res.status(500).json({ error: err.message });
        }

        res.json({ success: true, favourited: false });
    });
});

// Favourite counts for all dishes.
app.get("/api/favourites/counts", (req, res) => {
    const sql = `
        SELECT canteen, item_id, COUNT(*) AS favourite_count
        FROM ${DB}.food_favourites
        GROUP BY canteen, item_id
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.error("Favourite counts error:", err.message);
            return res.status(500).json({ error: err.message });
        }

        res.json(rows);
    });
});

// Most-favourited dish.
app.get("/api/favourites/top", (req, res) => {
    const sql = `
        SELECT menu.*,
               COALESCE(f.favourite_count, 0) AS favourite_count
        FROM (${menuUnion()}) AS menu
        LEFT JOIN (
            SELECT canteen, item_id, COUNT(*) AS favourite_count
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
            console.error("Top favourite error:", err.message);
            return res.status(500).json({ error: err.message });
        }

        if (!rows.length) {
            return res.status(404).json({ error: "No menu items found" });
        }

        res.json(rows[0]);
    });
});

// Campus Picks: top two dishes, ranked by number of favourites.
app.get("/api/campus-picks", (req, res) => {
    const sql = `
        SELECT menu.*,
               COUNT(f.id) AS favourite_count
        FROM (${menuUnion()}) AS menu
        INNER JOIN ${DB}.food_favourites AS f
          ON f.canteen = menu.canteen
         AND f.item_id = menu.item_id
        GROUP BY
            menu.item_id, menu.item_name, menu.category,
            menu.price, menu.availability, menu.description,
            menu.canteen
        ORDER BY favourite_count DESC, menu.item_name ASC
        LIMIT 2
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.error("Campus Picks error:", err.message);
            return res.status(500).json({ error: err.message });
        }

        res.json(rows);
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Campus Connect Canteens Backend running on port ${PORT}`);
});
