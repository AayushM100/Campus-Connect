const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const { verifyFirebaseToken, optionalAuth } = require("../middleware/auth");

const router = express.Router();

const LF_DB =
    process.env.LOST_FOUND_DB ||
    process.env.LF_DB ||
    (process.env.DB_NAME && process.env.DB_NAME !== "campus_canteen"
        ? process.env.DB_NAME
        : "campusconnect");


// =====================================================
// IMAGE UPLOAD FOLDER (LOCAL FALLBACK)
// =====================================================

// Runtime uploads must live inside the Render service root (backend).
// Render services with root directory "backend" cannot access sibling folders.
const uploadFolder = path.join(
    __dirname,
    "..",
    "uploads",
    "items"
);


// =====================================================
// CREATE UPLOAD FOLDER
// =====================================================

if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, {
        recursive: true
    });
}


// =====================================================
// CLOUDINARY CONFIGURATION (PERSISTENT CLOUD STORAGE)
// =====================================================

function isCloudinaryConfigured() {
    return Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
}

if (isCloudinaryConfigured()) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
    console.log("Cloudinary persistent image storage configured!");
} else {
    console.log("Using local filesystem image storage (Cloudinary env not set)");
}

function uploadToCloudinary(buffer, originalname) {
    return new Promise(function(resolve, reject) {
        const extension = path.extname(originalname).toLowerCase();
        const baseName = path.basename(originalname, extension)
            .replace(/[^a-zA-Z0-9-_]/g, "_")
            .toLowerCase();
        const publicId = baseName + "_" + Date.now();

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "campusconnect/lost_and_found",
                public_id: publicId,
                resource_type: "image"
            },
            function(error, result) {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        uploadStream.end(buffer);
    });
}


// =====================================================
// MULTER STORAGE (IN-MEMORY BUFFER FOR DUAL STORAGE)
// =====================================================

const storage = multer.memoryStorage();


// =====================================================
// MULTER UPLOAD
// =====================================================

const upload = multer({

    storage: storage,

    limits: {

        fileSize:
            5 * 1024 * 1024

    },

    fileFilter:
        function(req, file, cb) {

            if (
                file.mimetype &&
                file.mimetype.startsWith(
                    "image/"
                )
            ) {

                cb(
                    null,
                    true
                );

            } else {

                cb(
                    new Error(
                        "Only image files are allowed."
                    )
                );

            }

        }

});


// =====================================================
// IMAGE FALLBACK MAP
// =====================================================
//
// IMPORTANT:
// These paths are based on the actual files inside:
//
// lost_and_found/uploads/items/
//
// =====================================================

