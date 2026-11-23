import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/server/db/schema.ts";

if (!process.env.POSTGRES_PASSWORD) {
  process.loadEnvFile?.(".env");
}

const host = process.env.PGHOST || "127.0.0.1";
const port = Number(process.env.PGPORT || "54329");
const password = process.env.POSTGRES_PASSWORD;

if (!password) {
  throw new Error("POSTGRES_PASSWORD is required in .env");
}

// Connect as superuser to qp_sales to insert seed data
const pool = new Pool({
  host,
  port,
  user: "postgres",
  password,
  database: "qp_sales",
});

const db = drizzle(pool, { schema });

async function seed() {
  console.log("Seeding qp_sales database...");

  // 1. Clean existing data in reverse order of foreign keys
  await pool.query(`
    TRUNCATE TABLE 
      order_items, 
      orders, 
      products, 
      customers, 
      categories 
    RESTART IDENTITY CASCADE;
  `);
  console.log("✓ Reset existing tables");

  // 2. Categories
  const insertedCategories = await db
    .insert(schema.categories)
    .values([
      { name: "Electronics", description: "Gadgets, hardware, and audio" },
      { name: "Apparel", description: "Clothing, shoes, and accessories" },
      { name: "Home & Kitchen", description: "Cookware, furniture, and decor" },
      { name: "Books", description: "Printed books, e-books, and guides" },
      { name: "Sports & Outdoors", description: "Fitness equipment and outdoor gear" },
    ])
    .returning();
  console.log(`✓ Inserted ${insertedCategories.length} categories`);

  // 3. Products
  const insertedProducts = await db
    .insert(schema.products)
    .values([
      // Electronics
      { categoryId: 1, name: "Noise Cancelling Headphones", sku: "ELEC-001", price: "249.99", stockQuantity: 45 },
      { categoryId: 1, name: "Mechanical Gaming Keyboard", sku: "ELEC-002", price: "129.50", stockQuantity: 8 },
      { categoryId: 1, name: "Ultra-Wide Monitor 34-inch", sku: "ELEC-003", price: "499.00", stockQuantity: 14 },
      { categoryId: 1, name: "Wireless Ergonomic Mouse", sku: "ELEC-004", price: "59.99", stockQuantity: 0 },
      // Apparel
      { categoryId: 2, name: "Merino Wool Sweater", sku: "APP-001", price: "89.00", stockQuantity: 30 },
      { categoryId: 2, name: "Running Shoes Pro", sku: "APP-002", price: "135.00", stockQuantity: 12 },
      { categoryId: 2, name: "Waterproof Rain Jacket", sku: "APP-003", price: "110.00", stockQuantity: 5 },
      // Home & Kitchen
      { categoryId: 3, name: "Pour-Over Coffee Maker", sku: "HOME-001", price: "42.00", stockQuantity: 50 },
      { categoryId: 3, name: "Cast Iron Skillet 12-inch", sku: "HOME-002", price: "49.95", stockQuantity: 22 },
      { categoryId: 3, name: "Air Fryer XL", sku: "HOME-003", price: "119.99", stockQuantity: 18 },
      // Books
      { categoryId: 4, name: "Designing Data-Intensive Applications", sku: "BOOK-001", price: "45.00", stockQuantity: 100 },
      { categoryId: 4, name: "The Pragmatic Programmer", sku: "BOOK-002", price: "39.99", stockQuantity: 60 },
      // Sports
      { categoryId: 5, name: "Yoga Mat Extra Thick", sku: "SPT-001", price: "28.50", stockQuantity: 75 },
      { categoryId: 5, name: "Adjustable Dumbbell Set", sku: "SPT-002", price: "299.00", stockQuantity: 4 },
    ])
    .returning();
  console.log(`✓ Inserted ${insertedProducts.length} products`);

  // 4. Customers
  const insertedCustomers = await db
    .insert(schema.customers)
    .values([
      { name: "Alice Johnson", email: "alice@example.com", city: "San Francisco", state: "CA" },
      { name: "Bob Smith", email: "bob@example.com", city: "Los Angeles", state: "CA" },
      { name: "Charlie Davis", email: "charlie@example.com", city: "Austin", state: "TX" },
      { name: "Diana Prince", email: "diana@example.com", city: "Seattle", state: "WA" },
      { name: "Evan Wright", email: "evan@example.com", city: "New York", state: "NY" },
      { name: "Fiona Gallagher", email: "fiona@example.com", city: "Chicago", state: "IL" },
      { name: "George Clark", email: "george@example.com", city: "Miami", state: "FL" },
      { name: "Hannah Abbott", email: "hannah@example.com", city: "Boston", state: "MA" },
      { name: "Ian Malcolm", email: "ian@example.com", city: "Austin", state: "TX" },
      { name: "Julia Roberts", email: "julia@example.com", city: "Denver", state: "CO" },
    ])
    .returning();
  console.log(`✓ Inserted ${insertedCustomers.length} customers`);

  // 5. Orders
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const insertedOrders = await db
    .insert(schema.orders)
    .values([
      { customerId: 1, status: "delivered", totalAmount: "748.99", orderDate: daysAgo(45) },
      { customerId: 1, status: "delivered", totalAmount: "129.50", orderDate: daysAgo(10) },
      { customerId: 1, status: "processing", totalAmount: "45.00", orderDate: daysAgo(1) },
      { customerId: 2, status: "delivered", totalAmount: "224.00", orderDate: daysAgo(20) },
      { customerId: 3, status: "cancelled", totalAmount: "499.00", orderDate: daysAgo(15) },
      { customerId: 3, status: "delivered", totalAmount: "84.99", orderDate: daysAgo(5) },
      { customerId: 4, status: "delivered", totalAmount: "327.50", orderDate: daysAgo(30) },
      { customerId: 5, status: "shipped", totalAmount: "299.00", orderDate: daysAgo(3) },
      { customerId: 6, status: "pending", totalAmount: "89.00", orderDate: daysAgo(0) },
      { customerId: 7, status: "delivered", totalAmount: "161.99", orderDate: daysAgo(60) },
      { customerId: 8, status: "cancelled", totalAmount: "135.00", orderDate: daysAgo(8) },
      { customerId: 9, status: "delivered", totalAmount: "558.99", orderDate: daysAgo(25) },
    ])
    .returning();
  console.log(`✓ Inserted ${insertedOrders.length} orders`);

  // 6. Order Items
  await db.insert(schema.orderItems).values([
    { orderId: 1, productId: 1, quantity: 1, unitPrice: "249.99" },
    { orderId: 1, productId: 3, quantity: 1, unitPrice: "499.00" },
    { orderId: 2, productId: 2, quantity: 1, unitPrice: "129.50" },
    { orderId: 3, productId: 11, quantity: 1, unitPrice: "45.00" },
    { orderId: 4, productId: 6, quantity: 1, unitPrice: "135.00" },
    { orderId: 4, productId: 5, quantity: 1, unitPrice: "89.00" },
    { orderId: 5, productId: 3, quantity: 1, unitPrice: "499.00" },
    { orderId: 6, productId: 12, quantity: 1, unitPrice: "39.99" },
    { orderId: 6, productId: 8, quantity: 1, unitPrice: "42.00" },
    { orderId: 7, productId: 14, quantity: 1, unitPrice: "299.00" },
    { orderId: 7, productId: 13, quantity: 1, unitPrice: "28.50" },
    { orderId: 8, productId: 14, quantity: 1, unitPrice: "299.00" },
    { orderId: 9, productId: 5, quantity: 1, unitPrice: "89.00" },
    { orderId: 10, productId: 8, quantity: 1, unitPrice: "42.00" },
    { orderId: 10, productId: 10, quantity: 1, unitPrice: "119.99" },
    { orderId: 11, productId: 6, quantity: 1, unitPrice: "135.00" },
    { orderId: 12, productId: 1, quantity: 1, unitPrice: "249.99" },
    { orderId: 12, productId: 14, quantity: 1, unitPrice: "299.00" },
  ]);
  console.log("✓ Inserted order items");

  console.log("\n Database seeding complete!");
}

seed()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(() => pool.end());
