
"use strict";

// ======================================================
// 1. IMPORTS AND CONFIGURATION
// ======================================================

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();

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
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

db.connect((err) => {
    if (err) {
        console.error("MySQL connection failed:", err.message);
        return;
    }

    console.log("MySQL connected successfully!");
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

// ======================================================
// 4. HELPER: GET MENU TABLE
// ======================================================

function getCanteen(canteen) {
    return canteens[String(canteen || "").toLowerCase()];
}

// ======================================================
// 5. HOME / TEST ROUTE
// ======================================================

app.get("/", (req, res) => {
    res.json({
        message: "Campus Connect Canteens Backend is running!"
    });
});

// ======================================================
// 6. GET ALL CANTEENS
// ======================================================

app.get("/api/canteens", (req, res) => {
    res.json(
        Object.keys(canteens).map((id) => ({
            id,
            name: canteens[id].name
        }))
    );
});

// ======================================================
// 7. GET ALL MENU ITEMS
// ======================================================

app.get("/api/menu", (req, res) => {
    const sql = `
        SELECT item_id, item_name, category, price,
               availability, description, 'cafeteria' AS canteen
        FROM campus_cafeteria

        UNION ALL

        SELECT item_id, item_name, category, price,
               availability, description, 'timeless' AS canteen
        FROM cafe_timeless

        UNION ALL

        SELECT item_id, item_name, category, price,
               availability, description, 'nescafe' AS canteen
        FROM nescafe
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("All menu query error:", err.message);
            return res.status(500).json({
                error: "Failed to fetch all menus"
            });
        }

        res.json(results);
    });
});

// ======================================================
// 8. GET MENU BY CANTEEN
// ======================================================

app.get("/api/menu/:canteen", (req, res) => {
    const canteenId = req.params.canteen.toLowerCase();
    const canteen = getCanteen(canteenId);

    if (!canteen) {
        return res.status(404).json({
            error: "Canteen not found"
        });
    }

    const sql = `
        SELECT item_id, item_name, category, price,
               availability, description
        FROM ${canteen.table}
        ORDER BY item_id
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Menu query error:", err.message);
            return res.status(500).json({
                error: "Failed to fetch menu"
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
    const itemId = req.params.id;

    if (!canteen) {
        return res.status(404).json({
            error: "Canteen not found"
        });
    }

    const sql = `
        SELECT item_id, item_name, category, price,
               availability, description
        FROM ${canteen.table}
        WHERE item_id = ?
    `;

    db.query(sql, [itemId], (err, results) => {
        if (err) {
            console.error("Item query error:", err.message);
            return res.status(500).json({
                error: "Failed to fetch item"
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
// 10. ADD A FAVOURITE
// ======================================================

app.post("/api/favourites", (req, res) => {
    const { visitorId, canteen, item_id } = req.body;

    const canteenId = String(canteen || "").toLowerCase();
    const visitor = String(visitorId || "").trim();
    const itemId = String(item_id ?? "").trim();

    if (
        !visitor ||
        visitor.length > 100 ||
        !getCanteen(canteenId) ||
        !itemId ||
        itemId.length > 100
    ) {
        return res.status(400).json({
            error: "Valid visitorId, canteen and item_id are required"
        });
    }

    const menuTable = getCanteen(canteenId).table;

    // Verify that the menu item really exists.
    db.query(
        `SELECT item_id FROM ${menuTable} WHERE item_id = ? LIMIT 1`,
        [itemId],
        (itemError, items) => {
            if (itemError) {
                console.error("Favourite item lookup error:", itemError.message);
                return res.status(500).json({
                    error: "Could not verify menu item"
                });
            }

            if (items.length === 0) {
                return res.status(404).json({
                    error: "Menu item not found"
                });
            }

            // INSERT IGNORE prevents duplicate favourites from one visitor.
            const sql = `
                INSERT IGNORE INTO food_favourites
                    (visitor_id, canteen, item_id)
                VALUES (?, ?, ?)
            `;

            db.query(
                sql,
                [visitor, canteenId, itemId],
                (err, result) => {
                    if (err) {
                        console.error("Save favourite error:", err.message);
                        return res.status(500).json({
                            error: "Could not save favourite"
                        });
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

// ======================================================
// 11. REMOVE A FAVOURITE
// ======================================================

app.delete("/api/favourites", (req, res) => {
    const { visitorId, canteen, item_id } = req.body;

    const canteenId = String(canteen || "").toLowerCase();
    const visitor = String(visitorId || "").trim();
    const itemId = String(item_id ?? "").trim();

    if (
        !visitor ||
        visitor.length > 100 ||
        !getCanteen(canteenId) ||
        !itemId ||
        itemId.length > 100
    ) {
        return res.status(400).json({
            error: "Valid visitorId, canteen and item_id are required"
        });
    }

    const sql = `
        DELETE FROM food_favourites
        WHERE visitor_id = ?
          AND canteen = ?
          AND item_id = ?
    `;

    db.query(sql, [visitor, canteenId, itemId], (err) => {
        if (err) {
            console.error("Remove favourite error:", err.message);
            return res.status(500).json({
                error: "Could not remove favourite"
            });
        }

        res.json({
            success: true,
            favourited: false
        });
    });
});

// ======================================================
// 12. GET THE MOST-FAVOURITED DISH
// ======================================================

app.get("/api/favourites/top", (req, res) => {
    const sql = `
        SELECT
            menu.item_id,
            menu.item_name,
            menu.category,
            menu.price,
            menu.availability,
            menu.description,
            menu.canteen,
            COALESCE(favourites.favourite_count, 0) AS favourite_count
        FROM (
            SELECT item_id, item_name, category, price,
                   availability, description, 'cafeteria' AS canteen
            FROM campus_cafeteria

            UNION ALL

            SELECT item_id, item_name, category, price,
                   availability, description, 'timeless' AS canteen
            FROM cafe_timeless

            UNION ALL

            SELECT item_id, item_name, category, price,
                   availability, description, 'nescafe' AS canteen
            FROM nescafe
        ) AS menu

        LEFT JOIN (
            SELECT canteen, item_id, COUNT(*) AS favourite_count
            FROM food_favourites
            GROUP BY canteen, item_id
        ) AS favourites
            ON favourites.canteen = menu.canteen
            AND favourites.item_id = menu.item_id

        ORDER BY
            favourite_count DESC,
            menu.item_name ASC

        LIMIT 1
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Top favourites query error:", err.message);
            return res.status(500).json({
                error: "Could not load the most-favourited dish"
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
// 13. GET FAVOURITE COUNTS FOR ALL DISHES
// ======================================================

app.get("/api/favourites/counts", (req, res) => {
    const sql = `
        SELECT
            canteen,
            item_id,
            COUNT(*) AS favourite_count
        FROM food_favourites
        GROUP BY canteen, item_id
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Favourite counts error:", err.message);
            return res.status(500).json({
                error: "Could not load favourite counts"
            });
        }

        res.json(results);
    });
});

// ======================================================
// 14. START SERVER
// ======================================================

const PORT = process.env.PORT || 3000;


app.get("/api/campus-picks", (req, res) => {
    const sql = `
        SELECT
            menu.item_id,
            menu.item_name,
            menu.category,
            menu.price,
            menu.availability,
            menu.description,
            menu.canteen,
            COUNT(f.id) AS favourite_count
        FROM (
            SELECT item_id, item_name, category, price,
                   availability, description,
                   'cafeteria' AS canteen
            FROM campus_cafeteria

            UNION ALL

            SELECT item_id, item_name, category, price,
                   availability, description,
                   'timeless' AS canteen
            FROM cafe_timeless

            UNION ALL

            SELECT item_id, item_name, category, price,
                   availability, description,
                   'nescafe' AS canteen
            FROM nescafe
        ) AS menu
        INNER JOIN food_favourites AS f
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

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Campus Picks error:", err.message);
            return res.status(500).json({
                error: "Failed to load Campus Picks"
            });
        }

        res.json(results);
    });
});


app.listen(PORT, () => {
    console.log(
        `Campus Connect Canteens Backend running on port ${PORT}`
    );
});
