// =====================================================
// 1. IMPORT PACKAGES & CONFIG
// =====================================================

const path = require("path");
const fs = require("fs");

// Load environment variables from root or backend directory
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");


// =====================================================
// 2. CREATE EXPRESS APP
// =====================================================

const app = express();

const PORT = Number(process.env.PORT || 3000);


// =====================================================
// 3. ENABLE CORS + JSON + URLENCODED
// =====================================================

app.use(cors());

app.use(express.json({
    limit: "10mb"
}));

app.use(express.urlencoded({
    extended: true,
    limit: "10mb"
}));


// =====================================================
// 4. CONNECT TO MYSQL (CONNECTION POOL FOR PRODUCTION)
// =====================================================

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

// Enable SSL if specified in environment
if (process.env.DB_SSL === "true" || process.env.DB_SSL === "1") {
    poolConfig.ssl = {
        rejectUnauthorized: false
    };
}

const db = mysql.createPool(poolConfig);


// =====================================================
// 5. TEST MYSQL CONNECTION POOL
// =====================================================

db.getConnection(function(error, connection) {

    if (error) {

        console.log(
            "MySQL connection failed:",
            error.message || error
        );

        return;

    }

    console.log(
        "MySQL connected successfully via pool!"
    );

    connection.release();

});


// =====================================================
// MAKE DATABASE AVAILABLE TO ROUTES
// =====================================================

app.use(function(req, res, next) {

    req.db = db;

    next();

});


// =====================================================
// LOST & FOUND ROUTES
// =====================================================

const lostFoundRoutes =
    require("./routes/lostfound");


// =====================================================
// LOST & FOUND API
// =====================================================

app.use(
    "/api/lost-found",
    lostFoundRoutes
);


// =====================================================
// 6. PATH CONFIGURATION FOR FULL CAMPUSCONNECT SITE
// =====================================================

const rootPath =
    path.join(__dirname, "..");

const frontendPath =
    path.join(rootPath, "lost_and_found");

const canteenPath =
    path.join(rootPath, "canteen");

const mainPath =
    path.join(rootPath, "Main");

const foodImagesFolder =
    path.join(__dirname, "food-images");

const uploadsFolder =
    path.join(frontendPath, "uploads");


// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", function(req, res) {
    res.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});


// =====================================================
// SERVE STATIC FILES
// =====================================================

// Serve root static files (index.html, landing.html, logo.png, etc.)
app.use(express.static(rootPath));

// Serve sub-apps as static directories
app.use("/Main", express.static(mainPath));
app.use("/canteen", express.static(canteenPath));
app.use("/lost_and_found", express.static(frontendPath));
app.use("/food-images", express.static(foodImagesFolder));
app.use("/uploads", express.static(uploadsFolder));
app.use("/lost_and_found/uploads", express.static(uploadsFolder));


// =====================================================
// EXPLICIT PAGE ROUTES & PHP ALIASES
// =====================================================

// Main campus home
app.get(["/", "/index.html"], function(req, res) {
    res.sendFile(path.join(rootPath, "index.html"));
});

app.get("/landing.html", function(req, res) {
    res.sendFile(path.join(rootPath, "landing.html"));
});

// Lost & Found Pages + PHP Aliases
app.get([
    "/lost",
    "/lost_and_found",
    "/lost_and_found/",
    "/lost_and_found/lost.html",
    "/lost_and_found/lost.php",
    "/lost_and_found/reportlostitem.php",
    "/lost_and_found/reportfounditem.php"
], function(req, res) {
    res.sendFile(path.join(frontendPath, "lost.html"));
});

app.get([
    "/lost_and_found/lost-items.html",
    "/lost_and_found/lost-items.php"
], function(req, res) {
    res.sendFile(path.join(frontendPath, "lost-items.html"));
});

app.get([
    "/lost_and_found/found-items.html",
    "/lost_and_found/found-items.php"
], function(req, res) {
    res.sendFile(path.join(frontendPath, "found-items.html"));
});

app.get([
    "/lost_and_found/browse.html",
    "/lost_and_found/browse.php"
], function(req, res) {
    res.sendFile(path.join(frontendPath, "browse.html"));
});

// Canteen Pages
app.get(["/canteen", "/canteen/"], function(req, res) {
    res.sendFile(path.join(canteenPath, "index.html"));
});



// =====================================================
// 7. GET ALL CANTEENS MENU (MUST BE BEFORE :canteen)
// =====================================================

