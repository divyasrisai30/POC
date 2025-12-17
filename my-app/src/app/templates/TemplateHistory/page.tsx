/**
 * HistoryItem, ZohoNormalized
 * SToring the data as app1.
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
      console.log(json.items);
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
      console.log("History Json data based on id ", json.items);
      if (!res.ok) {
        const msg = json?.error ?? `Zoho returned ${res.status}`;
        setStatusCache((prev) => ({
          ...prev,
          [zohoId]: { loading: false, data: null, error: String(msg) },
        }));
        return;
      }
      // prefer normalized `json.zoho`, fallback to `json`
      const z = (json?.zoho ?? json) as ZohoNormalized;
      // If the proxy didn't include preview_url, try to read from raw (optional)
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

  // helper: map recipient's status to a step index 0..2 -> Mailed, Viewed, Signed
  function recipientStepIndex(status?: string | null) {
    if (!status) return 0;
    const s = status.toLowerCase();
    if (s.includes("signed")) return 2;
    if (s.includes("view") || s.includes("viewed")) return 1;
    if (s.includes("mailed") || s.includes("sent") || s.includes("unopened"))
      return 0;
    if (s.includes("declin") || s.includes("reject")) return 2; // treat decline as terminal at last step but with special color
    return 0;
  }

  // small circular progress component
  function CircularProgress({
    pct = 0,
    size = 86,
  }: {
    pct?: number;
    size?: number;
  }) {
    const r = size / 2 - 8;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - Math.min(100, Math.max(0, pct || 0)) / 100);
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto"
      >
        <defs>
          <linearGradient id="g" x1="0" x2="1">
            <stop offset="0%" stopColor="#49b6ff" />
            <stop offset="100%" stopColor="#2bb4f6" />
          </linearGradient>
        </defs>
        <g transform={`translate(${size / 2},${size / 2})`}>
          <circle
            r={r}
            cx={0}
            cy={0}
            fill="none"
            stroke="#eef6fb"
            strokeWidth={8}
          />
          <circle
            r={r}
            cx={0}
            cy={0}
            fill="none"
            stroke="url(#g)"
            strokeWidth={8}
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90)"
          />
          <text
            x="0"
            y="6"
            textAnchor="middle"
            fontSize={18}
            fill="#2aa6e6"
            fontWeight={700}
          >
            {Math.round(pct ?? 0)}%
          </text>
        </g>
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
          <div key={it.id} className="border rounded p-4 m-4 ">
            {/* top row: thumbnail, meta, progress */}
            <div className="flex items-start gap-6">
              {/* thumbnail */}
              {/* <div style={{ width: 100 }}> */}
              {/* <div className="w-24 h-32 bg-gray-100 rounded overflow-hidden flex items-center justify-center"> */}
              {/* {live?.preview_url ? (
                    <img
                      src={live.preview_url}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-xs text-gray-400 p-2">No preview</div>
                  )} */}
              {/* </div> */}
              {/* {zohoId && (
                <a
                  className="mt-2 inline-block bg-green-600 text-white px-3 py-1 rounded text-sm"
                  href={`/api/zoho/requests/${encodeURIComponent(
                    zohoId
                  )}/download`} // optional: implement download route
                >
                  View
                </a>
              )} */}
              {/* </div> */}

              {/* meta */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold">
                  {it.template_name ?? it.template_id}
                </h3>
                <div className="text-sm text-gray-600">
                  Owned by {it.app_id ?? appId}
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  {it.zoho_response?.description ?? "No description given"}
                </div>
                <div className="text-sm text-gray-600 mt-3">
                  Submitted on{" "}
                  {live?.timestamps?.created
                    ? new Date(live.timestamps.created).toLocaleString()
                    : new Date(it.timestamp).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">
                  Last updated on{" "}
                  {live?.timestamps?.action
                    ? new Date(live.timestamps.action).toLocaleString()
                    : live?.timestamps?.modified
                    ? new Date(live.timestamps.modified).toLocaleString()
                    : new Date(it.timestamp).toLocaleString()}
                </div>
              </div>

              {/* circular progress */}
              <div style={{ width: 110 }}>
                <CircularProgress
                  pct={
                    live?.signPercentage ??
                    (Number(it.zoho_status && it.zoho_status.includes("%"))
                      ? parseInt(it.zoho_status as any, 10)
                      : 0)
                  }
                  size={110}
                />
              </div>
            </div>

            {/* Recipient status header */}
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-3">Recipient status</h4>

              {/* recipients list: if cached data not present, show a "Load details" button */}
              {!zohoId && (
                <div className="text-sm text-gray-500">
                  No Zoho document id available for this entry.
                </div>
              )}

              {zohoId && (!cache || cache.loading) && (
                <div className="text-sm text-gray-600">
                  <button
                    className="px-3 py-1 border rounded"
                    onClick={() => fetchStatusForId(zohoId)}
                  >
                    Load status
                  </button>
                  {cache?.loading && (
                    <span className="ml-2 text-xs text-gray-500">Loading…</span>
                  )}
                  {cache?.error && (
                    <div className="text-xs text-red-600 mt-2">
                      {cache.error}
                    </div>
                  )}
                </div>
              )}

              {zohoId &&
                cache?.data &&
                Array.isArray(cache.data.recipients) && (
                  <div className="space-y-2 mt-2">
                    {cache.data.recipients
                      .slice()
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                      .map((r, idx) => {
                        const step = recipientStepIndex(r.status);
                        const isDeclined =
                          String(r.status ?? "")
                            .toLowerCase()
                            .includes("declin") ||
                          String(r.status ?? "")
                            .toLowerCase()
                            .includes("reject");
                        // progress percentage across 3 steps
                        const progressPct = (step / 2) * 100;
                        return (
                          <div
                            key={r.id ?? idx}
                            className="p-3 border rounded bg-white flex items-center gap-4"
                          >
                            <div className="w-8 text-center font-semibold text-gray-700">
                              {r.order ?? idx + 1}
                            </div>

                            <div className="flex-1">
                              <div className="font-medium">
                                {r.name ?? r.email ?? `Recipient ${idx + 1}`}
                              </div>
                              <div className="text-xs text-gray-500">
                                {r.email ?? ""}
                              </div>
                            </div>

                            {/* timeline */}
                            <div
                              style={{ width: 420 }}
                              className="flex flex-col items-end"
                            >
                              <div className="w-full">
                                <div className="relative h-3 bg-gray-200 rounded-full">
                                  {/* filled bar */}
                                  <div
                                    style={{ width: `${progressPct}%` }}
                                    className={`absolute left-0 top-0 h-3 rounded-full ${
                                      isDeclined ? "bg-red-400" : "bg-green-600"
                                    }`}
                                  />
                                </div>

                                {/* step dots & labels */}
                                <div className="flex justify-between mt-2 text-xs text-gray-600">
                                  <div className="flex flex-col items-center">
                                    <div
                                      className={`w-5 h-5 rounded-full ${
                                        step >= 0
                                          ? isDeclined
                                            ? "bg-red-600"
                                            : step >= 0
                                            ? "bg-green-600"
                                            : "bg-white border"
                                          : "bg-white border"
                                      }`}
                                    ></div>
                                    <div className="mt-1">Mailed</div>
                                  </div>

                                  <div className="flex flex-col items-center">
                                    <div
                                      className={`w-5 h-5 rounded-full ${
                                        step >= 1
                                          ? isDeclined
                                            ? "bg-red-600"
                                            : "bg-green-600"
                                          : "bg-white border"
                                      }`}
                                    ></div>
                                    <div className="mt-1">Viewed</div>
                                  </div>

                                  <div className="flex flex-col items-center">
                                    <div
                                      className={`w-5 h-5 rounded-full ${
                                        step >= 2
                                          ? isDeclined
                                            ? "bg-red-600"
                                            : "bg-green-600"
                                          : "bg-white border"
                                      }`}
                                    ></div>
                                    <div className="mt-1">Signed</div>
                                  </div>
                                </div>

                                {r.status?.toLowerCase().includes("signed") && (
                                  <div className="text-xs text-green-600 mt-1">
                                    Signed successfully
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
            </div>
            {zohoId && live?.overallStatus?.toLowerCase() === "completed" && (
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

            {/* Raw / debug */}
            {/* <details className="mt-4">
              <summary className="text-sm text-gray-600 cursor-pointer">Payload / raw response</summary>
              <pre className="mt-2 max-h-56 overflow-auto text-xs bg-gray-50 p-2 rounded">
                {JSON.stringify(cache?.data?.raw ?? cache?.data ?? it.request_payload ?? it.zoho_response ?? {}, null, 2)}
              </pre>
            </details> */}
          </div>
        );
      })}
    </div>
  );
}
