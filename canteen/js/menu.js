"use strict";

const BACKEND_URL = "https://campus-connect-1-0q94.onrender.com";

// 1. Helper function to build individual food item cards
function createFoodCard(item) {
    // Normalise item name (handles both 'name' and 'item_name' from SQL)
    const itemName = item.name || item.item_name || "Food Item";
    const itemId = item.id || item.item_id || "";

    // Robust database availability check (handles 0, "0", false, or "Not Available")
    const isItemUnavailable = 
        item.is_available === 0 || 
        item.is_available === "0" || 
        item.is_available === false || 
        item.availability === "Not Available" ||
        item.availability === "Closed";

    // Set dynamic text, colors, and button states based on database flag
    const itemStatusText = isItemUnavailable ? "Not Available" : "Available";
    const itemStatusColor = isItemUnavailable ? "#d32f2f" : "#2e7d32"; 
    const buttonState = isItemUnavailable ? "disabled" : "";
    const buttonOpacity = isItemUnavailable ? "0.5" : "1";
    const cursorStyle = isItemUnavailable ? "not-allowed" : "pointer";

    // Format file name for static WebP image delivery from backend
    const formattedName = itemName.toLowerCase().replace(/\s+/g, '-');
    const imageUrl = `${BACKEND_URL}/food-images/${formattedName}.webp`;

    return `
        <article class="food-card">
            <div class="food-image-container" style="position: relative;">
                <img 
                    src="${imageUrl}" 
                    alt="${itemName}" 
                    loading="lazy" 
                    class="food-image" 
                    onerror="this.style.display='none'"
                >
                <button class="favorite-btn" aria-label="Add to favorites" style="position: absolute; top: 10px; right: 10px;">♡</button>
            </div>
            <div class="food-content">
                <span class="canteen-tag">${item.canteen || "Cafeteria"}</span>
                <h3 class="food-title">${itemName}</h3>
                <p class="food-description">${item.description || itemName.toLowerCase()}</p>
                
                <div class="price-and-status" style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <span class="price" style="font-weight: bold; font-size: 1.2em;">₹${item.price}</span>
                    <span class="availability-status" style="color: ${itemStatusColor}; font-weight: bold; font-size: 0.85em;">
                        ${itemStatusText}
                    </span>
                </div>
                
                <button 
                    class="add-to-cart-btn" 
                    data-id="${itemId}" 
                    data-name="${itemName}" 
                    data-price="${item.price}" 
                    data-canteen="${item.canteen || 'Cafeteria'}"
                    ${buttonState} 
                    style="opacity: ${buttonOpacity}; cursor: ${cursorStyle}; width: 100%; margin-top: 15px;"
                    onclick="addToCart(this)"
                >
                    🛒 Add to Cart
                </button>
            </div>
        </article>
    `;
}

// 2. Fetch menu items from Render backend and render to page
async function loadMenu() {
    // Find grid container in HTML (supports common grid IDs/classes)
    const container = 
        document.querySelector("#menuGrid") || 
        document.querySelector("#foodContainer") || 
        document.querySelector(".menu-grid") ||
        document.querySelector("#resultsContainer");

    if (!container) return;

    // Detect URL query parameters (e.g. ?canteen=cafeteria or ?filter=full-meals)
    const urlParams = new URLSearchParams(window.location.search);
    const canteenParam = urlParams.get("canteen");
    const filterParam = urlParams.get("filter");

    // Construct backend API endpoint
    let fetchUrl = `${BACKEND_URL}/api/menu`;
    if (canteenParam) {
        fetchUrl = `${BACKEND_URL}/api/menu/${canteenParam}`;
    }

    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error("Failed to fetch menu");

        let items = await response.json();

        // Optional category filter handling
        if (filterParam && filterParam !== "all") {
            items = items.filter(item => {
                const category = (item.category || "").toLowerCase();
                if (filterParam === "full-meals") return category.includes("meal") || category.includes("thali") || category.includes("rice");
                if (filterParam === "coffee-drinks") return category.includes("beverage") || category.includes("coffee") || category.includes("drink");
                if (filterParam === "quick-bites") return category.includes("snack") || category.includes("sandwich") || category.includes("burger");
                return true;
            });
        }

        // Update item count UI text if element exists
        const resultsText = document.querySelector("#resultsText");
        if (resultsText) {
            resultsText.textContent = `${items.length} food items found`;
        }

        // Render all cards
        if (items.length === 0) {
            container.innerHTML = "<p class='no-items'>No food items available at the moment.</p>";
        } else {
            container.innerHTML = items.map(item => createFoodCard(item)).join("");
        }

        console.log(`Menu loaded: ${items.length} items`);
    } catch (err) {
        console.error("Error loading menu:", err);
        container.innerHTML = "<p class='error-msg'>Unable to load menu. Please try again later.</p>";
    }
}

// 3. Initialize menu on DOM load
document.addEventListener("DOMContentLoaded", loadMenu);