const imageMap = {

    // =================================================
    // MOBILE
    // =================================================

    "mobile":
        "/lost_and_found/uploads/items/mobile.jpg",

    "mobile phone":
        "/lost_and_found/uploads/items/mobile.jpg",

    "phone":
        "/lost_and_found/uploads/items/mobile.jpg",

    "mobile cover":
        "/lost_and_found/uploads/items/mobilecover.jpg",

    "phone cover":
        "/lost_and_found/uploads/items/mobilecover.jpg",


    // =================================================
    // WALLET
    // =================================================

    "black wallet":
        "/lost_and_found/uploads/items/blackwallet.jpg",

    "wallet":
        "/lost_and_found/uploads/items/blackwallet.jpg",


    // =================================================
    // BAG
    // =================================================

    "black bag":
        "/lost_and_found/uploads/items/blackbag.jpg",

    "blackbag":
        "/lost_and_found/uploads/items/blackbag.jpg",

    "bag":
        "/lost_and_found/uploads/items/blackbag.jpg",


    // =================================================
    // POUCH
    // =================================================

    "pouch":
        "/lost_and_found/uploads/items/pouch.jpg",


    // =================================================
    // COLLEGE ID CARD
    // =================================================

    "college id card":
        "/lost_and_found/uploads/items/collegeidcard.jpg",

    "college id":
        "/lost_and_found/uploads/items/collegeidcard.jpg",

    "id card":
        "/lost_and_found/uploads/items/collegeidcard.jpg",

    "identity card":
        "/lost_and_found/uploads/items/collegeidcard.jpg",


    // =================================================
    // KEYCHAIN
    // =================================================

    "keychain":
        "/lost_and_found/uploads/items/keychain.jpg",

    "key chain":
        "/lost_and_found/uploads/items/keychain.jpg",


    // =================================================
    // UMBRELLA
    // =================================================

    "umbrella":
        "/lost_and_found/uploads/items/umbrella.jpg",


    // =================================================
    // LAPTOP CHARGER
    // =================================================

    "laptop charger":
        "/lost_and_found/uploads/items/laptopcharger.jpg",

    "laptopcharger":
        "/lost_and_found/uploads/items/laptopcharger.jpg",

    "charger":
        "/lost_and_found/uploads/items/laptopcharger.jpg",


    // =================================================
    // NOTEBOOK
    // =================================================

    "notebook":
        "/lost_and_found/uploads/items/notebook.jpg",

    "book":
        "/lost_and_found/uploads/items/notebook.jpg",


    // =================================================
    // EARPHONES
    // =================================================

    "earphones":
        "/lost_and_found/uploads/items/earphones.jpg",

    "earphone":
        "/lost_and_found/uploads/items/earphones.jpg",

    "airpods":
        "/lost_and_found/uploads/items/earphones.jpg",


    // =================================================
    // USB / PENDRIVE
    // =================================================

    "usb drive":
        "/lost_and_found/uploads/items/usbdrive.jpg",

    "usb":
        "/lost_and_found/uploads/items/usbdrive.jpg",

    "usbdrive":
        "/lost_and_found/uploads/items/usbdrive.jpg",

    "pendrive":
        "/lost_and_found/uploads/items/usbdrive.jpg",

    "pen drive":
        "/lost_and_found/uploads/items/usbdrive.jpg",


    // =================================================
    // SCIENTIFIC CALCULATOR
    // =================================================
    //
    // ACTUAL FILE:
    //
    // scientific calculator.jpg
    //
    // IMPORTANT:
    // %20 represents the space in the filename.
    // =================================================

    "scientific calculator":
        "/lost_and_found/uploads/items/scientific%20calculator.jpg",

    "scientificcalculator":
        "/lost_and_found/uploads/items/scientific%20calculator.jpg",

    "calculator":
        "/lost_and_found/uploads/items/scientific%20calculator.jpg",

    "casio scientific calculator":
        "/lost_and_found/uploads/items/scientific%20calculator.jpg",


    // =================================================
    // WATER BOTTLE
    // =================================================

    "water bottle":
        "/lost_and_found/uploads/items/waterbottle.jpg",

    "waterbottle":
        "/lost_and_found/uploads/items/waterbottle.jpg",

    "bottle":
        "/lost_and_found/uploads/items/waterbottle.jpg",


    // =================================================
    // GEOMETRY BOX
    // =================================================

    "geometry box":
        "/lost_and_found/uploads/items/geometrybox.jpg",

    "geometrybox":
        "/lost_and_found/uploads/items/geometrybox.jpg",


    // =================================================
    // SPECTACLES
    // =================================================

    "spectacles":
        "/lost_and_found/uploads/items/spectacles.jpg",

    "spectacle":
        "/lost_and_found/uploads/items/spectacles.jpg",

    "glasses":
        "/lost_and_found/uploads/items/spectacles.jpg",


    // =================================================
    // CHEMISTRY
    // =================================================

    "chem":
        "/lost_and_found/uploads/items/chem.jpg",

    "chemistry":
        "/lost_and_found/uploads/items/chem.jpg",

    "chemistry book":
        "/lost_and_found/uploads/items/chem.jpg",


    // =================================================
    // LAB FILE / YELLOW FILE
    // =================================================

    "lab file":
        "/lost_and_found/uploads/items/yellowfile.jpg",

    "labfile":
        "/lost_and_found/uploads/items/yellowfile.jpg",

    "lab":
        "/lost_and_found/uploads/items/yellowfile.jpg",

    "yellow file":
        "/lost_and_found/uploads/items/yellowfile.jpg",

    "yellowfile":
        "/lost_and_found/uploads/items/yellowfile.jpg",

    "file":
        "/lost_and_found/uploads/items/yellowfile.jpg",

    // =================================================
    // IPAD / TABLET
    // =================================================

    "ipad":
        "/lost_and_found/uploads/items/ipad.jpg",

    "i pad":
        "/lost_and_found/uploads/items/ipad.jpg",

    "apple ipad":
        "/lost_and_found/uploads/items/ipad.jpg",

    "tablet":
        "/lost_and_found/uploads/items/ipad.jpg",

    // =================================================
    // ACCESSORIES & MISC
    // =================================================

    "spectacles case":
        "/lost_and_found/uploads/items/spectacles.jpg",

    "specs":
        "/lost_and_found/uploads/items/spectacles.jpg",

    "blue water bottle":
        "/lost_and_found/uploads/items/waterbottle.jpg",

    "backpack":
        "/lost_and_found/uploads/items/blackbag.jpg",

    "black backpack":
        "/lost_and_found/uploads/items/blackbag.jpg",

    "earbuds":
        "/lost_and_found/uploads/items/earphones.jpg",

    "earbuds case":
        "/lost_and_found/uploads/items/earphones.jpg",

    "chemistry lab journal":
        "/lost_and_found/uploads/items/chem.jpg",

    "macbook":
        "/lost_and_found/uploads/items/laptopcharger.jpg",

    "trimax":
        "/lost_and_found/uploads/items/trimax.jpeg",

    "trimax pen":
        "/lost_and_found/uploads/items/trimax.jpeg"

};


