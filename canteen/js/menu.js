"use strict";

// =====================================================
// 1. ELEMENTS AND BACKEND CONFIGURATION
// =====================================================

const searchInput = document.querySelector("#menuSearch");
const clearSearchButton = document.querySelector("#clearSearch");
const menuContainer = document.querySelector("#menuContainer");
const noResults = document.querySelector("#noResults");
const resultSummary = document.querySelector("#resultSummary");
const canteenTitle = document.querySelector("#canteenTitle");
const clearFiltersButton = document.querySelector("#clearFilters");

// Backend used for menu, favourites and food images.
const BACKEND_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
        ? "http://localhost:3000"
        : "https://campus-connect-1-0q94.onrender.com";

// =====================================================
// 2. DIRECT FOOD IMAGE URL
// =====================================================

// "Veg Puff"            -> .../food-images/veg-puff.webp
// "Veg Thali + Chapati" -> .../food-images/veg-thali-chapati.webp
//
// Images must exist inside the food-images folder next to the
// server.js of your deployed backend (and be committed to Git).

function getImageUrl(itemName) {
    const slug = String(itemName || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")   // spaces, +, /, & etc. -> "-"
        .replace(/^-+|-+$/g, "");      // trim leading/trailing "-"

    return `${BACKEND_URL}/food-images/${slug}.webp`;
}

// =====================================================
// 3. CANTEEN AND CATEGORY DATA
// =====================================================

const canteenNames = {
    cafeteria: "Cafeteria",
    timeless: "Timeless",
    nescafe: "Nescafe"
};

const categoryIcons = {
    "Breakfast": "🍳",
    "South Indian": "🥞",
    "Chinese": "🍜",
    "Chapati / Paratha": "🫓",
    "Rice": "🍚",
    "Sandwich": "🥪",
    "Sandwiches": "🥪",
    "Maggi": "🍜",
    "Beverages": "☕",
    "Pasta": "🍝",
    "Thali": "🍛",
    "Chat": "🥟"
};

const categoryGroups = {
    "full-meals": [
        "breakfast", "south indian", "chapati", "paratha",
        "rice", "thali", "full meal", "full meals", "meal"
    ],
    "coffee-drinks": [
        "beverage", "beverages", "coffee", "drink", "drinks",
        "cooler", "juice", "tea"
    ],
    "quick-bites": [
        "sandwich", "maggi", "chat", "snack", "snacks",
        "quick bite", "quick bites", "pasta", "chinese"
    ]
};

let allMenuItems = [];
let selectedCanteen = "all";
let selectedFilter = "all";
let selectedCategory = "all";

// =====================================================
// 4. FAVOURITES
// =====================================================

function getVisitorId() {
    const storageKey = "campusBitesVisitorId";

    try {
        let visitorId = localStorage.getItem(storageKey);

        if (!visitorId) {
            visitorId =
                window.crypto &&
                typeof window.crypto.randomUUID === "function"
                    ? window.crypto.randomUUID()
                    : "visitor-" + Date.now() + "-" +
                      Math.random().toString(36).slice(2);

            localStorage.setItem(storageKey, visitorId);
        }

        return visitorId;
    } catch (error) {
        console.error("Could not access visitor ID storage:", error);
        return "temporary-" + Math.random().toString(36).slice(2);
    }
}

const visitorId = getVisitorId();

function readFavorites() {
    try {
        const saved = JSON.parse(
            localStorage.getItem("campusBitesFoodFavorites") || "[]"
        );

        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        console.error("Could not read favourites:", error);
        return [];
    }
}

let favoriteFoods = readFavorites();

function getFoodKey(item) {
    return String(item.canteen || "") + "::" +
        String(item.item_id ?? item.item_name ?? "");
}

function saveFavorites() {
    try {
        localStorage.setItem(
            "campusBitesFoodFavorites",
            JSON.stringify(favoriteFoods)
        );
    } catch (error) {
        console.error("Could not save favourites locally:", error);
    }
}

function isFavorite(item) {
    return favoriteFoods.includes(getFoodKey(item));
}

async function sendFavoriteToServer(item, shouldSave) {
    const payload = {
        visitorId,
        canteen: item.canteen,
        item_id: String(item.item_id ?? item.item_name ?? "")
    };

    try {
        const response = await fetch(
            `${BACKEND_URL}/api/favourites`,
            {
                method: shouldSave ? "POST" : "DELETE",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        const data = await response.json();

        if (!response.ok || data.success !== true) {
            throw new Error(data.error || "HTTP " + response.status);
        }

        return true;
    } catch (error) {
        console.error("Could not sync favourite:", error);
        alert("Could not save this favourite. Please try again.");
        return false;
    }
}

// Updates every heart button already on the page WITHOUT rebuilding
// the cards (rebuilding would re-request every food image).
function refreshFavoriteButtons() {
    document.querySelectorAll(".food-favorite").forEach(function (button) {
        const item = menuItemsByKey.get(button.dataset.foodKey);

        if (item) updateFavoriteButton(item, button);
    });
}

async function loadServerFavorites() {
    try {
        const response = await fetch(
            `${BACKEND_URL}/api/favourites/${encodeURIComponent(visitorId)}`
        );

        if (!response.ok) {
            throw new Error(
                "Favourites API returned HTTP " + response.status
            );
        }

        const serverFavorites = await response.json();

        if (!Array.isArray(serverFavorites)) {
            throw new Error("Invalid favourites response");
        }

        const serverKeys = serverFavorites.map(function (favorite) {
            return String(favorite.canteen) + "::" +
                String(favorite.item_id);
        });

        const serverKeySet = new Set(serverKeys);
        const localKeysBeforeMerge = new Set(favoriteFoods);

        favoriteFoods = Array.from(
            new Set([...favoriteFoods, ...serverKeys])
        );

        saveFavorites();

        const localItemsToSync = allMenuItems.filter(function (item) {
            const key = getFoodKey(item);

            return localKeysBeforeMerge.has(key) &&
                !serverKeySet.has(key);
        });

        await Promise.all(
            localItemsToSync.map(function (item) {
                return sendFavoriteToServer(item, true);
            })
        );

        // Only refresh the hearts. Do not call displayMenu() here.
        refreshFavoriteButtons();

        window.dispatchEvent(
            new Event("campusBitesFavoritesUpdated")
        );
    } catch (error) {
        console.warn(
            "Could not sync favourites. Using local favourites.",
            error
        );
    }
}

function updateFavoriteButton(item, button) {
    const saved = isFavorite(item);

    button.textContent = saved ? "♥" : "♡";
    button.classList.toggle("active", saved);

    button.setAttribute(
        "aria-label",
        saved
            ? "Remove " + item.item_name + " from favourites"
            : "Add " + item.item_name + " to favourites"
    );

    button.setAttribute("aria-pressed", String(saved));
    button.title = saved
        ? "Remove from favourites"
        : "Add to favourites";
}

async function toggleFavorite(item, button) {
    if (button.disabled) return;

    button.disabled = true;

    const key = getFoodKey(item);
    const wasFavorite = favoriteFoods.includes(key);
    const shouldSave = !wasFavorite;

    try {
        const success = await sendFavoriteToServer(item, shouldSave);

        if (!success) return;

        if (shouldSave) {
            if (!favoriteFoods.includes(key)) {
                favoriteFoods.push(key);
            }
        } else {
            favoriteFoods = favoriteFoods.filter(
                favoriteKey => favoriteKey !== key
            );
        }

        saveFavorites();
        updateFavoriteButton(item, button);

        window.dispatchEvent(
            new Event("campusBitesFavoritesUpdated")
        );
    } finally {
        button.disabled = false;
    }
}


// =====================================================
// CANTEEN OPEN / CLOSED CHECK (India Standard Time)
// =====================================================

function checkCanteenStatus() {
    // Force IST regardless of the user's device settings
    const istTime = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const dayOfWeek = istTime.getDay();     // 0 = Sunday
    const currentHour = istTime.getHours(); // 0-23

    const year = istTime.getFullYear();
    const month = String(istTime.getMonth() + 1).padStart(2, "0");
    const date = String(istTime.getDate()).padStart(2, "0");
    const todayDate = `${year}-${month}-${date}`;

    // --- SCHEDULE CONFIGURATION ---
    const openingHour = 9;   // 9:00 AM
    const closingHour = 17;  // 5:00 PM
    const closedDays = [0];  // 0 = Sunday (add 6 for Saturday)
    const holidays = ["2026-10-31", "2026-11-01"]; // YYYY-MM-DD
    // ------------------------------

    if (closedDays.includes(dayOfWeek)) return false;
    if (currentHour < openingHour || currentHour >= closingHour) return false;
    if (holidays.includes(todayDate)) return false;

    return true;
}

// =====================================================
// 11. CREATE FOOD CARD
// =====================================================


function createFoodCard(item) {
    const card = document.createElement("article");
    card.className = "menu-item";

    // =====================================================
    // 1. CHECK FOOD AVAILABILITY
    // =====================================================

    // Compare using lowercase so capitalization doesn't matter.
    const unavailableItems = ["samosa", "vada pav"];

    const itemName = String(item.item_name || "").trim();
    const isTemporarilyUnavailable =
        unavailableItems.includes(itemName.toLowerCase());

    // Preserve any other availability information from the database.
    const databaseAvailability = String(
        item.availability || "Available"
    );

    const isUnavailable =
        isTemporarilyUnavailable ||
        databaseAvailability.toLowerCase().includes("unavailable") ||
        databaseAvailability.toLowerCase().includes("not available");

    const availabilityText = isUnavailable
        ? "Not Available"
        : databaseAvailability;

    // =====================================================
    // 2. FOOD IMAGE
    // =====================================================

    const image = document.createElement("img");
    image.className = "food-image";
    image.alt = itemName || "Food item";
    image.loading = "lazy";
    image.decoding = "async";
    image.src = getImageUrl(itemName);

    // Display a placeholder if the image cannot be loaded.
    image.onerror = function () {
        image.onerror = null;
        image.src =
            "https://placehold.co/600x400/f3eee9/76675e?text=" +
            encodeURIComponent(itemName || "Campus Food");
    };

    // =====================================================
    // 3. FAVOURITE BUTTON
    // =====================================================

    const favoriteButton = document.createElement("button");
    favoriteButton.type = "button";
    favoriteButton.className = "food-favorite";
    favoriteButton.dataset.foodKey = getFoodKey(item);

    updateFavoriteButton(item, favoriteButton);

    favoriteButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(item, favoriteButton);
    });

    // =====================================================
    // 4. FOOD DETAILS
    // =====================================================

    const details = document.createElement("div");
    details.className = "item-details";

    const badge = document.createElement("span");
    badge.className = "canteen-badge";
    badge.textContent =
        canteenNames[item.canteen] || item.canteen;

    const title = document.createElement("h3");
    title.textContent = itemName || "Unnamed item";

    const description = document.createElement("p");
    description.className = "item-description";
    description.textContent =
        item.description || "A campus favourite.";

    // =====================================================
    // 5. PRICE AND AVAILABILITY STATUS
    // =====================================================

    const bottom = document.createElement("div");
    bottom.className = "item-bottom";

    const price = document.createElement("strong");
    price.className = "item-price";
    price.textContent = "₹" + Number(item.price || 0);

    const availability = document.createElement("span");
    availability.className = "availability";
    availability.textContent = availabilityText;

    // Red for unavailable items; retain existing styling otherwise.
    if (isUnavailable) {
        availability.classList.add("unavailable");
        availability.style.color = "#d32f2f";
    } else {
        availability.style.color = "#2e7d32";
    }

    // =====================================================
    // 6. ADD TO CART BUTTON
    // =====================================================

    const addButton = document.createElement("button");
    addButton.className = "add-cart";
    addButton.type = "button";

    if (isUnavailable) {
        addButton.textContent = "Currently Unavailable";
        addButton.disabled = true;
        addButton.style.opacity = "0.5";
        addButton.style.cursor = "not-allowed";
    } else {
        addButton.textContent = "🛒 Add to Cart";
    }

    addButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        // Safety check: unavailable food cannot be added.
        if (isUnavailable) return;

        if (typeof window.addToCart === "function") {
            window.addToCart(item, addButton);
        } else {
            alert(
                "Cart script is not loaded. Please check js/cart.js."
            );
        }
    });

    // =====================================================
    // 7. ASSEMBLE THE CARD
    // =====================================================

    bottom.append(price, availability);
    details.append(badge, title, description, bottom, addButton);
    card.append(image, favoriteButton, details);

    return card;
}



