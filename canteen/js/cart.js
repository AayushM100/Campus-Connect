
"use strict";

// =====================================================
// CAMPUS BITES - SHARED CART
// Works on Home, Canteens and Menu pages
// =====================================================


// =====================================================
// 1. LOAD CART FROM LOCAL STORAGE
// =====================================================

function loadCart() {
    try {
        const savedCart = JSON.parse(
            localStorage.getItem("campusBitesCart") || "[]"
        );

        if (!Array.isArray(savedCart)) {
            return [];
        }

        // Normalise old cart entries so quantity calculations work.
        return savedCart
            .filter(item => item && item.item_id != null)
            .map(item => ({
                ...item,
                item_id: String(item.item_id),
                canteen: String(item.canteen || "cafeteria"),
                item_name: String(item.item_name || "Food item"),
                price: Number(item.price) || 0,
                quantity: Math.max(
                    1,
                    Math.floor(Number(item.quantity) || 1)
                )
            }));
    } catch (error) {
        console.error("Could not load cart:", error);
        return [];
    }
}

let cart = loadCart();


// =====================================================
// 2. SAVE CART
// =====================================================

function saveCart() {
    try {
        localStorage.setItem(
            "campusBitesCart",
            JSON.stringify(cart)
        );
    } catch (error) {
        console.error("Could not save cart:", error);
        alert("Could not save your cart. Check your browser storage.");
    }
}


// =====================================================
// 3. GET TOTAL NUMBER OF ITEMS
// =====================================================

function getCartCount() {
    return cart.reduce(function (total, item) {
        return total + (Number(item.quantity) || 0);
    }, 0);
}


// =====================================================
// 4. GET CART TOTAL
// =====================================================

function getCartTotal() {
    return cart.reduce(function (total, item) {
        return total +
            (Number(item.price) || 0) *
            (Number(item.quantity) || 0);
    }, 0);
}


// =====================================================
// 5. UPDATE CART COUNTER
// =====================================================

function updateCartCount() {
    const cartCount = document.querySelector("#cartCount");

    if (cartCount) {
        cartCount.textContent = getCartCount();
    }
}


// =====================================================
// 6. FIND A CART ITEM
// Normalise IDs to strings to avoid string/number mismatches.
// =====================================================

function findCartItem(itemId, canteen) {
    return cart.find(function (cartItem) {
        return (
            String(cartItem.item_id) === String(itemId) &&
            String(cartItem.canteen) === String(canteen)
        );
    });
}


// =====================================================
// 7. ADD ITEM TO CART
// Compatible with window.addToCart(item, button).
// =====================================================

function addToCart(item, button) {
    if (!item) {
        console.error("Cannot add an empty item to the cart.");
        return;
    }

    const itemId = item.item_id ?? item.id;

    if (itemId == null || itemId === "") {
        console.error("Food item is missing its ID:", item);
        alert("This food item could not be added. Please try again.");
        return;
    }

    const canteen = String(item.canteen || "cafeteria");

    // Prevent adding food that the menu currently marks unavailable.
    const status = String(item.availability ?? "Available")
        .trim()
        .toLowerCase();

    const explicitlyUnavailable =
        item.is_available === false ||
        item.is_available === 0 ||
        item.is_available === "0" ||
        status === "not available" ||
        status === "unavailable" ||
        status === "out of stock" ||
        status === "closed";

    if (explicitlyUnavailable) {
        alert("Sorry, this item is currently unavailable.");
        return;
    }

    const existingItem = findCartItem(itemId, canteen);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            item_id: String(itemId),
            item_name: String(item.item_name || item.name || "Food item"),
            price: Number(item.price) || 0,
            category: String(item.category || ""),
            canteen: canteen,
            quantity: 1
        });
    }

    saveCart();
    updateCartCount();

    // Give the user feedback without changing the cart's actual data.
    if (button) {
        const originalText = button.textContent;

        button.textContent = "✓ Added";
        button.classList.add("added");

        button.disabled = true;

        setTimeout(function () {
            if (!button.isConnected) return;

            button.textContent = originalText;
            button.classList.remove("added");
            button.disabled = false;
        }, 1000);
    }
}

