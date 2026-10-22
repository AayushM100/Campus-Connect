
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
        const checkoutButton = document.createElement("button");
        checkoutButton.className = "checkout-button";
        checkoutButton.type = "button";
        checkoutButton.textContent = "Proceed to Checkout";

        checkoutButton.addEventListener("click", function () {
            alert("Checkout is not connected yet.");
        });

        content.appendChild(checkoutButton);
    }

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


async function checkout() {
    // 1. Get cart items from localStorage
    const cart = JSON.parse(localStorage.getItem("campus_bites_cart")) || [];

    if (cart.length === 0) {
        alert("Your cart is empty!");
        return;
    }

    // Calculate total bill
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const canteenName = cart[0].canteen || "Cafeteria";

    // Simple prompts for student details (you can replace these with a modal form later)
    const customerName = prompt("Enter your Name for the order:");
    const customerPhone = prompt("Enter your Phone Number:");

    if (!customerName || !customerPhone) {
        alert("Name and Phone number are required to place an order.");
        return;
    }

    try {
        // 2. Call backend to create Razorpay Order
        const response = await fetch("https://campus-connect-1-0q94.onrender.com/api/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount: totalAmount,
                canteen: canteenName,
                customer_name: customerName,
                customer_phone: customerPhone
            })
        });

        const orderData = await response.json();

        if (!response.ok) throw new Error(orderData.error || "Failed to create order");

        // 3. Configure Razorpay Popup Options
        const options = {
            key: orderData.key,
            amount: orderData.amount,
            currency: orderData.currency,
            name: "Campus Bites",
            description: `Order from ${canteenName}`,
            order_id: orderData.order_id,
            handler: async function (response) {
                // 4. Verify payment on backend upon successful completion
                const verifyRes = await fetch("https://campus-connect-1-0q94.onrender.com/api/verify-payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature
                    })
                });

                const verifyData = await verifyRes.json();

                if (verifyData.success) {
                    alert("🎉 Payment Successful! Your order has been placed.");
                    localStorage.removeItem("campus_bites_cart"); // Clear cart
                    window.location.reload();
                } else {
                    alert("❌ Payment verification failed: " + verifyData.error);
                }
            },
            prefill: {
                name: customerName,
                contact: customerPhone
            },
            theme: {
                color: "#c26d38" // Matches your Campus Bites theme color
            }
        };

        const rzp = new Razorpay(options);
        rzp.open();

    } catch (err) {
        console.error("Checkout error:", err);
        alert("Something went wrong during checkout. Please try again.");
    }
}