// =====================================================
// VERCEL PRODUCTION STATIC ASSET LIST
// =====================================================

const vercelStaticImages = new Set([
    "1789640439_6aabbef7d4a29.jpg",
    "1789640524_6aabbf4c4f2d8.jpg",
    "blackbag.jpg",
    "blackbag_1790798817313.jpg",
    "blackwallet.jpg",
    "chem.jpg",
    "collegeidcard.jpg",
    "earphones.jpg",
    "geometrybox.jpg",
    "keychain.jpg",
    "laptopcharger.jpg",
    "mobile.jpg",
    "mobilecover.jpg",
    "notebook.jpg",
    "pouch.jpg",
    "pouch_1790847147030.jpg",
    "scientific calculator.jpg",
    "spectacles.jpg",
    "spectacles_1790846841290.jpg",
    "trimax.jpeg",
    "umbrella.jpg",
    "usbdrive.jpg",
    "waterbottle.jpg",
    "yellowfile.jpg"
]);

function getDiskFileDataUri(filename) {
    if (!filename) return null;
    const candidates = [
        path.join(uploadFolder, filename),
        path.join(__dirname, "..", "..", "lost_and_found", "uploads", "items", filename),
        path.join(__dirname, "..", "uploads", "items", filename)
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            try {
                const stat = fs.statSync(p);
                if (stat.size <= 2 * 1024 * 1024) {
                    const ext = path.extname(filename).toLowerCase().replace(".", "");
                    const mime = ext === "png" ? "image/png" : (ext === "webp" ? "image/webp" : "image/jpeg");
                    const buf = fs.readFileSync(p);
                    return "data:" + mime + ";base64," + buf.toString("base64");
                }
            } catch (e) {}
        }
    }
    return null;
}


// =====================================================
// GET CORRECT IMAGE
// =====================================================