// Allow other scripts to call addToCart reliably.
window.addToCart = addToCart;


// =====================================================
// 8. CREATE FLOATING CART BUTTON
// =====================================================

function createCartButton() {
    if (document.querySelector("#cartButton")) {
        updateCartCount();
        return;
    }

    const cartButton = document.createElement("button");

    cartButton.id = "cartButton";
    cartButton.type = "button";
    cartButton.setAttribute("aria-label", "Open shopping cart");

    cartButton.innerHTML = `
        🛒
        <span id="cartCount">${getCartCount()}</span>
    `;

    const currentPage = window.location.pathname.toLowerCase();

    if (
        currentPage.endsWith("/index.html") ||
        currentPage.endsWith("/")
    ) {
        cartButton.classList.add("cart-home");
    } else {
        cartButton.classList.add("cart-bottom");
    }

    cartButton.addEventListener("click", showCart);

    document.body.appendChild(cartButton);
}


// =====================================================
// 9. ESCAPE TEXT BEFORE INSERTING INTO HTML
// =====================================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (character) {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return replacements[character];
    });
}


// =====================================================
// 10. CANTEEN NAME
// =====================================================

function getCanteenName(canteen) {
    const names = {
        cafeteria: "Cafeteria",
        timeless: "Timeless",
        nescafe: "Nescafe"
    };

    return names[canteen] || canteen || "Campus";
}


// =====================================================
// 11. UPDATE ITEM QUANTITY
// Shared by the + and − buttons.
// =====================================================

function changeCartQuantity(itemId, canteen, action) {
    const item = findCartItem(itemId, canteen);

    if (!item) {
        console.warn("Cart item not found:", itemId, canteen);
        return;
    }

    if (action === "increase") {
        item.quantity += 1;
    } else if (action === "decrease") {
        item.quantity -= 1;
    } else {
        return;
    }

    // Remove the item when its quantity reaches zero.
    if (item.quantity <= 0) {
        cart = cart.filter(function (cartItem) {
            return !(
                String(cartItem.item_id) === String(itemId) &&
                String(cartItem.canteen) === String(canteen)
            );
        });
    }

    saveCart();
    updateCartCount();

    // Re-render the open cart with the updated quantity and total.
    showCart();
}


// =====================================================
// 12. SHOW CART
// =====================================================

