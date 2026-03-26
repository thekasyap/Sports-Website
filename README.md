# 🏆 Rimbic Sports – Premium E-Commerce Platform

Rimbic Sports is a modern, full-stack e-commerce platform designed for sports enthusiasts. It features a sleek glassmorphism UI, a responsive shopping experience, secure user authentication, Razorpay payment integration, and a comprehensive admin panel for inventory and order management.

## ✨ Features

### Customer Features
- **Modern UI/UX:** Responsive design with glassmorphism elements, custom fonts, and smooth animations.
- **Product Catalog:** Browse products by categories (Cricket, Football, Basketball, Badminton, Gym) or view special offers.
- **Shopping Cart:** Persistent local storage cart with dynamic total calculations.
- **Secure Checkout:** Integrated **Razorpay** payment gateway for seamless transactions.
- **User Accounts:** JWT-based authentication for user signup, login, and order tracking.
- **Order History:** Users can view their past orders, payment statuses, and shipping details.
- **Newsletter & Contact:** Functional contact forms and newsletter subscription endpoints.

### Admin Features
- **Secure Admin Panel:** Protected by server-side JWT authentication and route middleware.
- **Dashboard Analytics:** View real-time stats (Total Products, Orders, Revenue, Messages, Subscribers).
- **Product Management:** Full CRUD operations (Add, Edit, Delete) for the store inventory.
- **Order Management:** View all customer orders and update shipping statuses (Processing, Shipped, Delivered, Cancelled).

### Backend Security
- **Helmet.js** for robust HTTP header security.
- **Express Rate Limiting** to prevent brute-force attacks on authentication endpoints.
- **Input Sanitization** to mitigate XSS vulnerabilities.
- **Payload Limits** to prevent DoS attacks via massive request bodies.

---

## 🛠️ Tech Stack

**Frontend:**
- HTML5, CSS3 (Vanilla), JavaScript (Vanilla)
- Google Fonts (Inter, Outfit)
- Razorpay Checkout JS

**Backend:**
- Node.js & Express.js
- MongoDB & Mongoose (Database & ORM)
- JSON Web Tokens (JWT) for Authentication
- Bcrypt.js for Password Hashing
- Razorpay Node.js SDK

---

## 🚀 Getting Started

### Prerequisites
Make sure you have the following installed on your machine:
- [Node.js](https://nodejs.org/en) (v18 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas)
- A [Razorpay](https://razorpay.com/) account for payment processing credentials.

### 1. Clone or Download the Repository
Navigate to the project folder in your terminal:
```bash
cd "Sports Website"
```

### 2. Install Dependencies
Install the required Node.js packages:
```bash
npm install
```

### 3. Environment Variables (.env)
Create a `.env` file in the root directory (alongside `index.html`) and add the following configuration:

```env
# Server Configuration
PORT=3000

# Database Configuration (Match your local MongoDB URL or Atlas URI)
MONGODB_URI=mongodb://127.0.0.1:27017/sportsStore

# Authentication Secret (Change to a strong random string)
JWT_SECRET=your_super_secret_jwt_key

# Razorpay Credentials (Get these from your Razorpay Dashboard)
RAZORPAY_KEY_ID=rzp_test_yourkeyidhere
RAZORPAY_KEY_SECRET=your_razorpay_secret_here

# Default Admin Credentials
ADMIN_USER=admin
ADMIN_PASS=admin@123
```

### 4. Start the Server
Run the following command to start the backend server:
```bash
npm start
```

*The server will start on `http://localhost:3000`.*

### 5. Access the Platform
- **Storefront:** Open `http://localhost:3000` in your browser.
- **Admin Panel:** Go to `http://localhost:3000/admin.html` and log in using the credentials defined in your `.env` file.

---

## 📂 Project Structure

```text
├── .env                # Environment variables (Create this file)
├── package.json        # Project metadata and dependencies
├── server/
│   └── server.js       # Express backend entry point
├── admin/
│   ├── dashboard.html  # Secure Admin Dashboard
│   ├── add-product.html# Form to create new products
│   └── edit-product.html# Form to modify existing products
├── css/                # Stylesheets (if separated)
├── images/             # Static image assets
├── style.css           # Global stylesheet
├── main.js             # Global frontend JavaScript logic
├── index.html          # Homepage
├── shop.html           # Product catalog
├── product.html        # Individual product view
├── cart.html           # Shopping cart
├── checkout.html       # Shipping and Razorpay payment flow
├── orders.html         # User order history
├── login.html          # User login
├── signup.html         # User registration
├── admin.html          # Admin login portal
└── contact.html        # Contact Us form
```

---

## 🛡️ Best Practices for Production
- **Change Default Passwords:** Immediately change `ADMIN_USER` and `ADMIN_PASS` in the `.env` file before deploying.
- **Use Strong JWT Secrets:** Generate a cryptographically strong string for `JWT_SECRET`.
- **Database Security:** Ensure your MongoDB instance is secured with IP whitelisting and user authentication.
- **HTTPS:** Always serve the site over HTTPS to ensure secure transmission of tokens and user data.