function getCorrectImage(item) {

    const itemName =
        item.item_name
            ? String(item.item_name).trim()
            : "";

    const itemKey =
        itemName.toLowerCase();

    // =================================================
    // FIRST: CHECK DATABASE IMAGE
    // =================================================

    if (
        item.image &&
        String(item.image).trim() !== ""
    ) {

        const databaseImage =
            String(item.image).trim();

        // -------------------------------------------------
        // Data URL
        // -------------------------------------------------

        if (databaseImage.startsWith("data:")) {
            return databaseImage;
        }

        // -------------------------------------------------
        // External URL
        // -------------------------------------------------

        if (
            databaseImage.startsWith("http://") ||
            databaseImage.startsWith("https://")
        ) {
            return databaseImage;
        }

        // -------------------------------------------------
        // Match with Vercel Production Static Bundle
        // -------------------------------------------------

        const cleanPath =
            databaseImage.replace(/\\/g, "/").replace(/^\/+/, "");

        const baseFilename =
            path.basename(cleanPath);

        const stripped =
            baseFilename.replace(/_\d{10,14}(\.[a-zA-Z0-9]+)$/, "$1");

        // 1. If baseFilename exists on Vercel static bundle
        if (vercelStaticImages.has(baseFilename)) {
            return "/lost_and_found/uploads/items/" + baseFilename;
        }

        // 2. If stripped filename exists on Vercel static bundle (e.g. waterbottle.jpg)
        if (vercelStaticImages.has(stripped)) {
            return "/lost_and_found/uploads/items/" + stripped;
        }

        // 3. If file exists on Render disk (e.g. ipad.jpg, ipad_1792908368686.jpg)
        const diskUri = getDiskFileDataUri(baseFilename) || getDiskFileDataUri(stripped);
        if (diskUri) {
            return diskUri;
        }

        // 4. If cleanPath is an existing Vercel path
        if (cleanPath.startsWith("lost_and_found/uploads/items/")) {
            const leaf = path.basename(cleanPath);
            if (vercelStaticImages.has(leaf)) return "/" + cleanPath;
        }

        // 5. If cleanPath is an uploaded item path, point to Render's public uploads
        if (cleanPath.startsWith("uploads/items/")) {
            return "https://campus-connect-4n2t.onrender.com/" + cleanPath;
        }

    }


    // =================================================
    // SECOND: USE IMAGE MAP OR IPAD DATA URI
    // =================================================

    if (itemKey.includes("ipad") || itemKey === "tablet") {
        const ipadUri = getDiskFileDataUri("ipad.jpg");
        if (ipadUri) return ipadUri;
    }

    if (imageMap[itemKey]) {
        return imageMap[itemKey];
    }


    // =================================================
    // THIRD: TRY NORMALIZED ITEM NAME
    // =================================================

    const normalizedKey =
        itemKey
            .replace(/[^a-z0-9]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    if (imageMap[normalizedKey]) {
        return imageMap[normalizedKey];
    }

    // Partial word match in imageMap
    for (const [mapKey, imgPath] of Object.entries(imageMap)) {
        if (
            (itemKey.length > 2 && mapKey.includes(itemKey)) ||
            (mapKey.length > 2 && itemKey.includes(mapKey))
        ) {
            return imgPath;
        }
    }


    // =================================================
    // FOURTH: FALLBACK PATH IF DATABASE IMAGE PROVIDED
    // =================================================

    if (item.image && String(item.image).trim() !== "") {
        const clean = String(item.image).trim().replace(/\\/g, "/").replace(/^\/+/, "");
        const leaf = path.basename(clean);
        const strippedLeaf = leaf.replace(/_\d{10,14}(\.[a-zA-Z0-9]+)$/, "$1");
        if (vercelStaticImages.has(leaf)) return "/lost_and_found/uploads/items/" + leaf;
        if (vercelStaticImages.has(strippedLeaf)) return "/lost_and_found/uploads/items/" + strippedLeaf;
        if (clean.startsWith("lost_and_found/")) return "/" + clean;
        return "/lost_and_found/uploads/items/" + leaf;
    }

    return null;

}


// =====================================================
// TIMESTAMP & RECENCY HELPER
// =====================================================

function getItemTimestamp(item) {

    // 1. If created_at is valid
    if (item.created_at) {
        const parsed = new Date(item.created_at).getTime();
        if (!isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }

    // 2. Extract timestamp from image filename: e.g. ipad_1792908368686.jpg
    if (item.image) {
        const match = String(item.image).match(/_(\d{10,13})/);
        if (match) {
            const num = parseInt(match[1], 10);
            return match[1].length === 10 ? num * 1000 : num;
        }
    }

    // 3. Fallback deterministically by serial_number
    const serial = Number(item.serial_number) || 0;
    if (serial >= 25) {
        return 1792900000000 + (serial * 60000);
    }
    return 1790000000000 + (serial * 3600000);

}


// =====================================================
// ENSURE TIMESTAMP COLUMN EXISTS IN DATABASE
// =====================================================

let timestampSupportChecked = false;

function ensureTimestampSupport(db) {

    if (!db || timestampSupportChecked) return;
    timestampSupportChecked = true;

    db.query(
        "SHOW COLUMNS FROM `" + LF_DB + "`.`lost_items` LIKE 'created_at'",
        function(err, rows) {
            if (!err && (!rows || rows.length === 0)) {
                db.query(
                    "ALTER TABLE `" + LF_DB + "`.`lost_items` ADD COLUMN `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP",
                    function(aErr) {
                        if (!aErr) console.log("Added created_at to lost_items");
                    }
                );
            }
        }
    );

    db.query(
        "SHOW COLUMNS FROM `" + LF_DB + "`.`found_items` LIKE 'created_at'",
        function(err, rows) {
            if (!err && (!rows || rows.length === 0)) {
                db.query(
                    "ALTER TABLE `" + LF_DB + "`.`found_items` ADD COLUMN `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP",
                    function(aErr) {
                        if (!aErr) console.log("Added created_at to found_items");
                    }
                );
            }
        }
    );

    db.query(
        "SHOW COLUMNS FROM `" + LF_DB + "`.`lost_items` LIKE 'user_uid'",
        function(err, rows) {
            if (!err && (!rows || rows.length === 0)) {
                db.query(
                    "ALTER TABLE `" + LF_DB + "`.`lost_items` ADD COLUMN `user_uid` VARCHAR(128) NULL DEFAULT NULL",
                    function(aErr) {
                        if (!aErr) console.log("Added user_uid to lost_items");
                    }
                );
            }
        }
    );

    db.query(
        "SHOW COLUMNS FROM `" + LF_DB + "`.`found_items` LIKE 'user_uid'",
        function(err, rows) {
            if (!err && (!rows || rows.length === 0)) {
                db.query(
                    "ALTER TABLE `" + LF_DB + "`.`found_items` ADD COLUMN `user_uid` VARCHAR(128) NULL DEFAULT NULL",
                    function(aErr) {
                        if (!aErr) console.log("Added user_uid to found_items");
                    }
                );
            }
        }
    );

}


// =====================================================
// ROOT LOST & FOUND ROUTE
// =====================================================

router.get(
    "/",
    function(req, res) {
        res.redirect("/api/lost-found/lost");
    }
);


// =====================================================
// GET LOST ITEMS (NEWEST FIRST)
// =====================================================

router.get(
    "/lost",
    function(req, res) {

        ensureTimestampSupport(req.db);

        const query = `
            SELECT
                serial_number,
                user_uid,
                roll_number,
                item_name,
                location,
                description,
                status,
                person_name,
                contact_number,
                image
            FROM \`${LF_DB}\`.\`lost_items\`
            WHERE LOWER(status) = 'lost'
            ORDER BY serial_number DESC
        `;

        req.db.query(
            query,
            function(error, results) {

                if (error) {
                    console.log("Lost items error:", error);
                    return res.status(500).json({
                        error: "Could not fetch lost items",
                        details: error.message
                    });
                }

                const itemsWithImages =
                    results.map(function(item) {
                        const ts = getItemTimestamp(item);
                        return {
                            ...item,
                            created_at: item.created_at || new Date(ts).toISOString(),
                            image: getCorrectImage(item)
                        };
                    });

                // Deterministic sort: newest first
                itemsWithImages.sort(function(a, b) {
                    return getItemTimestamp(b) - getItemTimestamp(a);
                });

                res.json(itemsWithImages);

            }
        );

    }
);


// =====================================================
// GET FOUND ITEMS (NEWEST FIRST)
// =====================================================

router.get(
    "/found",
    function(req, res) {

        ensureTimestampSupport(req.db);

        const query = `
            SELECT
                serial_number,
                user_uid,
                roll_number,
                item_name,
                location,
                description,
                status,
                person_name,
                contact_number,
                image
            FROM \`${LF_DB}\`.\`found_items\`
            WHERE LOWER(COALESCE(status, 'found')) = 'found'
            UNION ALL
            SELECT
                serial_number,
                user_uid,
                roll_number,
                item_name,
                location,
                description,
                status,
                person_name,
                contact_number,
                image
            FROM \`${LF_DB}\`.\`lost_items\`
            WHERE LOWER(status) = 'found'
            ORDER BY serial_number DESC
        `;

        req.db.query(
            query,
            function(error, results) {

                if (error) {
                    console.log("Found items error:", error);
                    return res.status(500).json({
                        error: "Could not fetch found items",
                        details: error.message
                    });
                }

                const itemsWithImages =
                    results.map(function(item) {
                        const ts = getItemTimestamp(item);
                        return {
                            ...item,
                            created_at: item.created_at || new Date(ts).toISOString(),
                            image: getCorrectImage(item)
                        };
                    });

                // Deterministic sort: newest first across both tables
                itemsWithImages.sort(function(a, b) {
                    return getItemTimestamp(b) - getItemTimestamp(a);
                });

                res.json(itemsWithImages);

            }
        );

    }
);


// =====================================================
// REPORT LOST / FOUND ITEM
// =====================================================
//
// Both LOST and FOUND records are stored in:
//
// lost_items
//
// status = lost  -> Lost
// status = found -> Found
//
// =====================================================

router.post(
    "/",
    verifyFirebaseToken,
    upload.single("image"),
    async function(req, res) {


        // =================================================
        // GET FORM DATA
        // =================================================

        const item_name =
            String(
                req.body.item_name || ""
            ).trim();


        const status =
            String(
                req.body.status || ""
            )
                .trim()
                .toLowerCase();


        const location =
            String(
                req.body.location || ""
            ).trim();


        const description =
            String(
                req.body.description || ""
            ).trim();


        // =================================================
        // VALIDATE REQUIRED FIELDS
        // =================================================

        if (
            item_name === "" ||
            status === "" ||
            location === "" ||
            description === ""
        ) {

            return res.status(400).json({

                error:
                    "Please fill in all the required fields."

            });

        }


        // =================================================
        // VALIDATE STATUS
        // =================================================

        if (
            status !== "lost" &&
            status !== "found"
        ) {

            return res.status(400).json({

                error:
                    "Invalid item status."

            });

        }


        // =================================================
        // OPTIONAL / DEFAULT VALUES
        // =================================================

        const person_name =
            String(
                req.body.person_name || "Campus Student"
            ).trim();


        const roll_number =
            String(
                req.body.roll_number || "N/A"
            ).trim();


        const contact_number =
            String(
                req.body.contact_number || "N/A"
            ).trim();


        // =================================================
        // IMAGE PATH (CLOUDINARY OR LOCAL DISK)
        // =================================================

        let imagePath = "";

        if (req.file) {

            if (isCloudinaryConfigured()) {

                try {

                    imagePath =
                        await uploadToCloudinary(
                            req.file.buffer,
                            req.file.originalname
                        );

                    console.log(
                        "Uploaded image to Cloudinary:",
                        imagePath
                    );

                } catch (cloudError) {

                    console.error(
                        "Cloudinary upload failed:",
                        cloudError
                    );

                    return res.status(500).json({

                        error:
                            "Could not upload image to cloud storage: " +
                            (cloudError.message || cloudError)

                    });

                }

            } else {

                // Fallback to local disk
                const extension =
                    path.extname(
                        req.file.originalname
                    ).toLowerCase();

                const baseName =
                    path.basename(
                        req.file.originalname,
                        extension
                    )
                    .replace(
                        /[^a-zA-Z0-9-_]/g,
                        "_"
                    )
                    .toLowerCase();

                const uniqueName =
                    baseName +
                    "_" +
                    Date.now() +
                    extension;

                const fullLocalPath =
                    path.join(
                        uploadFolder,
                        uniqueName
                    );

                fs.writeFileSync(
                    fullLocalPath,
                    req.file.buffer
                );

                imagePath = "uploads/items/" + uniqueName;

                console.log(
                    "Saved image to local disk:",
                    imagePath
                );

            }

        }



        // =================================================
        // INSERT INTO DATABASE
        // =================================================

        const targetTable =
            status === "found"
                ? "found_items"
                : "lost_items";

        const user_uid = req.user ? req.user.uid : null;

        const query = `
            INSERT INTO \`${LF_DB}\`.\`${targetTable}\`
            (
                person_name,
                roll_number,
                item_name,
                location,
                status,
                contact_number,
                description,
                image,
                user_uid
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;


        const values = [

            person_name,

            roll_number,

            item_name,

            location,

            status,

            contact_number,

            description,

            imagePath,

            user_uid

        ];


        req.db.query(
            query,
            values,
            function(error, result) {

                if (error) {

                    console.log(
                        "Report item error:",
                        error
                    );


                    if (
                        req.file &&
                        req.file.path
                    ) {

                        fs.unlink(
                            req.file.path,
                            function() {}
                        );

                    }


                    return res.status(500).json({

                        error:
                            "Could not save item",

                        details:
                            error.message

                    });

                }


                console.log(
                    "Item saved successfully."
                );


                console.log(
                    "Image path:",
                    imagePath
                );


                const resolvedImg = getCorrectImage({
                    item_name: item_name,
                    image: imagePath
                });

                res.status(201).json({

                    message:
                        "Item reported successfully.",

                    item: {

                        serial_number:
                            result.insertId,

                        item_name:
                            item_name,

                        status:
                            status,

                        location:
                            location,

                        description:
                            description,

                        image:
                            resolvedImg || imagePath,

                        created_at:
                            new Date().toISOString()

                    }

                });

            }
        );

    }
);


// =====================================================
// MULTER ERROR HANDLER
// =====================================================

router.use(
    function(error, req, res, next) {

        // =================================================
        // MULTER ERROR
        // =================================================

        if (
            error instanceof multer.MulterError
        ) {

            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {

                return res.status(400).json({

                    error:
                        "Image is too large. Maximum size is 5 MB."

                });

            }


            return res.status(400).json({

                error:
                    error.message

            });

        }


        // =================================================
        // OTHER ERRORS
        // =================================================

        if (
            error
        ) {

            return res.status(400).json({

                error:
                    error.message

            });

        }


        next();

    }
);


// =====================================================
// GET CURRENT USER'S REPORTS
// =====================================================

router.get(
    "/my-reports",
    verifyFirebaseToken,
    function(req, res) {
        ensureTimestampSupport(req.db);

        const uid = req.user.uid;

        const lostQuery = `
            SELECT
                serial_number,
                user_uid,
                roll_number,
                item_name,
                location,
                description,
                status,
                person_name,
                contact_number,
                image,
                created_at
            FROM \`${LF_DB}\`.\`lost_items\`
            WHERE user_uid = ?
            ORDER BY serial_number DESC
        `;

        const foundQuery = `
            SELECT
                serial_number,
                user_uid,
                roll_number,
                item_name,
                location,
                description,
                status,
                person_name,
                contact_number,
                image,
                created_at
            FROM \`${LF_DB}\`.\`found_items\`
            WHERE user_uid = ?
            ORDER BY serial_number DESC
        `;

        req.db.query(lostQuery, [uid], function(err1, lostResults) {
            if (err1) {
                console.error("Fetch my lost reports error:", err1);
                return res.status(500).json({ error: "Could not fetch your lost reports", details: err1.message });
            }

            req.db.query(foundQuery, [uid], function(err2, foundResults) {
                if (err2) {
                    console.error("Fetch my found reports error:", err2);
                    return res.status(500).json({ error: "Could not fetch your found reports", details: err2.message });
                }

                const formatItems = function(list) {
                    return (list || []).map(function(item) {
                        const ts = getItemTimestamp(item);
                        return {
                            ...item,
                            created_at: item.created_at || new Date(ts).toISOString(),
                            image: getCorrectImage(item)
                        };
                    });
                };

                res.json({
                    success: true,
                    lost: formatItems(lostResults),
                    found: formatItems(foundResults)
                });
            });
        });
    }
);


// =====================================================
// EDIT ITEM (OWNER-ONLY)
// =====================================================

router.put(
    "/item/:id",
    verifyFirebaseToken,
    function(req, res) {
        const id = req.params.id;
        let targetTable = req.query.type === "found" ? "found_items" : "lost_items";

        // Check ownership first
        const checkQuery = "SELECT serial_number, user_uid FROM `" + LF_DB + "`.`" + targetTable + "` WHERE serial_number = ? LIMIT 1";

        req.db.query(checkQuery, [id], function(err, rows) {
            if (err) {
                console.error("Check item ownership error:", err);
                return res.status(500).json({ error: "Could not verify item ownership", details: err.message });
            }

            if (!rows || rows.length === 0) {
                // Try checking alternate table if type wasn't specified accurately
                const alternateTable = targetTable === "found_items" ? "lost_items" : "found_items";
                const checkAltQuery = "SELECT serial_number, user_uid FROM `" + LF_DB + "`.`" + alternateTable + "` WHERE serial_number = ? LIMIT 1";

                return req.db.query(checkAltQuery, [id], function(altErr, altRows) {
                    if (altErr || !altRows || altRows.length === 0) {
                        return res.status(404).json({ error: "Item not found" });
                    }
                    proceedUpdate(alternateTable, altRows[0]);
                });
            }

            proceedUpdate(targetTable, rows[0]);
        });

        function proceedUpdate(table, item) {
            if (!item.user_uid) {
                return res.status(403).json({
                    error: "Legacy unowned reports cannot be modified",
                    code: "LEGACY_RECORD_IMMUTABLE"
                });
            }

            if (item.user_uid !== req.user.uid) {
                return res.status(403).json({
                    error: "You are not authorized to edit this report",
                    code: "FORBIDDEN_NOT_OWNER"
                });
            }

            const itemName = String(req.body.item_name || "").trim();
            const description = String(req.body.description || "").trim();
            const location = String(req.body.location || "").trim();
            const contactNumber = String(req.body.contact_number || "").trim();

            if (!itemName || !description || !location) {
                return res.status(400).json({ error: "Item name, description, and location are required." });
            }

            const updateQuery = `
                UPDATE \`${LF_DB}\`.\`${table}\`
                SET item_name = ?, description = ?, location = ?, contact_number = ?
                WHERE serial_number = ? AND user_uid = ?
                LIMIT 1
            `;

            req.db.query(updateQuery, [itemName, description, location, contactNumber, id, req.user.uid], function(uErr, result) {
                if (uErr) {
                    console.error("Update item error:", uErr);
                    return res.status(500).json({ error: "Could not update item", details: uErr.message });
                }

                res.json({
                    success: true,
                    message: "Report updated successfully",
                    id: id
                });
            });
        }
    }
);


// =====================================================
// DELETE ITEM (OWNER-ONLY SECURED)
// =====================================================

router.delete(
    "/item/:id",
    verifyFirebaseToken,
    function(req, res) {

        const id = req.params.id;
        let targetTable = req.query.type === "found" ? "found_items" : "lost_items";

        // Check ownership first
        const checkQuery = "SELECT serial_number, user_uid FROM `" + LF_DB + "`.`" + targetTable + "` WHERE serial_number = ? LIMIT 1";

        req.db.query(checkQuery, [id], function(err, rows) {
            if (err) {
                console.error("Check item ownership error:", err);
                return res.status(500).json({ error: "Could not verify item ownership", details: err.message });
            }

            if (!rows || rows.length === 0) {
                // Try checking alternate table if type wasn't specified accurately
                const alternateTable = targetTable === "found_items" ? "lost_items" : "found_items";
                const checkAltQuery = "SELECT serial_number, user_uid FROM `" + LF_DB + "`.`" + alternateTable + "` WHERE serial_number = ? LIMIT 1";

                return req.db.query(checkAltQuery, [id], function(altErr, altRows) {
                    if (altErr || !altRows || altRows.length === 0) {
                        return res.status(404).json({ error: "Item not found" });
                    }
                    proceedDelete(alternateTable, altRows[0]);
                });
            }

            proceedDelete(targetTable, rows[0]);
        });

        function proceedDelete(table, item) {
            // Legacy unowned items cannot be deleted
            if (!item.user_uid) {
                return res.status(403).json({
                    error: "Legacy unowned reports cannot be deleted",
                    code: "LEGACY_RECORD_IMMUTABLE"
                });
            }

            // Enforce ownership
            if (item.user_uid !== req.user.uid) {
                return res.status(403).json({
                    error: "You are not authorized to delete this report",
                    code: "FORBIDDEN_NOT_OWNER"
                });
            }

            const deleteQuery = "DELETE FROM `" + LF_DB + "`.`" + table + "` WHERE serial_number = ? AND user_uid = ? LIMIT 1";

            req.db.query(
                deleteQuery,
                [id, req.user.uid],
                function(dErr, result) {
                    if (dErr) {
                        console.error("Delete error:", dErr);
                        return res.status(500).json({
                            error: "Could not delete item",
                            details: dErr.message
                        });
                    }

                    console.log("Deleted item " + id + " from " + table + ", affectedRows: " + result.affectedRows);

                    res.json({
                        success: true,
                        deleted: result.affectedRows,
                        id: id
                    });
                }
            );
        }

    }
);


// =====================================================
// EXPORT
// =====================================================

module.exports =
    router;