// =====================================================
// 5. LOAD ALL THREE CANTEEN MENUS
// =====================================================

// Lookup so heart buttons can find their item without rebuilding cards.
const menuItemsByKey = new Map();

function loadAllMenus() {
    if (!menuContainer) {
        console.error("Could not find #menuContainer in menu.html");
        return;
    }

    menuContainer.innerHTML = "<p>Loading menu items...</p>";

    if (noResults) noResults.hidden = true;

    const canteens = ["cafeteria", "timeless", "nescafe"];

    Promise.all(
        canteens.map(function (canteen) {
            return fetch(
                `${BACKEND_URL}/api/menu/${encodeURIComponent(canteen)}`
            )
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error(
                            canteen + " returned HTTP " + response.status
                        );
                    }

                    return response.json();
                })
                .then(function (data) {
                    if (!Array.isArray(data)) {
                        throw new Error(
                            "Expected an array of menu items for " + canteen
                        );
                    }

                    return data.map(function (item) {
                        return {
                            ...item,
                            canteen
                        };
                    });
                });
        })
    )
        .then(function (results) {
            allMenuItems = results.flat();

            menuItemsByKey.clear();
            allMenuItems.forEach(function (item) {
                menuItemsByKey.set(getFoodKey(item), item);
            });

            console.log("Menu items loaded:", allMenuItems.length);

            initialiseFiltersFromURL();
            updateFilterButtons();
            updateCategoryButtons();
            displayMenu();

            loadServerFavorites();
        })
        .catch(function (error) {
            console.error("Menu loading error:", error);

            menuContainer.innerHTML = "";

            if (noResults) {
                noResults.hidden = false;

                const heading = noResults.querySelector("h2");
                const paragraph = noResults.querySelector("p");

                if (heading) heading.textContent = "Menu unavailable";

                if (paragraph) {
                    paragraph.textContent =
                        "Could not load the menu. Please check the backend connection.";
                }
            }

            if (resultSummary) {
                resultSummary.textContent =
                    "Menu could not be loaded. Check the console.";
            }
        });
}


