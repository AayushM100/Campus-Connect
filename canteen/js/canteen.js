
"use strict";

const canteenCards = document.querySelectorAll(".canteen-card");
const breakOptions = document.querySelectorAll(".break-option");
const resultsText = document.querySelector("#resultsText");

const foodFilterUrls = {
    all: "menu.html",
    "full-meals": "menu.html?filter=full-meals",
    "coffee-drinks": "menu.html?filter=coffee-drinks",
    "quick-bites": "menu.html?filter=quick-bites"
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
    const now = new Date();
    const currentTime = now.getHours() + now.getMinutes() / 60;

    canteenCards.forEach(function (card) {
        const opening = Number(card.dataset.opening);
        const closing = Number(card.dataset.closing);
        const status = card.querySelector(".status");
        const openTime = card.querySelector(".open-time");

        if (!status || !openTime) return;

        const isOpen = currentTime >= opening && currentTime < closing;

        status.textContent = isOpen ? "Open now" : "Closed";
        status.classList.toggle("closed", !isOpen);

        if (isOpen) {
            openTime.textContent = "Open until " + formatTime(closing);
        } else if (currentTime < opening) {
            openTime.textContent = "Opens at " + formatTime(opening);
        } else {
            openTime.textContent = "Opens tomorrow at " + formatTime(opening);
        }
    });
}

if (resultsText) {
    resultsText.textContent = "All " + canteenCards.length + " canteens";
}

updateCanteenHours();
