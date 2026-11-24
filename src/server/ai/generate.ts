import {z} from "zod"
import {parseEnv} from "../env"

import {
  type GeneratedSqlResponse,
  SYSTEM_PROMPT,
  buildUserPrompt,
} from "./prompts.ts";

const GeneratedSqlResponseSchema = z.object({
    sql: z.string().min(1, "Generated SQL cannot be empty"),
    explanation: z.string().min(1, "Explanation cannot be empty"),
    tablesUsed: z.array(z.string()).default([])
})

export function cleanAndParseJsonResponse(rawText: string): GeneratedSqlResponse {

    let cleaned = rawText.trim()
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let parsedJson : unknown; //why unkown? as JSON.parse can return literally anything, then why not any? : ts would completely turn off type safety

    try{
        parsedJson = JSON.parse(cleaned); //JSON.parse helps in parsing the raw text into json object
    }catch(err){
        throw new Error(
            `Failed to parse LLM response as JSON. Raw response was:\n${rawText}`
        )
    }

    return GeneratedSqlResponseSchema.parse(parsedJson)
}

function generateFakeSql(question: string): GeneratedSqlResponse {
  const q = question.toLowerCase();
  // Keyword Match 1: Customer queries
  if (q.includes("customer") || q.includes("spender") || q.includes("buyer")) {
    return {
      sql: `SELECT c.id, c.name, c.email, ROUND(SUM(o.total_amount), 2) AS total_spent FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.status != 'cancelled' GROUP BY c.id, c.name, c.email ORDER BY total_spent DESC LIMIT 5;`,
      explanation:
        "Calculates the total amount spent by each customer across non-cancelled orders and returns the top 5 spenders.",
      tablesUsed: ["customers", "orders"],
    };
  }
  // Keyword Match 2: Inventory / Product stock queries
  if (q.includes("stock") || q.includes("product") || q.includes("inventory")) {
    return {
      sql: `SELECT p.id, p.name, p.sku, p.price, p.stock_quantity, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.stock_quantity < 10 ORDER BY p.stock_quantity ASC;`,
      explanation:
        "Retrieves all products that have low stock (less than 10 units) along with their category name.",
      tablesUsed: ["products", "categories"],
    };
  }
  // Keyword Match 3: Order queries
  if (q.includes("order") || q.includes("revenue") || q.includes("sale")) {
    return {
      sql: `SELECT o.id, o.status, o.total_amount, o.order_date, c.name AS customer_name FROM orders o JOIN customers c ON c.id = o.customer_id ORDER BY o.order_date DESC LIMIT 10;`,
      explanation:
        "Returns the 10 most recent orders along with the customer who placed each order.",
      tablesUsed: ["orders", "customers"],
    };
  }
  // Default fallback: general product list
  return {
    sql: `SELECT p.id, p.name, p.price, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id ORDER BY p.price DESC LIMIT 5;`,
    explanation:
      "Returns the top 5 most expensive products in the store and their categories.",
    tablesUsed: ["products", "categories"],
  };
}

async function generateAnthropicSql(
  question: string,
  apiKey: string
): Promise<GeneratedSqlResponse> {
  // 1. Build the user prompt containing few-shot examples + the question
  const userContent = buildUserPrompt(question);
  // 2. Call Anthropic API with native fetch (no external SDK required!)
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      // Use Claude 3.5 Haiku (very fast, cheap, and excellent at SQL)
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Anthropic API request failed with status ${response.status}: ${errorBody}`
    );
  }
  // 3. Extract text content from Anthropic response structure
  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const rawText = data.content?.[0]?.text;
  if (!rawText) {
    throw new Error("Anthropic API returned an empty response content");
  }
  // 4. Clean, parse, and validate the JSON
  return cleanAndParseJsonResponse(rawText);
}

// ============================================================================
// REAL GOOGLE GEMINI LLM CALLER (Free Tier Supported)
// ============================================================================

/**
 * Calls the Google Gemini API using native Node.js fetch.
 * Uses Gemini 2.0 Flash (free tier on Google AI Studio).
 */
async function generateGeminiSql(
  question: string,
  apiKey: string
): Promise<GeneratedSqlResponse> {
  const userContent = buildUserPrompt(question);

  // Gemini 3.8 Flash is Google's recommended active model
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userContent }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Gemini API request failed with status ${response.status}: ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Gemini API returned an empty response content");
  }

  return cleanAndParseJsonResponse(rawText);
}

export async function generateSql(question: string): Promise<GeneratedSqlResponse> {
  const env = parseEnv();
  // If configured for the fake provider (default), use deterministic offline generator
  if (env.llm.provider === "fake") {
    return generateFakeSql(question);
  }
  // If configured for Gemini, call Google Gemini
  if (env.llm.provider === "gemini") {
    if (!env.llm.apiKey) {
      throw new Error(
        "GEMINI_API_KEY is required in .env when LLM_PROVIDER is 'gemini'"
      );
    }
    return generateGeminiSql(question, env.llm.apiKey);
  }
  // If configured for Anthropic, call Claude
  if (env.llm.provider === "anthropic") {
    if (!env.llm.apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is required in .env when LLM_PROVIDER is 'anthropic'"
      );
    }
    return generateAnthropicSql(question, env.llm.apiKey);
  }
  throw new Error(`Unsupported LLM provider: ${env.llm.provider}`);
}