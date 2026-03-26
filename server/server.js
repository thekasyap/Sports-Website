require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

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
  .catch(err => console.log("❌ MongoDB Error:", err.message));

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

// ============================================
// AUTHENTICATION API
// ============================================

// --- Signup ---
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
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

    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.json({ success: true, message: "Account created successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// --- Login ---
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
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
app.post("/admin-login", (req, res) => {
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

// ============================================
// PRODUCT API
// ============================================

// --- Get all products ---
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch products", error: err.message });
  }
});

// --- Get single product ---
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

// --- Add product ---
app.post("/add-product", async (req, res) => {
  try {
    const { name, price, image } = req.body;

    if (!name || !price || !image) {
      return res.status(400).json({ success: false, message: "Name, price, and image are required" });
    }

    const newProduct = new Product(req.body);
    await newProduct.save();
    res.json({ success: true, product: newProduct });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to add product", error: err.message });
  }
});

// --- Update product ---
app.put("/update-product/:id", async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
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

// --- Delete product ---
app.delete("/delete-product/:id", async (req, res) => {
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
app.post("/create-order", async (req, res) => {
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
app.post("/verify-payment", (req, res) => {
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

// --- Place Order ---
app.post("/place-order", async (req, res) => {
  try {
    const { userId, userEmail, userName, products, total, shippingAddress, paymentId, razorpayOrderId } = req.body;

    if (!userId || !userEmail || !products || !total) {
      return res.status(400).json({ success: false, message: "Order details are incomplete" });
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

// --- Get all orders (admin) ---
app.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch orders", error: err.message });
  }
});

// --- Get orders by user ---
app.get("/orders/:userId", async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch orders", error: err.message });
  }
});

// --- Update order status (admin) ---
app.put("/update-order/:id", async (req, res) => {
  try {
    const { status } = req.body;
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

// ============================================
// CONTACT & NEWSLETTER API
// ============================================

// --- Contact form ---
app.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const newContact = new Contact({ name, email, message });
    await newContact.save();

    res.json({ success: true, message: "Message received! We'll get back to you soon." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to send message", error: err.message });
  }
});

// --- Get all contact messages (admin) ---
app.get("/contacts", async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch contacts", error: err.message });
  }
});

// --- Newsletter subscribe ---
app.post("/newsletter", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
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

// --- Razorpay Key (for frontend) ---
app.get("/razorpay-key", (req, res) => {
  res.json({ key: process.env.RAZORPAY_KEY_ID });
});

// ============================================
// STATIC FILES
// ============================================

app.use(express.static(path.join(__dirname, "../")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../index.html"));
});

// ============================================
// SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});