function showCart() {
    const oldOverlay = document.querySelector("#cartOverlay");

    if (oldOverlay) {
        oldOverlay.remove();
    }

    const overlay = document.createElement("div");
    overlay.id = "cartOverlay";

    const panel = document.createElement("div");
    panel.className = "cart-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "cartTitle");

    // Header.
    const header = document.createElement("div");
    header.className = "cart-header";

    const title = document.createElement("h2");
    title.id = "cartTitle";
    title.textContent = "🛒 Your Cart";

    const closeButton = document.createElement("button");
    closeButton.id = "closeCart";
    closeButton.type = "button";
    closeButton.textContent = "✕";
    closeButton.setAttribute("aria-label", "Close cart");

    header.append(title, closeButton);

    // Content.
    const content = document.createElement("div");
    content.className = "cart-content";

    if (cart.length === 0) {
        const emptyCart = document.createElement("div");
        emptyCart.className = "empty-cart";

        emptyCart.innerHTML = `
            <div aria-hidden="true">🛒</div>
            <h3>Your tummy called!</h3>
            <p>
                Your cart is empty for now.
                There are tasty campus favourites waiting for you.
            </p>
            <p class="empty-cart-hint">
                Add something to fill your tummy!
            </p>
        `;

        content.appendChild(emptyCart);
    } else {
        cart.forEach(function (item) {
            const cartItem = document.createElement("div");
            cartItem.className = "cart-item";

            const info = document.createElement("div");
            info.className = "cart-item-info";

            const name = document.createElement("strong");
            name.textContent = item.item_name;

            const canteen = document.createElement("small");
            canteen.textContent = getCanteenName(item.canteen);

            const price = document.createElement("span");
            price.textContent =
                `₹${Number(item.price).toFixed(2).replace(/\.00$/, "")} × ${item.quantity}`;

            info.append(name, canteen, price);

            const actions = document.createElement("div");
            actions.className = "cart-item-actions";

            const decreaseButton = document.createElement("button");
            decreaseButton.className = "quantity-button";
            decreaseButton.type = "button";
            decreaseButton.dataset.action = "decrease";
            decreaseButton.dataset.id = String(item.item_id);
            decreaseButton.dataset.canteen = item.canteen;
            decreaseButton.textContent = "−";
            decreaseButton.setAttribute("aria-label", `Decrease ${item.item_name}`);

            const quantity = document.createElement("span");
            quantity.className = "cart-quantity";
            quantity.textContent = item.quantity;

            const increaseButton = document.createElement("button");
            increaseButton.className = "quantity-button";
            increaseButton.type = "button";
            increaseButton.dataset.action = "increase";
            increaseButton.dataset.id = String(item.item_id);
            increaseButton.dataset.canteen = item.canteen;
            increaseButton.textContent = "+";
            increaseButton.setAttribute("aria-label", `Increase ${item.item_name}`);

            actions.append(decreaseButton, quantity, increaseButton);
            cartItem.append(info, actions);
            content.appendChild(cartItem);
        });

        // Total.
        const totalRow = document.createElement("div");
        totalRow.className = "cart-total";

        const totalLabel = document.createElement("strong");
        totalLabel.textContent = "Total";

        const totalAmount = document.createElement("strong");
        totalAmount.textContent =
            "₹" + getCartTotal().toFixed(2).replace(/\.00$/, "");

        totalRow.append(totalLabel, totalAmount);
        content.appendChild(totalRow);

        // Checkout.
        const checkoutButton = document.createElement("button");

        checkoutButton.className = "checkout-button";
        checkoutButton.type = "button";
        checkoutButton.textContent = "Proceed to Checkout";

        checkoutButton.addEventListener("click", function () {
            showStudentDetails();
        });

        content.appendChild(checkoutButton);

        panel.append(header, content);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        // Close using the close button.
        closeButton.addEventListener("click", function () {
            overlay.remove();
        });

        // Close when clicking outside the panel.
        overlay.addEventListener("click", function (event) {
            if (event.target === overlay) {
                overlay.remove();
            }
        });

        // Delegate quantity-button clicks from the cart panel.
        // This continues to work when showCart() re-renders the cart.
        content.addEventListener("click", function (event) {
            const button = event.target.closest(".quantity-button");

            if (!button) return;

            changeCartQuantity(
                button.dataset.id,
                button.dataset.canteen,
                button.dataset.action
            );
        });

        // Close cart with Escape.
        function handleEscape(event) {
            if (event.key === "Escape") {
                overlay.remove();
                document.removeEventListener("keydown", handleEscape);
            }
        }

        document.addEventListener("keydown", handleEscape);
    }

}

// =====================================================
// 13. INITIALISE CART
// =====================================================

function initialiseCart() {
    createCartButton();
    updateCartCount();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseCart);
} else {
    initialiseCart();
}


// =====================================================
// 14. RAZORPAY CHECKOUT
// =====================================================
// Payment is kept in this file so it remains independent from favourites,
// campus picks and the individual menu-page scripts.

const CHECKOUT_PROFILE_KEY = "campusBitesCheckoutProfile";
const CHECKOUT_API_URL = window.CAMPUS_BITES_API_URL || "/api";

function formatCurrency(amount) {
    return "₹" + Number(amount || 0).toFixed(2).replace(/\.00$/, "");
}

function closeCheckoutOverlay() {
    const overlay = document.querySelector("#checkoutOverlay");
    if (overlay) overlay.remove();
}

function getSavedCheckoutProfile() {
    try {
        const saved = JSON.parse(localStorage.getItem(CHECKOUT_PROFILE_KEY) || "{}") || {};
        if (!saved.studentName && localStorage.getItem("studentName")) {
            saved.studentName = localStorage.getItem("studentName");
        }
        return saved;
    } catch (error) {
        return {};
    }
}

