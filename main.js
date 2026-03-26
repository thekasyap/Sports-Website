// ============================================
// RIMBIC SPORTS — MAIN JAVASCRIPT
// ============================================

const API_BASE = window.location.origin || "http://localhost:3000";

// ---------- AUTH HELPERS ----------

function getUser() {
  try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
}

function getToken() {
  return localStorage.getItem("token") || "";
}

function getAuthHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + getToken()
  };
}

function logout() {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  showToast("Logged out successfully", "info");
  setTimeout(() => window.location.reload(), 500);
}


// ---------- DYNAMIC NAVBAR ----------

function updateNavbar() {
  const user = getUser();
  // Find all account dropdowns
  document.querySelectorAll('.nav-right .dropdown').forEach(dropdown => {
    const btn = dropdown.querySelector('.dropbtn');
    if (!btn || !btn.textContent.includes('Account')) return;

    const content = dropdown.querySelector('.dropdown-content');
    if (!content) return;

    if (user) {
      btn.innerHTML = `👤 ${user.name} ▾`;
      content.innerHTML = `
        <a href="orders.html">📦 My Orders</a>
        <a href="#" onclick="logout(); return false;">🚪 Logout</a>
      `;
    } else {
      btn.innerHTML = `Account ▾`;
      content.innerHTML = `
        <a href="login.html">Login</a>
        <a href="signup.html">Signup</a>
      `;
    }
  });
}


// ---------- TOAST NOTIFICATION SYSTEM ----------

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}


// ---------- SCROLL REVEAL (IntersectionObserver) ----------

function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  if (reveals.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('revealed');
        }, i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  reveals.forEach(el => observer.observe(el));
}


// ---------- NAVBAR SCROLL EFFECT ----------

function initNavbarScroll() {
  const navbar = document.getElementById('main-navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}


// ---------- BACK TO TOP BUTTON ----------

function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  });
}


// ---------- MOBILE MENU TOGGLE ----------

function toggleMenu() {
  const menu = document.getElementById('nav-menu');
  if (menu) {
    menu.classList.toggle('active');
  }
}


// ---------- CART MANAGEMENT ----------

function getCart() {
  return JSON.parse(localStorage.getItem("cart")) || [];
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function addToCart(name, price, image) {
  let cart = getCart();
  let product = cart.find(p => p.name === name);

  if (product) {
    product.qty += 1;
  } else {
    cart.push({ name, price, image, qty: 1 });
  }

  saveCart(cart);
  updateCartCount();
  showToast(`${name} added to cart!`);
}

function removeItem(index) {
  let cart = getCart();
  const name = cart[index]?.name || 'Item';
  cart.splice(index, 1);
  saveCart(cart);
  showToast(`${name} removed from cart`, 'info');
  location.reload();
}

function clearCart() {
  localStorage.removeItem("cart");
  showToast('Cart cleared', 'info');
  setTimeout(() => location.reload(), 500);
}

function updateCartCount() {
  let cart = getCart();
  let count = 0;
  cart.forEach(item => { count += (item.qty || 1); });

  const el = document.getElementById("cart-count");
  if (el) el.innerText = count;
}


// ---------- QUANTITY CONTROLS ----------

function increaseQty(name, price, image) {
  let cart = getCart();
  let product = cart.find(p => p.name === name);

  if (product) {
    product.qty += 1;
  } else {
    cart.push({ name, price, image, qty: 1 });
  }

  saveCart(cart);
  updateQtyDisplay();
  updateCartCount();
}

function decreaseQty(name) {
  let cart = getCart();
  let product = cart.find(p => p.name === name);

  if (product) {
    product.qty -= 1;
    if (product.qty <= 0) {
      cart = cart.filter(p => p.name !== name);
    }
  }

  saveCart(cart);
  updateQtyDisplay();
  updateCartCount();
}

function updateQtyDisplay() {
  let cart = getCart();
  cart.forEach(p => {
    let id = "qty-" + p.name.replace(/\s/g, '');
    let el = document.getElementById(id);
    if (el) el.innerText = p.qty;
  });
}


// ---------- NEWSLETTER ----------

async function subscribeNewsletter() {
  let emailEl = document.getElementById("newsletterEmail");
  if (!emailEl) return;

  let email = emailEl.value.trim();
  if (email === "") {
    showToast("Please enter your email", "error");
    return;
  }

  try {
    const res = await fetch(API_BASE + "/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (data.success) {
      showToast(data.message || "Subscribed successfully! 🎉");
      emailEl.value = "";
    } else {
      showToast(data.message || "Subscription failed", "error");
    }
  } catch (e) {
    showToast("Could not subscribe. Please try later.", "error");
  }
}


// ---------- CHECKOUT ----------

async function checkout() {
  let user = getUser();
  let cart = getCart();

  if (!user) {
    showToast("Please login first", "error");
    setTimeout(() => { window.location.href = "login.html"; }, 1000);
    return;
  }

  if (cart.length === 0) {
    showToast("Cart is empty", "error");
    return;
  }

  const total = cart.reduce((sum, p) => sum + p.price * (p.qty || 1), 0);
  localStorage.setItem("checkoutTotal", total);
  window.location.href = "checkout.html";
}


// ---------- ADMIN FUNCTIONS ----------

async function addProduct() {
  let name = document.getElementById("name").value;
  let price = document.getElementById("price").value;
  let image = document.getElementById("image").value;
  let categoryEl = document.getElementById("category");
  let category = categoryEl ? categoryEl.value : "General";

  if (!name || !price || !image) {
    showToast("Please fill all required fields", "error");
    return;
  }

  try {
    const res = await fetch(API_BASE + "/add-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price: Number(price), image, category })
    });

    const data = await res.json();
    if (data.success) {
      showToast("Product Added to Database!");
      document.getElementById("name").value = "";
      document.getElementById("price").value = "";
      document.getElementById("image").value = "";
      if (categoryEl) categoryEl.value = "General";
      loadProducts();
    } else {
      showToast(data.message || "Failed to add product", "error");
    }
  } catch (e) {
    showToast("Server not reachable", "error");
  }
}

async function loadProducts() {
  let container = document.getElementById("product-list");
  if (!container) return;

  try {
    let res = await fetch(API_BASE + "/products");
    let products = await res.json();
    container.innerHTML = "";

    products.forEach(p => {
      container.innerHTML += `
        <div class="admin-product">
          <img src="${p.image}" alt="${p.name}">
          <h3>${p.name}</h3>
          <p>₹${p.price}</p>
          <p style="color:#6b7280;font-size:13px;">${p.category || 'General'}</p>
          <button onclick="deleteProduct('${p._id}')">Delete</button>
        </div>
      `;
    });
  } catch (e) {
    // Server not running – silently skip
  }
}

async function deleteProduct(id) {
  try {
    await fetch(API_BASE + "/delete-product/" + id, {
      method: "DELETE"
    });
    showToast("Product deleted", "info");
    loadProducts();
  } catch (e) {
    showToast("Failed to delete product", "error");
  }
}


// ---------- INIT ON DOM READY ----------

document.addEventListener('DOMContentLoaded', () => {
  updateCartCount();
  updateNavbar();
  initScrollReveal();
  initNavbarScroll();
  initBackToTop();
  loadProducts();
  updateQtyDisplay();
});