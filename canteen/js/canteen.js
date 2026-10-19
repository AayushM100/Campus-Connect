"use strict";

const canteenCards = document.querySelectorAll(".canteen-card");
const breakOptions = document.querySelectorAll(".break-option");
const resultsText = document.querySelector("#resultsText");

// Updated to absolute Vercel paths to prevent 404 errors
const foodFilterUrls = {
    all: "/canteen/menu.html",
    "full-meals": "/canteen/menu.html?filter=full-meals",
    "coffee-drinks": "/canteen/menu.html?filter=coffee-drinks",
    "quick-bites": "/canteen/menu.html?filter=quick-bites"
};

// Highlight a selected category and navigate to Browse Cuisine.
breakOptions.forEach(function (button) {
    button.addEventListener("click", function () {
        const filter = button.dataset.foodFilter || "all";

        breakOptions.forEach(function (option) {
            option.classList.toggle("active", option === button);
        });

        window.location.href = foodFilterUrls[filter] || foodFilterUrls.all;
    });
});

function formatTime(decimalTime) {
    const hour = Math.floor(decimalTime);
    const minutes = Math.round((decimalTime - hour) * 60);
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return displayHour + ":" +
        String(minutes).padStart(2, "0") + " " + period;
}

function updateCanteenHours() {
    // Force India Standard Time regardless of the device settings
    const now = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const currentTime = now.getHours() + now.getMinutes() / 60;

    const isWeekend = currentDay === 0 || currentDay === 6;
    const isFriday = currentDay === 5;

    canteenCards.forEach(function (card) {
        const opening = Number(card.dataset.opening);
        const closing = Number(card.dataset.closing);
        const status = card.querySelector(".status");
        const openTime = card.querySelector(".open-time");

        if (!status || !openTime) return;

        // Condition: Must NOT be a weekend AND must be within operating hours
        const isOpen = !isWeekend && (currentTime >= opening && currentTime < closing);

        status.textContent = isOpen ? "Open now" : "Closed now";
        status.classList.toggle("closed", !isOpen);

        if (isOpen) {
            openTime.textContent = "Open until " + formatTime(closing);
        } else if (isWeekend) {
            // Over the weekend, tell them it opens Monday
            openTime.textContent = "Opens Monday at " + formatTime(opening);
        } else if (currentTime < opening) {
            // Early morning before opening
            openTime.textContent = "Opens at " + formatTime(opening);
        } else if (currentTime >= closing) {
            // After closing hours
            if (isFriday) {
                openTime.textContent = "Opens Monday at " + formatTime(opening);
            } else {
                openTime.textContent = "Opens tomorrow at " + formatTime(opening);
            }
        }
    });
}

if (resultsText) {
    resultsText.textContent = "All " + canteenCards.length + " canteens";
}

updateCanteenHours();