function saveCheckoutProfile(profile) {
    localStorage.setItem(CHECKOUT_PROFILE_KEY, JSON.stringify(profile));
}

function addCheckoutCloseBehaviour(overlay, closeButton) {
    closeButton.addEventListener("click", closeCheckoutOverlay);
    overlay.addEventListener("click", function (event) {
        if (event.target === overlay) closeCheckoutOverlay();
    });
}

function getCheckoutItemsMarkup() {
    return cart.map(function (item) {
        const quantity = Number(item.quantity) || 1;
        const itemTotal = (Number(item.price) || 0) * quantity;

        return `
            <li>
                <span>${escapeHTML(item.item_name)} <small>× ${quantity}</small></span>
                <strong>${formatCurrency(itemTotal)}</strong>
            </li>`;
    }).join("");
}

function showStudentDetails() {
    const cartOverlay = document.querySelector("#cartOverlay");
    if (cartOverlay) cartOverlay.remove();
    closeCheckoutOverlay();

    const profile = getSavedCheckoutProfile();
    const overlay = document.createElement("div");
    overlay.id = "checkoutOverlay";
    overlay.className = "checkout-overlay";
    overlay.innerHTML = `
        <section class="checkout-card" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
            <div class="checkout-header">
                <div>
                    <p class="checkout-kicker">CAMPUS BITES</p>
                    <h2 id="checkoutTitle">Almost there</h2>
                    <p>Tell us who is picking up this order.</p>
                </div>
                <button class="checkout-close" type="button" aria-label="Close checkout">×</button>
            </div>
            <div class="checkout-summary">
                <div class="checkout-summary-items">
                    <span class="checkout-summary-count">${getCartCount()} item${getCartCount() === 1 ? "" : "s"}</span>
                    <ul>${getCheckoutItemsMarkup()}</ul>
                </div>
                <strong class="checkout-summary-total">${formatCurrency(getCartTotal())}</strong>
            </div>
            <form class="student-details-form" novalidate>
                <label>Student name
                    <input name="studentName" type="text" maxlength="80" autocomplete="name" required placeholder="Your full name" value="${escapeHTML(profile.studentName || "")}">
                </label>
                <label>Phone number
                    <input name="phone" type="tel" inputmode="numeric" autocomplete="tel" pattern="[0-9]{10}" required placeholder="10-digit mobile number" value="${escapeHTML(profile.phone || "")}">
                </label>
                <label>Department
                    <select name="department" required>
                        <option value="">Select department</option>
                        <option value="Computer Engineering">Computer Engineering</option>
                        <option value="Information Technology">Information Technology</option>
                        <option value="AI & Data Science">AI & Data Science</option>
                        <option value="E&TC">E&TC</option>
                        <option value="Mechanical Engineering">Mechanical Engineering</option>
                        <option value="Civil Engineering">Civil Engineering</option>
                        <option value="Faculty / Staff">Faculty / Staff</option>
                        <option value="Other">Other</option>
                    </select>
                </label>
                <label>Roll number <span class="field-optional">optional</span>
                    <input name="rollNumber" type="text" maxlength="40" autocomplete="off" placeholder="For easier pickup" value="${escapeHTML(profile.rollNumber || "")}">
                </label>
                <p class="checkout-note">You will choose UPI, scan a QR code where available, or select another payment option on Razorpay’s secure screen.</p>
                <p class="checkout-error" role="alert" hidden></p>
                <div class="checkout-actions">
                    <button class="checkout-back" type="button">Back to cart</button>
                    <button class="checkout-pay" type="submit">Pay ${formatCurrency(getCartTotal())}</button>
                </div>
            </form>
        </section>`;

    document.body.appendChild(overlay);
    const form = overlay.querySelector(".student-details-form");
    const department = form.elements.department;
    department.value = profile.department || "";

    overlay.querySelector(".checkout-back").addEventListener("click", function () {
        closeCheckoutOverlay();
        showCart();
    });
    addCheckoutCloseBehaviour(overlay, overlay.querySelector(".checkout-close"));

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        startRazorpayCheckout(form, overlay);
    });

    form.elements.studentName.focus();
}

