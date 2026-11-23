"use client";

// ============================================================================
// IMPORTS
// ============================================================================

// React hooks for state and lifecycle management
import { useEffect, useState } from "react";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Shape of the database execution result returned from /api/query
 */
interface QueryResultData {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
}

/**
 * Shape of the full response returned from POST /api/query
 */
interface QueryResponse {
  ok: boolean;
  sql: string;
  explanation: string;
  tablesUsed: string[];
  result: QueryResultData;
}

/**
 * Shape of an item fetched from GET /api/history
 */
interface HistoryItem {
  id: number;
  question: string;
  sql: string;
  explanation: string;
  rowCount: number;
  executionTimeMs: number;
  createdAt: string;
}

// ============================================================================
// PRESET SUGGESTIONS
// ============================================================================

// Sample questions users can click to immediately test the Text-to-SQL engine
const SAMPLE_QUESTIONS = [
  "Who are the top 3 customers by total spending?",
  "Which products are low on stock (under 10 units)?",
  "Show me the most recent orders with customer names",
  "What is our total revenue from non-cancelled orders?",
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Home() {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------

  // Current text in the input box
  const [question, setQuestion] = useState("");

  // Loading state while waiting for the backend API to respond
  const [isLoading, setIsLoading] = useState(false);

  // Error message string if a query or network call fails
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The active query response (SQL, explanation, table rows, execution time)
  const [queryData, setQueryData] = useState<QueryResponse | null>(null);

  // List of recent questions retrieved from the database
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // State to show a brief "Copied!" feedback when copying SQL
  const [copied, setCopied] = useState(false);

  // --------------------------------------------------------------------------
  // DATA FETCHING: RECENT HISTORY
  // --------------------------------------------------------------------------

  // Helper function to fetch recent query history from GET /api/history
  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history");
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setHistory(json.data);
      }
    } catch (err) {
      console.error("Failed to load query history:", err);
    }
  };

  // Run once when the component mounts in the browser
  useEffect(() => {
    fetchHistory();
  }, []);

  // --------------------------------------------------------------------------
  // SUBMISSION HANDLER
  // --------------------------------------------------------------------------

  const handleAsk = async (textToRun?: string) => {
    const queryText = (textToRun || question).trim();
    if (!queryText || isLoading) return;

    // Reset previous states
    setIsLoading(true);
    setErrorMessage(null);
    setQueryData(null);

    try {
      // Send the question to our all-in-one /api/query route
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: queryText }),
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Failed to process question");
      }

      // Store the result in state
      setQueryData(json);

      // Refresh the query history sidebar
      fetchHistory();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to copy generated SQL to clipboard
  const handleCopySql = () => {
    if (!queryData?.sql) return;
    navigator.clipboard.writeText(queryData.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --------------------------------------------------------------------------
  // RENDER UI
  // --------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* 1. TOP NAVBAR */}
      <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-base shadow-sm">
            QP
          </div>
          <span className="text-lg font-bold tracking-tight">QueryPilot</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            PostgreSQL 18
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
            Read-Only Guardrails
          </span>
        </div>
      </header>

      {/* 2. MAIN LAYOUT: TWO COLUMNS */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* LEFT COLUMN: QUERY WORKBENCH & RESULTS (3 Cols) */}
        <main className="lg:col-span-3 flex flex-col gap-6">
          {/* QUESTION INPUT BOX */}
          <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
            <label
              htmlFor="question-input"
              className="block text-sm font-medium text-neutral-300 mb-2"
            >
              Ask a question about e-commerce sales in natural English:
            </label>
            <div className="flex gap-2">
              <input
                id="question-input"
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                placeholder="e.g. Which customers spent over $500 last month?"
                disabled={isLoading}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition placeholder:text-neutral-600 text-neutral-100"
              />
              <button
                onClick={() => handleAsk()}
                disabled={isLoading || !question.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm px-5 py-2.5 rounded-lg transition flex items-center gap-2 cursor-pointer shadow-sm"
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Querying...
                  </>
                ) : (
                  "Ask Query"
                )}
              </button>
            </div>

            {/* QUICK SAMPLE PILLS */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-neutral-500">Quick ideas:</span>
              {SAMPLE_QUESTIONS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuestion(sample);
                    handleAsk(sample);
                  }}
                  className="text-xs bg-neutral-800/70 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 rounded-md px-2.5 py-1 transition cursor-pointer"
                >
                  {sample}
                </button>
              ))}
            </div>
          </section>

          {/* ERROR ALERT */}
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-start gap-2">
              <span className="font-semibold">Error:</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ACTIVE QUERY DISPLAY */}
          {queryData && (
            <div className="flex flex-col gap-6">
              {/* EXPLANATION & METRICS BADGES */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-neutral-200">
                    Plain-English Explanation
                  </h3>
                  <div className="flex gap-2 text-xs">
                    <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded border border-neutral-700/50">
                      {queryData.result.executionTimeMs} ms
                    </span>
                    <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded border border-neutral-700/50">
                      {queryData.result.rowCount} rows
                    </span>
                  </div>
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  {queryData.explanation}
                </p>
                {queryData.tablesUsed && queryData.tablesUsed.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Tables queried:</span>
                    {queryData.tablesUsed.map((tbl, i) => (
                      <span
                        key={i}
                        className="text-xs font-mono bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800 text-indigo-400"
                      >
                        {tbl}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* GENERATED SQL CODE VIEWER */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-neutral-950/90 px-4 py-2.5 border-b border-neutral-800 flex items-center justify-between">
                  <span className="text-xs font-mono text-neutral-400">
                    Generated PostgreSQL Query
                  </span>
                  <button
                    onClick={handleCopySql}
                    className="text-xs bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 rounded text-neutral-300 transition cursor-pointer"
                  >
                    {copied ? "✓ Copied!" : "Copy SQL"}
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-indigo-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {queryData.sql}
                </pre>
              </div>

              {/* INTERACTIVE DATA TABLE */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-neutral-800 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-neutral-200">
                    Query Results
                  </h3>
                  <span className="text-xs text-neutral-500">
                    {queryData.result.rowCount} records returned
                  </span>
                </div>

                {queryData.result.rows.length === 0 ? (
                  <div className="p-8 text-center text-sm text-neutral-500">
                    Query executed successfully, but returned 0 records.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-neutral-950 text-neutral-400 sticky top-0 text-xs uppercase tracking-wider">
                        <tr>
                          {queryData.result.columns.map((col, idx) => (
                            <th
                              key={idx}
                              className="px-4 py-3 font-semibold border-b border-neutral-800"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/50">
                        {queryData.result.rows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className="hover:bg-neutral-800/40 transition"
                          >
                            {queryData.result.columns.map((col, cIdx) => (
                              <td
                                key={cIdx}
                                className="px-4 py-2.5 text-neutral-300 whitespace-nowrap text-xs font-mono"
                              >
                                {row[col] !== null && row[col] !== undefined
                                  ? String(row[col])
                                  : "NULL"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* RIGHT COLUMN: RECENT QUESTIONS HISTORY (1 Col) */}
        <aside className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-200 mb-3 flex items-center justify-between">
              Recent Queries
              <span className="text-xs font-normal text-neutral-500">
                ({history.length})
              </span>
            </h2>

            {history.length === 0 ? (
              <p className="text-xs text-neutral-500 py-4 text-center">
                No questions recorded yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setQuestion(item.question);
                      handleAsk(item.question);
                    }}
                    className="text-left p-3 rounded-lg bg-neutral-950/60 hover:bg-neutral-800/60 border border-neutral-800/80 transition group cursor-pointer"
                  >
                    <p className="text-xs text-neutral-300 font-medium group-hover:text-indigo-400 line-clamp-2">
                      {item.question}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                      <span>{item.rowCount} rows</span>
                      <span>{item.executionTimeMs}ms</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