const unavailableItems = ["Samosa", "Vada Pav"];

// =====================================================
// 6. READ URL PARAMETERS
// =====================================================

function initialiseFiltersFromURL() {
    const params = new URLSearchParams(window.location.search);

    const canteenParam = params.get("canteen");
    const filterParam = params.get("filter");
    const searchParam =
        params.get("q") || params.get("search") || "";

    if (canteenParam && canteenNames[canteenParam]) {
        selectedCanteen = canteenParam;
    }

    if (filterParam && categoryGroups[filterParam]) {
        selectedFilter = filterParam;
    }

    if (searchInput) {
        searchInput.value = searchParam.trim();
    }

    if (filterParam && categoryGroups[filterParam]) {
        setTimeout(function () {
            const menuSection = document.querySelector(".menu-content");

            if (menuSection) {
                menuSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        }, 100);
    }
}

// =====================================================
// 7. UPDATE FILTER BUTTONS
// =====================================================

function updateFilterButtons() {
    document.querySelectorAll(".canteen-filter").forEach(function (button) {
        button.classList.toggle(
            "active",
            button.dataset.canteen === selectedCanteen
        );
    });

    document.querySelectorAll(".food-filter").forEach(function (button) {
        button.classList.toggle(
            "active",
            button.dataset.filter === selectedFilter
        );
    });
}

function updateCategoryButtons() {
    document.querySelectorAll(".category-btn").forEach(function (button) {
        button.classList.toggle(
            "active",
            button.dataset.category === selectedCategory
        );
    });
}

// =====================================================
// 8. CHECK FOOD-TYPE FILTERS
// =====================================================

function matchesFoodFilter(item, filter) {
    if (filter === "all") return true;

    const category = String(item.category || "").toLowerCase();
    const name = String(item.item_name || "").toLowerCase();
    const keywords = categoryGroups[filter] || [];

    return keywords.some(function (keyword) {
        return category.includes(keyword) || name.includes(keyword);
    });
}

// =====================================================
// 9. UPDATE MENU TITLE
// =====================================================

function updateTitle() {
    if (!canteenTitle) return;

    const canteenText = selectedCanteen === "all"
        ? "All campus food"
        : (canteenNames[selectedCanteen] || selectedCanteen) + " menu";

    const filterText = {
        all: "",
        "full-meals": " · Full meals",
        "coffee-drinks": " · Coffee & drinks",
        "quick-bites": " · Quick bites"
    }[selectedFilter] || "";

    canteenTitle.textContent = canteenText + filterText;
}

// =====================================================
// 10. SEARCH AND DISPLAY MENU ITEMS
// =====================================================

function displayMenu() {
    if (!menuContainer) return;

    menuContainer.innerHTML = "";

    const searchText = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    const filteredItems = allMenuItems.filter(function (item) {
        const matchesCanteen =
            selectedCanteen === "all" ||
            item.canteen === selectedCanteen;

        const matchesFilter =
            matchesFoodFilter(item, selectedFilter);

        const matchesCategory =
            selectedCategory === "all" ||
            item.category === selectedCategory;

        const name = String(item.item_name || "").toLowerCase();
        const description = String(item.description || "").toLowerCase();
        const category = String(item.category || "").toLowerCase();

        const matchesSearch =
            !searchText ||
            name.includes(searchText) ||
            description.includes(searchText) ||
            category.includes(searchText);

        return matchesCanteen &&
            matchesFilter &&
            matchesCategory &&
            matchesSearch;
    });

    updateTitle();

    if (resultSummary) {
        resultSummary.textContent =
            filteredItems.length + " food item" +
            (filteredItems.length === 1 ? "" : "s") + " found";
    }

    if (filteredItems.length === 0) {
        if (noResults) {
            noResults.hidden = false;

            const heading = noResults.querySelector("h2");
            const paragraph = noResults.querySelector("p");

            if (heading) heading.textContent = "No food items found";

            if (paragraph) {
                paragraph.textContent = searchText
                    ? 'No dishes match "' + searchText +
                      '". Try another search or clear your filters.'
                    : "Try selecting another canteen or food type.";
            }
        }

        return;
    }

    if (noResults) noResults.hidden = true;

    const grouped = {};

    filteredItems.forEach(function (item) {
        const category = item.category || "Other";

        if (!grouped[category]) grouped[category] = [];

        grouped[category].push(item);
    });

    Object.keys(grouped).sort().forEach(function (category) {
        const section = document.createElement("section");
        section.className = "menu-box";

        const heading = document.createElement("h2");
        heading.textContent =
            (categoryIcons[category] || "🍽️") + " " + category;

        const grid = document.createElement("div");
        grid.className = "menu-items";

        grouped[category].forEach(function (item) {
            grid.appendChild(createFoodCard(item));
        });

        section.append(heading, grid);
        menuContainer.appendChild(section);
    });
}

// =====================================================
// 11. CREATE FOOD CARD
// =====================================================


function createFoodCard(item) {
    const card = document.createElement("article");
    card.className = "menu-item";

    // =====================================================
    // 1. CHECK FOOD AVAILABILITY
    // =====================================================

    // Compare using lowercase so capitalization doesn't matter.
    const unavailableItems = ["samosa", "vada pav"];

    const itemName = String(item.item_name || "").trim();
    const isTemporarilyUnavailable =
        unavailableItems.includes(itemName.toLowerCase());

    // Preserve any other availability information from the database.
    const databaseAvailability = String(
        item.availability || "Available"
    );

    const isUnavailable =
        isTemporarilyUnavailable ||
        databaseAvailability.toLowerCase().includes("unavailable") ||
        databaseAvailability.toLowerCase().includes("not available");

    const availabilityText = isUnavailable
        ? "Not Available"
        : databaseAvailability;

    // =====================================================
    // 2. FOOD IMAGE
    // =====================================================

    const image = document.createElement("img");
    image.className = "food-image";
    image.alt = itemName || "Food item";
    image.loading = "lazy";
    image.decoding = "async";
    image.src = getImageUrl(itemName);

    // Display a placeholder if the image cannot be loaded.
    image.onerror = function () {
        image.onerror = null;
        image.src =
            "https://placehold.co/600x400/f3eee9/76675e?text=" +
            encodeURIComponent(itemName || "Campus Food");
    };

    // =====================================================
    // 3. FAVOURITE BUTTON
    // =====================================================

    const favoriteButton = document.createElement("button");
    favoriteButton.type = "button";
    favoriteButton.className = "food-favorite";
    favoriteButton.dataset.foodKey = getFoodKey(item);

    updateFavoriteButton(item, favoriteButton);

    favoriteButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(item, favoriteButton);
    });

    // =====================================================
    // 4. FOOD DETAILS
    // =====================================================

    const details = document.createElement("div");
    details.className = "item-details";

    const badge = document.createElement("span");
    badge.className = "canteen-badge";
    badge.textContent =
        canteenNames[item.canteen] || item.canteen;

    const title = document.createElement("h3");
    title.textContent = itemName || "Unnamed item";

    const description = document.createElement("p");
    description.className = "item-description";
    description.textContent =
        item.description || "A campus favourite.";

    // =====================================================
    // 5. PRICE AND AVAILABILITY STATUS
    // =====================================================

    const bottom = document.createElement("div");
    bottom.className = "item-bottom";

    const price = document.createElement("strong");
    price.className = "item-price";
    price.textContent = "₹" + Number(item.price || 0);

    const availability = document.createElement("span");
    availability.className = "availability";
    availability.textContent = availabilityText;

    // Red for unavailable items; retain existing styling otherwise.
    if (isUnavailable) {
        availability.classList.add("unavailable");
        availability.style.color = "#d32f2f";
    } else {
        availability.style.color = "#2e7d32";
    }

    // =====================================================
    // 6. ADD TO CART BUTTON
    // =====================================================

    const addButton = document.createElement("button");
    addButton.className = "add-cart";
    addButton.type = "button";

    if (isUnavailable) {
        addButton.textContent = "Currently Unavailable";
        addButton.disabled = true;
        addButton.style.opacity = "0.5";
        addButton.style.cursor = "not-allowed";
    } else {
        addButton.textContent = "🛒 Add to Cart";
    }

    addButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        // Safety check: unavailable food cannot be added.
        if (isUnavailable) return;

        if (typeof window.addToCart === "function") {
            window.addToCart(item, addButton);
        } else {
            alert(
                "Cart script is not loaded. Please check js/cart.js."
            );
        }
    });

    // =====================================================
    // 7. ASSEMBLE THE CARD
    // =====================================================

    bottom.append(price, availability);
    details.append(badge, title, description, bottom, addButton);
    card.append(image, favoriteButton, details);

    return card;
}