function displayCheckoutError(overlay, message) {
    const error = overlay.querySelector(".checkout-error");
    error.textContent = message;
    error.hidden = false;
}

async function postCheckoutRequest(path, data) {
    const headers = { "Content-Type": "application/json" };
    if (window.CampusAuth && window.CampusAuth.getIdToken) {
        try {
            const token = await window.CampusAuth.getIdToken();
            if (token) headers["Authorization"] = `Bearer ${token}`;
        } catch (e) {
            console.warn("Could not retrieve auth token for checkout:", e);
        }
    }
    const response = await fetch(`${CHECKOUT_API_URL}${path}`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(data)
    });
    const body = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
    return body;
}

async function startRazorpayCheckout(form, overlay) {
    const formData = new FormData(form);
    const profile = {
        studentName: String(formData.get("studentName") || "").trim(),
        phone: String(formData.get("phone") || "").replace(/\D/g, ""),
        department: String(formData.get("department") || "").trim(),
        rollNumber: String(formData.get("rollNumber") || "").trim()
    };
    const payButton = overlay.querySelector(".checkout-pay");
    const originalText = payButton.textContent;
    overlay.querySelector(".checkout-error").hidden = true;

    if (!profile.studentName || !profile.department || !/^\d{10}$/.test(profile.phone)) {
        displayCheckoutError(overlay, "Enter your name, department and a valid 10-digit phone number.");
        return;
    }
    if (typeof window.Razorpay !== "function") {
        displayCheckoutError(overlay, "Secure checkout is still loading. Please wait a moment and try again.");
        return;
    }

    payButton.disabled = true;
    payButton.textContent = "Preparing secure payment...";
    try {
        // The server recalculates prices from the menu database. Never trust a browser total.
        const order = await postCheckoutRequest("/create-order", {
            customer_name: profile.studentName,
            customer_phone: profile.phone,
            department: profile.department,
            roll_number: profile.rollNumber,
            cart_items: cart.map(function (item) {
                return {
                    item_id: item.item_id,
                    canteen: item.canteen,
                    quantity: item.quantity
                };
            })
        });
        saveCheckoutProfile(profile);

        const razorpay = new window.Razorpay({
            key: order.key,
            amount: order.amount,
            currency: order.currency,
            name: "Campus Bites",
            description: "Campus food order",
            order_id: order.order_id,
            prefill: {
                name: profile.studentName,
                contact: profile.phone
            },
            notes: {
                department: profile.department,
                roll_number: profile.rollNumber || "Not provided"
            },
            theme: { color: "#c96e46" },
            modal: {
                ondismiss: function () {
                    payButton.disabled = false;
                    payButton.textContent = originalText;
                }
            },
            handler: async function (payment) {
                try {
                    payButton.textContent = "Verifying payment...";
                    await postCheckoutRequest("/verify-payment", payment);
                    cart = [];
                    saveCart();
                    updateCartCount();
                    showPaymentSuccess(overlay);
                } catch (error) {
                    payButton.disabled = false;
                    payButton.textContent = originalText;
                    displayCheckoutError(overlay, error.message || "Payment could not be verified. Please contact the canteen with your payment ID.");
                }
            }
        });
        razorpay.on("payment.failed", function () {
            payButton.disabled = false;
            payButton.textContent = originalText;
        });
        razorpay.open();
    } catch (error) {
        payButton.disabled = false;
        payButton.textContent = originalText;
        displayCheckoutError(overlay, error.message || "Could not start secure checkout. Please try again.");
    }
}

function showPaymentSuccess(overlay) {
    overlay.querySelector(".checkout-card").innerHTML = `
        <div class="payment-success">
            <div class="payment-success-icon" aria-hidden="true">✓</div>
            <h2>Payment confirmed</h2>
            <p>Your Campus Bites order has been placed. Please show your name at the canteen counter for pickup.</p>
            <button class="checkout-pay" type="button">Done</button>
        </div>`;
    overlay.querySelector(".checkout-pay").addEventListener("click", closeCheckoutOverlay);
}
