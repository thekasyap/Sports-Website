require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

app.use(helmet({
  contentSecurityPolicy: false, // disabled so inline scripts work
  crossOriginEmbedderPolicy: false
}));

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 attempts per window
  message: { success: false, message: "Too many attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// ENVIRONMENT VARIABLES
// ============================================

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sportsStore";
const JWT_SECRET = process.env.JWT_SECRET || "rimbic_default_secret";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin@123";

// ============================================
// RAZORPAY SETUP
// ============================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ============================================
// DATABASE CONNECTION
// ============================================

mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.log("❌ MongoDB Error:", err.message);
    console.log("⚠️  Server will continue but database features won't work.");
  });

// ============================================
// MODELS
// ============================================

// --- Product ---
const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true },
  category: { type: String, default: "General" },
  description: { type: String, default: "" },
  stock: { type: Number, default: 100 }
}, { timestamps: true });
const Product = mongoose.model("Product", ProductSchema);

// --- User ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { timestamps: true });
const User = mongoose.model("User", UserSchema);

// --- Order ---
const OrderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userEmail: { type: String, required: true },
  userName: { type: String, default: "" },
  products: [{
    name: String,
    price: Number,
    image: String,
    qty: Number
  }],
  total: { type: Number, required: true },
  shippingAddress: {
    fullName: String,
    address: String,
    city: String,
    pincode: String,
    phone: String
  },
  paymentId: { type: String, default: "" },
  razorpayOrderId: { type: String, default: "" },
  status: { type: String, default: "Processing" }
}, { timestamps: true });
const Order = mongoose.model("Order", OrderSchema);

// --- Contact ---
const ContactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true }
}, { timestamps: true });
const Contact = mongoose.model("Contact", ContactSchema);

// --- Newsletter ---
const NewsletterSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  subscribedAt: { type: Date, default: Date.now }
});
const Newsletter = mongoose.model("Newsletter", NewsletterSchema);

// ============================================
// HELPERS
// ============================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return EMAIL_REGEX.test(email);
}

function sanitizeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[<>"'&]/g, (char) => {
    const map = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' };
    return map[char] || char;
  });
}

// ============================================
// AUTH MIDDLEWARE
// ============================================

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

function adminMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Admin token required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired admin token" });
  }
}

// ============================================
// AUTHENTICATION API
// ============================================

// --- Signup ---
app.post("/signup", authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User already exists with this email" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ name: sanitizeHtml(name), email, password: hashedPassword });
    await newUser.save();

    res.json({ success: true, message: "Account created successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// --- Login ---
app.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: { _id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// --- Admin Login ---
app.post("/admin-login", authLimiter, (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required" });
  }

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "12h" });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Invalid admin credentials" });
  }
});

// --- Verify Token (for frontend auth guards) ---
app.get("/verify-token", authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.get("/verify-admin", adminMiddleware, (req, res) => {
  res.json({ success: true });
});

// ============================================
// PRODUCT API
// ============================================

// --- Get all products (public) ---
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch products", error: err.message });
  }
});

// --- Get single product (public) ---
app.get("/product/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch product", error: err.message });
  }
});

// --- Add product (admin only) ---
app.post("/add-product", adminMiddleware, async (req, res) => {
  try {
    const { name, price, image } = req.body;

    if (!name || !price || !image) {
      return res.status(400).json({ success: false, message: "Name, price, and image are required" });
    }

    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({ success: false, message: "Price must be a positive number" });
    }

    const productData = {
      name: sanitizeHtml(req.body.name),
      price: req.body.price,
      image: req.body.image,
      category: sanitizeHtml(req.body.category || "General"),
      description: sanitizeHtml(req.body.description || ""),
      stock: req.body.stock || 100
    };

    const newProduct = new Product(productData);
    await newProduct.save();
    res.json({ success: true, product: newProduct });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to add product", error: err.message });
  }
});

// --- Update product (admin only) ---
app.put("/update-product/:id", adminMiddleware, async (req, res) => {
  try {
    const updateData = {};
    if (req.body.name) updateData.name = sanitizeHtml(req.body.name);
    if (req.body.price) updateData.price = req.body.price;
    if (req.body.image) updateData.image = req.body.image;
    if (req.body.category) updateData.category = sanitizeHtml(req.body.category);
    if (req.body.description !== undefined) updateData.description = sanitizeHtml(req.body.description);
    if (req.body.stock !== undefined) updateData.stock = req.body.stock;

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, product: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update product", error: err.message });
  }
});

// --- Delete product (admin only) ---
app.delete("/delete-product/:id", adminMiddleware, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete product", error: err.message });
  }
});

// ============================================
// PAYMENT & ORDER API
// ============================================

