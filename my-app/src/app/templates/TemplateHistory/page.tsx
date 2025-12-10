// components/TemplateHistory.tsx
"use client";
import React, { useEffect, useState } from "react";

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

export default function TemplateHistory({
  templateId,
  appId,
}: {
  templateId?: string;
  appId?: string;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const q = new URLSearchParams();
        if (templateId) q.set("template_id", templateId);
        if (appId) q.set("app_id", appId);
        const res = await fetch(`/api/zoho/history?${q.toString()}`);
        if (!res.ok) throw new Error(`History fetch failed (${res.status})`);
        const json = await res.json();
        setItems(json.items ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [templateId, appId]);

  if (loading) return <div>Loading history…</div>;
  if (err) return <div className="text-red-600">Error: {err}</div>;
  if (!items.length) return <div>No history yet.</div>;

  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.id} className="border p-3 rounded">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium">
                {it.template_name ?? it.template_id}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(it.timestamp).toLocaleString()}
              </div>
            </div>
            <div className="text-sm text-right">
              <div>Zoho request: {it.zoho_request_id ?? "—"}</div>
              <div>Status: {it.zoho_status ?? "—"}</div>
            </div>
          </div>

          <details className="mt-2">
            <summary className="cursor-pointer text-blue-600">
              Payload / raw response
            </summary>
            <pre className="mt-2 max-h-56 overflow-auto text-xs bg-gray-50 p-2 rounded">
              {JSON.stringify(
                it.request_payload ?? it.zoho_response ?? {},
                null,
                2
              )}
            </pre>
          </details>
        </div>
      ))}
    </div>
  );
}
