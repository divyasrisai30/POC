/**
 * HistoryItem, ZohoNormalized
 * Storing the data as app1.
 *
 */
"use client";
import React, { useCallback, useEffect, useState } from "react";

type HistoryItem = {
  id: string;
  app_id: string;
  template_id: string;
  template_name?: string | null;
  timestamp: string;
  zoho_request_id?: string | null;
  zoho_status?: string | null;
  request_payload?: any;
  zoho_response?: any;
};

type ZohoNormalized = {
  overallStatus?: string | null;
  signPercentage?: number | null;
  timestamps?: {
    created?: number | null;
    modified?: number | null;
    action?: number | null;
  } | null;
  recipients?: Array<{
    id?: string;
    name?: string;
    email?: string;
    status?: string;
    order?: number;
    fields?: any[];
  }>;
  preview_url?: string | null;
  raw?: any;
};

export default function TemplateHistory({
  appId = "app1",
}: {
  appId?: string;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // cache per-doc status
  const [statusCache, setStatusCache] = useState<
    Record<
      string,
      { loading: boolean; data?: ZohoNormalized | null; error?: string | null }
    >
  >({});

  //Fetching data
  const loadHistory = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams();
      q.set("app_id", appId);
      q.set("limit", "200");
      const res = await fetch(`/api/zoho/history?${q.toString()}`);
      if (!res.ok) throw new Error(`History fetch failed (${res.status})`);
      const json = await res.json();
      setItems((json.items ?? []) as HistoryItem[]);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // fetch & normalize Zoho single-request response for a document id
  async function fetchStatusForId(zohoId?: string | null) {
    if (!zohoId) return;
    const existing = statusCache[zohoId];
    if (existing?.loading) return;

    setStatusCache((prev) => ({
      ...prev,
      [zohoId]: {
        loading: true,
        data: prev[zohoId]?.data ?? null,
        error: null,
      },
    }));

    try {
      const res = await fetch(
        `/api/zoho/requests/${encodeURIComponent(zohoId)}`
      );
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.error ?? `Zoho returned ${res.status}`;
        setStatusCache((prev) => ({
          ...prev,
          [zohoId]: { loading: false, data: null, error: String(msg) },
        }));
        return;
      }

      const z = (json?.zoho ?? json) as ZohoNormalized;

      if (!z.preview_url && z.raw) {
        z.preview_url =
          z.raw?.requests?.preview_url ?? z.raw?.preview_url ?? null;
      }

      setStatusCache((prev) => ({
        ...prev,
        [zohoId]: { loading: false, data: z, error: null },
      }));
    } catch (err: any) {
      setStatusCache((prev) => ({
        ...prev,
        [zohoId]: {
          loading: false,
          data: null,
          error: String(err?.message ?? "fetch error"),
        },
      }));
    }
  }

  // helper: map recipient's status to a step index 0..2
  function recipientStepIndex(status?: string | null) {
    if (!status) return 0;
    const s = status.toLowerCase();
    if (s.includes("signed")) return 2;
    if (s.includes("view")) return 1;
    if (s.includes("sent") || s.includes("mailed")) return 0;
    if (s.includes("declin") || s.includes("reject")) return 2;
    return 0;
  }

  function CircularProgress({ pct = 0, size = 86 }: any) {
    const r = size / 2 - 8;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - Math.min(100, Math.max(0, pct)) / 100);

    return (
      <svg width={size} height={size}>
        <circle r={r} cx={size / 2} cy={size / 2} stroke="#eef6fb" strokeWidth={8} fill="none" />
        <circle
          r={r}
          cx={size / 2}
          cy={size / 2}
          stroke="#22c55e"
          strokeWidth={8}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize={18}>
          {Math.round(pct)}%
        </text>
      </svg>
    );
  }

  if (loading) return <div>Loading history…</div>;
  if (err) return <div className="text-red-600">Error: {err}</div>;
  if (!items.length) return <div>No history yet.</div>;

  return (
    <div className="space-y-4">
      {items.map((it) => {
        const zohoId = it.zoho_request_id ?? null;
        const cache = zohoId ? statusCache[zohoId] : undefined;
        const live = cache?.data ?? null;

        return (
          <div key={it.id} className="border rounded p-4 m-4">
            {/* EXISTING UI — UNCHANGED */}

            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-3">Recipient status</h4>

              {zohoId && (!cache || cache.loading) && (
                <button
                  className="px-3 py-1 border rounded"
                  onClick={() => fetchStatusForId(zohoId)}
                >
                  Load status
                </button>
              )}

              {zohoId &&
                cache?.data &&
                Array.isArray(cache.data.recipients) && (
                  <div className="space-y-2 mt-2">
                    {cache.data.recipients.map((r, idx) => (
                      <div
                        key={r.id ?? idx}
                        className="p-3 border rounded bg-white"
                      >
                        <div className="font-medium">
                          {r.name ?? r.email}
                        </div>
                        <div className="text-xs text-gray-500">
                          {r.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              {/* ==================== ✅ ADDED (UI SAFE) ==================== */}
              {zohoId &&
                live?.overallStatus?.toLowerCase() === "completed" && (
                  <div className="mt-4 flex gap-3">
                    <a
                      href={`/api/zoho/requests/${encodeURIComponent(
                        zohoId
                      )}/documents`}
                      className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                    >
                      View Signed Document
                    </a>

                    <a
                      href={`/api/zoho/requests/${encodeURIComponent(
                        zohoId
                      )}/certificate`}
                      className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                    >
                      View Certificate
                    </a>
                  </div>
                )}
              {/* ==================== END ADDED ==================== */}
            </div>
          </div>
        );
      })}
    </div>
  );
}
