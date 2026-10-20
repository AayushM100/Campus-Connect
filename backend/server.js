
const path = require("path");
const fs = require("fs");

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
// DATABASE CONNECTIONS
// -----------------------------------------------------

const poolConfig = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "campusconnect",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

if (process.env.DB_SSL === "true" || process.env.DB_SSL === "1") {
    poolConfig.ssl = { rejectUnauthorized: false };
}

const db = mysql.createPool(poolConfig);

const canteenDB = process.env.CANTEEN_DB_HOST
    ? mysql.createConnection({
        host: process.env.CANTEEN_DB_HOST,
        user: process.env.CANTEEN_DB_USER,
        password: process.env.CANTEEN_DB_PASSWORD || "",
        database: process.env.CANTEEN_DB_NAME || "campusconnect",
        port: Number(process.env.CANTEEN_DB_PORT || 3306)
    })
    : db;

const lostFoundDB = process.env.LOST_FOUND_DB_HOST
    ? mysql.createConnection({
        host: process.env.LOST_FOUND_DB_HOST,
        user: process.env.LOST_FOUND_DB_USER,
        password: process.env.LOST_FOUND_DB_PASSWORD || "",
        database: process.env.LOST_FOUND_DB_NAME || "campusconnect",
        port: Number(process.env.LOST_FOUND_DB_PORT || 3306)
    })
    : db;

// -----------------------------------------------------
// TEST DATABASE CONNECTIONS
// -----------------------------------------------------

const lostFoundRoutes = require("./routes/lostfound");

db.getConnection(function (error, connection) {
    if (error) {
        console.log("MySQL pool connection failed:", error.message || error);
        return;
    }

    console.log("MySQL pool connected successfully!");
    connection.release();
});

if (canteenDB !== db && typeof canteenDB.connect === "function") {
    canteenDB.connect(function (error) {
        if (error) {
            console.log("Canteen MySQL connection failed:", error.message || error);
        } else {
            console.log("Canteen MySQL connected successfully!");
        }
    });
}

if (lostFoundDB !== db && typeof lostFoundDB.connect === "function") {
    lostFoundDB.connect(function (error) {
        if (error) {
            console.log("Lost & Found MySQL connection failed:", error.message || error);
        } else {
            console.log("Lost & Found MySQL connected successfully!");
        }
    });
}

// -----------------------------------------------------
// PATH CONFIGURATION
// -----------------------------------------------------

const rootPath = path.join(__dirname, "..");
const frontendPath = path.join(rootPath, "lost_and_found");
const canteenPath = path.join(rootPath, "canteen");
const mainPath = path.join(rootPath, "Main");
const foodImagesFolder = path.join(__dirname, "food-images");
const uploadsFolder = path.join(frontendPath, "uploads");

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

console.log("Lost & Found frontend path:", frontendPath);

if (!fs.existsSync(frontendPath)) {
    console.log("WARNING: lost_and_found folder was NOT found.");
    console.log("Expected folder:", frontendPath);
} else {
    console.log("Lost & Found frontend folder found!");
}

// -----------------------------------------------------
// LOST & FOUND API
// -----------------------------------------------------

app.use(
    "/api/lost-found",
    function (req, res, next) {
        req.db = lostFoundDB;
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

// Also support uploaded images from the frontend directory.
app.use(
    "/uploads",
    express.static(path.join(rootPath, "lost_and_found", "uploads"))
);

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

// -----------------------------------------------------
// ALL CANTEENS MENU
// IMPORTANT: keep this BEFORE /api/menu/:canteen
// -----------------------------------------------------

app.get("/api/menu/all", function (req, res) {
    const queries = {
        cafeteria: `
            SELECT item_id, item_name, category, price,
                   availability, description
            FROM campus_cafeteria
        `,
        timeless: `
            SELECT item_id, item_name, category, price,
                   availability, description
            FROM cafe_timeless
        `,
        nescafe: `
            SELECT item_id, item_name, category, price,
                   availability, description
            FROM nescafe
        `
    };

    canteenDB.query(queries.cafeteria, function (error, cafeteria) {
        if (error) {
            console.log("Cafeteria error:", error);
            return res.status(500).json({
                error: "Could not load cafeteria menu"
            });
        }

        canteenDB.query(queries.timeless, function (error, timeless) {
            if (error) {
                console.log("Timeless error:", error);
                return res.status(500).json({
                    error: "Could not load Timeless menu"
                });
            }

            canteenDB.query(queries.nescafe, function (error, nescafe) {
                if (error) {
                    console.log("Nescafe error:", error);
                    return res.status(500).json({
                        error: "Could not load Nescafe menu"
                    });
                }

                const allItems = [
                    ...cafeteria.map(function (item) {
                        return { ...item, canteen: "Cafeteria" };
                    }),
                    ...timeless.map(function (item) {
                        return { ...item, canteen: "Timeless" };
                    }),
                    ...nescafe.map(function (item) {
                        return { ...item, canteen: "Nescafe" };
                    })
                ];

                res.json(allItems);
            });
        });
    });
});

// -----------------------------------------------------
// MENU FOR A SPECIFIC CANTEEN
// -----------------------------------------------------

app.get("/api/menu/:canteen", function (req, res) {
    const canteen = req.params.canteen;
    const tableNames = {
        cafeteria: "campus_cafeteria",
        timeless: "cafe_timeless",
        nescafe: "nescafe"
    };

    const tableName = tableNames[canteen];

    if (!tableName) {
        return res.status(400).json({
            error: "Invalid canteen"
        });
    }

    const query = `
        SELECT item_id, item_name, category, price,
               availability, description
        FROM ${tableName}
    `;

    canteenDB.query(query, function (error, results) {
        if (error) {
            console.log("Database query failed:", error);
            return res.status(500).json({
                error: "Could not fetch menu"
            });
        }

        res.json(results);
    });
});

// -----------------------------------------------------
// FOOD IMAGE GENERATOR
// -----------------------------------------------------

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
// CREATE FOOD IMAGE FOLDER IF MISSING
// -----------------------------------------------------

if (!fs.existsSync(foodImagesFolder)) {
    fs.mkdirSync(foodImagesFolder, { recursive: true });
}

// -----------------------------------------------------
// START SERVER
// -----------------------------------------------------

app.listen(PORT, "0.0.0.0", function () {
    console.log(`Server running at http://localhost:${PORT}`);
});