// --- Create Razorpay Order ---
app.post("/create-order", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: "receipt_" + Date.now()
    });

    res.json({ success: true, order });
  } catch (err) {
    console.log("Razorpay Error:", err);
    res.status(500).json({ success: false, message: "Failed to create payment order", error: err.message });
  }
});

// --- Verify Razorpay Payment ---
app.post("/verify-payment", authMiddleware, (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment details are required" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      res.json({ success: true, message: "Payment verified" });
    } else {
      res.status(400).json({ success: false, message: "Payment verification failed" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Verification error", error: err.message });
  }
});

// --- Place Order (auth required) ---
app.post("/place-order", authMiddleware, async (req, res) => {
  try {
    const { userId, userEmail, userName, products, total, shippingAddress, paymentId, razorpayOrderId } = req.body;

    if (!userId || !userEmail || !products || !total) {
      return res.status(400).json({ success: false, message: "Order details are incomplete" });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, message: "Order must contain at least one product" });
    }

    // Decrement stock for each product
    for (const item of products) {
      if (item.name) {
        await Product.findOneAndUpdate(
          { name: item.name, stock: { $gte: (item.qty || 1) } },
          { $inc: { stock: -(item.qty || 1) } }
        );
      }
    }

    const newOrder = new Order({
      userId,
      userEmail,
      userName: userName || "",
      products,
      total,
      shippingAddress: shippingAddress || {},
      paymentId: paymentId || "",
      razorpayOrderId: razorpayOrderId || "",
      status: "Processing"
    });

    await newOrder.save();

    res.json({ success: true, order: newOrder, message: "Order placed successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to place order", error: err.message });
  }
});

// --- Get all orders (admin only) ---
app.get("/orders", adminMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch orders", error: err.message });
  }
});

// --- Get orders by user (user auth required) ---
app.get("/orders/:userId", authMiddleware, async (req, res) => {
  try {
    // Ensure user can only access their own orders
    if (req.user.userId !== req.params.userId && req.user.email !== req.params.userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch orders", error: err.message });
  }
});

// --- Update order status (admin only) ---
app.put("/update-order/:id", adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["Processing", "Shipped", "Delivered", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status. Must be: " + validStatuses.join(", ") });
    }

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    res.json({ success: true, order: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update order", error: err.message });
  }
});

// --- Delete order (admin only) ---
app.delete("/delete-order/:id", adminMiddleware, async (req, res) => {
  try {
    const deleted = await Order.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    res.json({ success: true, message: "Order deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete order", error: err.message });
  }
});

// ============================================
// CONTACT & NEWSLETTER API
// ============================================

// --- Contact form (public) ---
app.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    const newContact = new Contact({
      name: sanitizeHtml(name),
      email,
      message: sanitizeHtml(message)
    });
    await newContact.save();

    res.json({ success: true, message: "Message received! We'll get back to you soon." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to send message", error: err.message });
  }
});

// --- Get all contact messages (admin only) ---
app.get("/contacts", adminMiddleware, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch contacts", error: err.message });
  }
});

// --- Newsletter subscribe (public) ---
app.post("/newsletter", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    const existing = await Newsletter.findOne({ email });
    if (existing) {
      return res.json({ success: true, message: "You're already subscribed!" });
    }

    const sub = new Newsletter({ email });
    await sub.save();

    res.json({ success: true, message: "Subscribed successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to subscribe", error: err.message });
  }
});

// --- Get all subscribers (admin only) ---
app.get("/newsletters", adminMiddleware, async (req, res) => {
  try {
    const subscribers = await Newsletter.find().sort({ subscribedAt: -1 });
    res.json(subscribers);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch subscribers", error: err.message });
  }
});

// --- Razorpay Key (for frontend) ---
app.get("/razorpay-key", (req, res) => {
  res.json({ key: process.env.RAZORPAY_KEY_ID });
});

// --- Admin Stats ---
app.get("/admin/stats", adminMiddleware, async (req, res) => {
  try {
    const productCount = await Product.countDocuments();
    const orderCount = await Order.countDocuments();
    const contactCount = await Contact.countDocuments();
    const subscriberCount = await Newsletter.countDocuments();

    const revenueResult = await Order.aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    res.json({
      success: true,
      stats: {
        products: productCount,
        orders: orderCount,
        contacts: contactCount,
        subscribers: subscriberCount,
        revenue: totalRevenue
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch stats", error: err.message });
  }
});

// ============================================
// STATIC FILES
// ============================================

app.use(express.static(path.join(__dirname, "../")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../index.html"));
});

// ============================================
// 404 CATCH-ALL
// ============================================

app.use((req, res) => {
  // For API routes, return JSON
  if (req.path.startsWith("/api") || req.headers.accept?.includes("application/json")) {
    return res.status(404).json({ success: false, message: "Route not found" });
  }
  // For page requests, redirect to home
  res.status(404).sendFile(path.join(__dirname, "../index.html"));
});

// ============================================
// SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});