// =====================================================
// 12. CANTEEN FILTER BUTTONS
// =====================================================

document.querySelectorAll(".canteen-filter").forEach(function (button) {
    button.addEventListener("click", function () {
        selectedCanteen = button.dataset.canteen || "all";

        updateFilterButtons();
        displayMenu();
    });
});

// =====================================================
// 13. FOOD-TYPE FILTER BUTTONS
// =====================================================

document.querySelectorAll(".food-filter").forEach(function (button) {
    button.addEventListener("click", function () {
        selectedFilter = button.dataset.filter || "all";
        selectedCategory = "all";

        updateFilterButtons();
        updateCategoryButtons();
        displayMenu();
    });
});

// =====================================================
// 14. SEARCH BAR
// =====================================================

if (searchInput) {
    searchInput.addEventListener("input", function () {
        displayMenu();
    });
}

if (clearSearchButton) {
    clearSearchButton.addEventListener("click", function () {
        if (searchInput) {
            searchInput.value = "";
            searchInput.focus();
        }

        displayMenu();
    });
}

// =====================================================
// 15. CLEAR ALL FILTERS
// =====================================================

if (clearFiltersButton) {
    clearFiltersButton.addEventListener("click", function () {
        selectedCanteen = "all";
        selectedFilter = "all";
        selectedCategory = "all";

        if (searchInput) searchInput.value = "";

        updateFilterButtons();
        updateCategoryButtons();
        displayMenu();

        window.history.replaceState(
            {},
            "",
            window.location.pathname
        );
    });
}

// =====================================================
// 16. START
// =====================================================

loadAllMenus();