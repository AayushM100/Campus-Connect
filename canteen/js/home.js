"use strict";

// =====================================================
// 1. NAVIGATION, SEARCH AND THEME
// =====================================================

const homeNavToggle = document.querySelector(".nav-toggle");
const homeNav = document.querySelector(".navbar nav");
const homeSearch = document.querySelector(".search input");
const themeButton = document.querySelector(".theme-button");

// Mobile navigation
if (homeNavToggle && homeNav) {
    homeNavToggle.addEventListener("click", function () {
        const isOpen = homeNav.classList.toggle("is-open");

        homeNavToggle.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

        homeNavToggle.setAttribute(
            "aria-label",
            isOpen ? "Close navigation" : "Open navigation"
        );
    });
}

// Homepage search
if (homeSearch) {
    homeSearch.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && homeSearch.value.trim()) {
            window.location.href =
                "menu.html?q=" +
                encodeURIComponent(homeSearch.value.trim());
        }
    });
}

// Dark mode
function setTheme(isDark) {
    document.body.classList.toggle("dark-mode", isDark);

    if (!themeButton) return;

    themeButton.textContent = isDark ? "☀" : "☾";

    themeButton.setAttribute(
        "aria-pressed",
        String(isDark)
    );

    themeButton.setAttribute(
        "aria-label",
        isDark ? "Switch to light mode" : "Switch to night mode"
    );

    try {
        localStorage.setItem(
            "campusBitesTheme",
            isDark ? "dark" : "light"
        );
    } catch (error) {
        console.warn("Could not save theme preference:", error);
    }
}

let savedDarkMode = false;

try {
    savedDarkMode = localStorage.getItem("campusBitesTheme") === "dark";
} catch (error) {
    console.warn("Could not read theme preference:", error);
}

setTheme(savedDarkMode);

if (themeButton) {
    themeButton.addEventListener("click", function () {
        setTheme(!document.body.classList.contains("dark-mode"));
    });
}

// =====================================================
// 2. HOMEPAGE FOOD FILTERS
// =====================================================

const breakOptions = document.querySelectorAll(".break-option");

breakOptions.forEach(function (button) {
    button.addEventListener("click", function () {
        const filter = button.dataset.foodFilter || "all";

        breakOptions.forEach(function (option) {
            option.classList.remove("active");
        });

        button.classList.add("active");

        window.location.href =
            "menu.html?filter=" + encodeURIComponent(filter);
    });
});

// =====================================================
// 3. TODAY'S CAMPUS PICKS
// Load the two most-favourited dishes from the backend
// =====================================================

document.addEventListener("DOMContentLoaded", async function () {
    const container = document.getElementById("campusPicksItems");

    // Do nothing on pages that don't contain Campus Picks.
    if (!container) return;

    const API =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
            ? "http://localhost:3000"
            : "";

    container.textContent = "Loading campus favourites...";

    try {
        const response = await fetch(API + "/api/campus-picks");

        if (!response.ok) {
            throw new Error(
                "Campus Picks API returned HTTP " + response.status
            );
        }

        const picks = await response.json();

        if (!Array.isArray(picks)) {
            throw new Error("Invalid Campus Picks response");
        }

        container.replaceChildren();

        if (picks.length === 0) {
            container.textContent =
                "Be the first to favourite a dish!";
            return;
        }

        picks.forEach(function (item) {
            const card = document.createElement("a");

            card.className = "pick-card";
            card.href =
                "menu.html?canteen=" +
                encodeURIComponent(item.canteen);

            // Food icon
            const icon = document.createElement("div");
            icon.className = "pick-icon";
            icon.textContent = "🍽️";

            // Information section
            const info = document.createElement("div");
            info.className = "pick-info";

            const meta = document.createElement("div");
            meta.className = "pick-meta";

            const tag = document.createElement("span");
            tag.className = "pick-tag";
            tag.textContent = "❤️ Most favourited";

            const count = document.createElement("span");
            count.className = "pick-rating";
            count.textContent =
                "♥ " + Number(item.favourite_count || 0);

            meta.append(tag, count);

            const name = document.createElement("strong");
            name.className = "pick-name";
            name.textContent = item.item_name || "Food item";

            const subtitle = document.createElement("span");
            subtitle.className = "pick-sub";

            const canteenName = {
                cafeteria: "Cafeteria",
                timeless: "Timeless",
                nescafe: "Nescafe"
            }[item.canteen] || item.canteen;

            subtitle.textContent =
                (item.category || "Food") + " · " + canteenName;

            info.append(meta, name, subtitle);

            // Price and action
            const priceBox = document.createElement("div");
            priceBox.className = "pick-price-box";

            const price = document.createElement("span");
            price.className = "pick-price";
            price.textContent = "₹" + Number(item.price || 0);

            const action = document.createElement("span");
            action.className = "pick-action";
            action.textContent = "View Menu →";

            priceBox.append(price, action);

            card.append(icon, info, priceBox);
            container.appendChild(card);
        });
    } catch (error) {
        console.error("Could not load Campus Picks:", error);

        container.textContent =
            "Campus picks are temporarily unavailable.";
    }
});


window.addEventListener("campusBitesFavoritesUpdated", function () {
    const container = document.getElementById("campusPicksItems");

    if (container) {
        container.textContent = "Updating Campus Picks...";

        // Reload the section after the favourite changes.
        window.location.reload();
    }
});