app.get(
    "/api/menu/all",
    function(req, res) {

        const queries = {

            cafeteria: `

                SELECT
                    item_id,
                    item_name,
                    category,
                    price,
                    availability,
                    description

                FROM campus_cafeteria

            `,

            timeless: `

                SELECT
                    item_id,
                    item_name,
                    category,
                    price,
                    availability,
                    description

                FROM cafe_timeless

            `,

            nescafe: `

                SELECT
                    item_id,
                    item_name,
                    category,
                    price,
                    availability,
                    description

                FROM nescafe

            `

        };


        db.query(
            queries.cafeteria,
            function(error, cafeteria) {

                if (error) {

                    console.log(
                        "Cafeteria error:",
                        error
                    );

                    return res.status(500).json({

                        error:
                            "Could not load cafeteria menu"

                    });

                }


                db.query(
                    queries.timeless,
                    function(error, timeless) {

                        if (error) {

                            console.log(
                                "Timeless error:",
                                error
                            );

                            return res.status(500).json({

                                error:
                                    "Could not load Timeless menu"

                            });

                        }


                        db.query(
                            queries.nescafe,
                            function(error, nescafe) {

                                if (error) {

                                    console.log(
                                        "Nescafe error:",
                                        error
                                    );

                                    return res.status(500).json({

                                        error:
                                            "Could not load Nescafe menu"

                                    });

                                }


                                const allItems = [

                                    ...cafeteria.map(
                                        function(item) {

                                            return {

                                                ...item,

                                                canteen:
                                                    "Cafeteria"

                                            };

                                        }
                                    ),


                                    ...timeless.map(
                                        function(item) {

                                            return {

                                                ...item,

                                                canteen:
                                                    "Timeless"

                                            };

                                        }
                                    ),


                                    ...nescafe.map(
                                        function(item) {

                                            return {

                                                ...item,

                                                canteen:
                                                    "Nescafe"

                                            };

                                        }
                                    )

                                ];


                                res.json(
                                    allItems
                                );

                            }
                        );

                    }
                );

            }
        );

    }
);


// =====================================================
// GET MENU FOR SPECIFIC CANTEEN
// =====================================================

app.get(
    "/api/menu/:canteen",
    function(req, res) {

        const canteen =
            req.params.canteen;

        let tableName;


        // Decide which MySQL table to use

        if (canteen === "cafeteria") {

            tableName =
                "campus_cafeteria";

        }

        else if (canteen === "timeless") {

            tableName =
                "cafe_timeless";

        }

        else if (canteen === "nescafe") {

            tableName =
                "nescafe";

        }

        else {

            return res.status(400).json({

                error:
                    "Invalid canteen"

            });

        }


        // Get menu items from MySQL

        const query = `

            SELECT
                item_id,
                item_name,
                category,
                price,
                availability,
                description

            FROM ${tableName}

        `;


        db.query(
            query,
            function(error, results) {

                if (error) {

                    console.log(
                        "Database query failed:",
                        error
                    );

                    return res.status(500).json({

                        error:
                            "Could not fetch menu"

                    });

                }


                res.json(results);

            }
        );

    }
);



// =====================================================
// AI FOOD IMAGE GENERATOR
// =====================================================

app.get(
    "/api/food-image/:canteen/:foodName",
    async function(req, res) {

        const canteen =
            req.params.canteen;

        const foodName =
            req.params.foodName;


        // Create safe filename

        const safeCanteen =
            canteen
                .toLowerCase()
                .replace(
                    /[^a-z0-9]+/g,
                    "-"
                );


        const safeFoodName =
            foodName
                .toLowerCase()
                .replace(
                    /[^a-z0-9]+/g,
                    "-"
                );


        const fileName =
            safeCanteen +
            "-" +
            safeFoodName +
            ".jpg";


        const filePath =
            path.join(
                foodImagesFolder,
                fileName
            );


        // ======================================
        // IMAGE ALREADY EXISTS
        // ======================================

        if (fs.existsSync(filePath)) {

            console.log(
                "Using saved image:",
                fileName
            );


            return res.json({

                image:
                    "/food-images/" +
                    fileName

            });

        }


        // ======================================
        // GENERATE NEW AI IMAGE
        // ======================================

        console.log(
            "Generating AI image for:",
            foodName
        );


        const prompt =
            "Professional realistic food photography " +
            "of " +
            foodName +
            ", Indian college cafeteria food, " +
            "appetizing presentation, served on a " +
            "clean ceramic plate, warm natural lighting, " +
            "close-up food photography, realistic texture, " +
            "high quality, no people, no text, no watermark";


        const imageURL =
            "https://image.pollinations.ai/prompt/" +
            encodeURIComponent(prompt) +
            "?model=flux" +
            "&width=600" +
            "&height=400" +
            "&nologo=true" +
            "&private=true";


        try {

            const response =
                await fetch(imageURL);


            if (!response.ok) {

                throw new Error(
                    "AI image generation failed: " +
                    response.status
                );

            }


            // Convert response to image data

            const imageBuffer =
                Buffer.from(
                    await response.arrayBuffer()
                );


            // Save image permanently

            fs.writeFileSync(
                filePath,
                imageBuffer
            );


            console.log(
                "Image saved:",
                fileName
            );


            // Send saved image path

            res.json({

                image:
                    "/food-images/" +
                    fileName

            });


        }

        catch (error) {

            console.log(
                "AI image error:",
                error.message
            );


            res.status(500).json({

                error:
                    "Could not generate food image"

            });

        }

    }
);


// =====================================================
// CREATE FOOD IMAGE FOLDER IF MISSING
// =====================================================


// =====================================================
// CREATE FOOD IMAGE FOLDER
// =====================================================

if (
    !fs.existsSync(
        foodImagesFolder
    )
) {

    fs.mkdirSync(
        foodImagesFolder,
        {
            recursive: true
        }
    );

}


// =====================================================
// START SERVER
// =====================================================

app.listen(
    PORT,
    "0.0.0.0",
    function() {

        console.log(
            `Server running at http://localhost:${PORT}`
        );

    }
);