const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

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
        "/lost_and_found/uploads/items/yellowfile.jpg"

};


// =====================================================
// GET CORRECT IMAGE
// =====================================================

function getCorrectImage(item) {

    const itemKey =
        item.item_name
            ? String(
                item.item_name
            )
                .trim()
                .toLowerCase()
            : "";


    // =================================================
    // FIRST: CHECK DATABASE IMAGE
    // =================================================

    if (
        item.image &&
        String(
            item.image
        ).trim() !== ""
    ) {

        const databaseImage =
            String(
                item.image
            ).trim();


        // -------------------------------------------------
        // Data URL
        // -------------------------------------------------

        if (
            databaseImage.startsWith(
                "data:"
            )
        ) {

            return databaseImage;

        }


        // -------------------------------------------------
        // External URL
        // -------------------------------------------------

        if (
            databaseImage.startsWith(
                "http://"
            ) ||
            databaseImage.startsWith(
                "https://"
            )
        ) {

            return databaseImage;

        }


        // -------------------------------------------------
        // Check local file
        // -------------------------------------------------

        const cleanPath =
            databaseImage.replace(
                /^\/+/,
                ""
            );


        const actualFilePath =
            path.join(
                uploadFolder,
                path.basename(
                    cleanPath
                )
            );

        const frontendFilePath =
            path.join(
                __dirname,
                "..",
                "..",
                "lost_and_found",
                "uploads",
                "items",
                path.basename(
                    cleanPath
                )
            );

        if (
            fs.existsSync(
                actualFilePath
            ) ||
            fs.existsSync(
                frontendFilePath
            ) ||
            cleanPath.includes("/") ||
            /\.(jpg|jpeg|png|gif|webp)$/i.test(cleanPath)
        ) {

            return databaseImage;

        }

    }


    // =================================================
    // SECOND: USE IMAGE MAP
    // =================================================

    if (
        imageMap[itemKey]
    ) {

        return imageMap[itemKey];

    }


    // =================================================
    // THIRD: TRY NORMALIZED ITEM NAME
    // =================================================

    const normalizedKey =
        itemKey
            .replace(
                /[_-]+/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    if (
        imageMap[normalizedKey]
    ) {

        return imageMap[normalizedKey];

    }


    // =================================================
    // NO IMAGE FOUND
    // =================================================

    return item.image || null;

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
// GET LOST ITEMS
// =====================================================

router.get(
    "/lost",
    function(req, res) {

        const query = `
            SELECT
                serial_number,
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

                    console.log(
                        "Lost items error:",
                        error
                    );


                    return res.status(500).json({

                        error:
                            "Could not fetch lost items",

                        details:
                            error.message

                    });

                }


                const itemsWithImages =
                    results.map(
                        function(item) {

                            return {

                                ...item,

                                image:
                                    getCorrectImage(
                                        item
                                    )

                            };

                        }
                    );


                res.json(
                    itemsWithImages
                );

            }
        );

    }
);


// =====================================================
// GET FOUND ITEMS
// =====================================================

router.get(
    "/found",
    function(req, res) {

        const query = `
            SELECT
                serial_number,
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

                    console.log(
                        "Found items error:",
                        error
                    );


                    return res.status(500).json({

                        error:
                            "Could not fetch found items",

                        details:
                            error.message

                    });

                }


                const itemsWithImages =
                    results.map(
                        function(item) {

                            return {

                                ...item,

                                image:
                                    getCorrectImage(
                                        item
                                    )

                            };

                        }
                    );


                res.json(
                    itemsWithImages
                );

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

                imagePath =
                    "uploads/items/" +
                    uniqueName;

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
                image
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;


        const values = [

            person_name,

            roll_number,

            item_name,

            location,

            status,

            contact_number,

            description,

            imagePath

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
                            imagePath

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
// EXPORT
// =====================================================

module.exports =
    router;