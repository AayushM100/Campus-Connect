
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

        // Checkout placeholder.
        // Razorpay checkout button.
        const checkoutButton = document.createElement("button");

        checkoutButton.className = "checkout-button";
        checkoutButton.type = "button";
        checkoutButton.textContent = "Proceed to Checkout";

        checkoutButton.addEventListener("click", async function () {
            checkoutButton.disabled = true;
            checkoutButton.textContent = "Connecting to checkout...";

            try {
                await checkout();
            } finally {
                checkoutButton.disabled = false;
                checkoutButton.textContent = "Proceed to Checkout";
            }
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


async function processPayment() {
    const cart = JSON.parse(localStorage.getItem("campus_bites_cart")) || [];
    if (cart.length === 0) return alert("Cart is empty!");

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const name = document.getElementById("cust-name").value;
    const dept = document.getElementById("cust-dept").value;
    const phone = document.getElementById("cust-phone").value;

    if (!name || !dept || !phone) return alert("Please fill all details!");

    try {
        const response = await fetch("https://campus-connect-1-0q94.onrender.com/api/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount: totalAmount,
                canteen: cart[0].canteen || "Cafeteria",
                customer_name: name,
                department: dept,
                customer_phone: phone,
                cart_items: cart
            })
        });

        const orderData = await response.json();

        const options = {
            key: orderData.key,
            amount: orderData.amount,
            currency: orderData.currency,
            name: "Campus Bites",
            description: `${dept} Dept - ${name}`,
            order_id: orderData.order_id,
            handler: async function (response) {
                const verifyRes = await fetch("https://campus-connect-1-0q94.onrender.com/api/verify-payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(response)
                });

                const verifyData = await verifyRes.json();
                if (verifyData.success) {
                    localStorage.removeItem("campus_bites_cart");
                    // Pass the order ID in the URL to display on the success page
                    window.location.href = `/success.html?order_id=${response.razorpay_order_id}`; 
                } else {
                    alert("Payment verification failed.");
                }
            },
            prefill: { name: name, contact: phone },
            theme: { color: "#c26d38" }
        };

        const rzp = new Razorpay(options);
        rzp.open();
    } catch (err) {
        console.error("Checkout error:", err);
    }
}