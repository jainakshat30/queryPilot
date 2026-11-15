export interface GeneratedSqlResponse {
    sql: string,
    explaination: string,
    tableUsed: string[]
}

export const SCHEMA_CONTEXT = `
-- Categories of products in the store
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);
-- Products available for purchase
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  price NUMERIC(10, 2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Registered customers
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'USA',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Customer orders
-- status can be: 'pending', 'processing', 'shipped', 'delivered', 'cancelled'
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Line items for each order
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL
);
`.trim();


export const SYSTEM_PROMPT = `
You are an expert PostgreSQL data analyst and SQL engineer for QueryPilot.
Your sole job is to translate user natural language questions into safe, efficient, and syntactically correct PostgreSQL 18 queries based on the provided schema.
DATABASE SCHEMA:
${SCHEMA_CONTEXT}
STRICT SQL RULES:
1. DIALECT: Generate only valid PostgreSQL 18 syntax.
2. READ-ONLY: You must ONLY generate "SELECT" queries (Common Table Expressions / "WITH" clauses are permitted).
3. NEVER MUTATE: NEVER generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or GRANT statements.
4. NO WILD-CARD SELECTS: Avoid "SELECT *" unless explicitly requested. Always select specific, meaningful columns.
5. TABLE ALIASES: Always use concise table aliases (e.g. "c" for customers, "o" for orders, "oi" for order_items, "p" for products).
6. EXPLICIT JOINS: Always use explicit JOIN syntax (INNER JOIN, LEFT JOIN) with clear ON conditions. Never use comma joins in the FROM clause.
7. DATE CALCULATIONS: Use PostgreSQL date intervals (e.g. "NOW() - INTERVAL '30 days'", "DATE_TRUNC('month', order_date)").
8. CURRENCY & ROUNDING: When calculating averages or sums of monetary values, round to 2 decimal places using "ROUND(..., 2)".
9. TIE BREAKING: When using "LIMIT", always include a deterministic "ORDER BY" clause.
OUTPUT FORMAT:
You MUST respond with a valid, raw JSON object ONLY.
Do NOT enclose the JSON in markdown code blocks like \`\`\`json. Return ONLY the parseable JSON string:
{
  "sql": "SELECT ...;",
  "explanation": "Brief plain-English explanation of how this query answers the user question.",
  "tablesUsed": ["table1", "table2"]
}
`.trim();

export const FEW_SHOT_EXAMPLES = [
  {
    question: "Who are the top 3 customers by total spending?",
    response: {
      sql: `SELECT c.id, c.name, c.email, ROUND(SUM(o.total_amount), 2) AS total_spent FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.status != 'cancelled' GROUP BY c.id, c.name, c.email ORDER BY total_spent DESC LIMIT 3;`,
      explanation: "Joins customers with their non-cancelled orders, aggregates total amount spent per customer, and returns the top 3 highest spenders.",
      tablesUsed: ["customers", "orders"],
    },
  },
  {
    question: "Which products are currently low on stock or completely out of stock?",
    response: {
      sql: `SELECT p.id, p.name, p.sku, p.stock_quantity, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.stock_quantity < 10 ORDER BY p.stock_quantity ASC;`,
      explanation: "Finds all products with a stock quantity under 10 units, including their category, ordered from lowest stock to highest.",
      tablesUsed: ["products", "categories"],
    },
  },
];
// ============================================================================
// PROMPT BUILDER FUNCTION
// ============================================================================
/**
 * Builds the complete user prompt string to pass to the LLM.
 *
 * @param userQuestion - The question asked by the user in plain English
 * @returns The formatted prompt including few-shot examples and the user's question
 */
export function buildUserPrompt(userQuestion: string): string {
  // 1. Format our few-shot examples into readable text blocks for the AI
  const formattedExamples = FEW_SHOT_EXAMPLES.map(
    (example, index) => `
EXAMPLE ${index + 1}:
Question: "${example.question}"
Response:
${JSON.stringify(example.response, null, 2)}
`
  ).join("\n");
  // 2. Assemble the final prompt with the examples and the user's actual question
  return `
Here are examples of how to answer questions on this database:
${formattedExamples}
Now answer the following question:
Question: "${userQuestion.trim()}"
Remember: Respond ONLY with the raw JSON object. No markdown, no prose.
`.trim();
}