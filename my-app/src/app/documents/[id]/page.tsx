'use client';

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ZohoAction = {
  recipient_name?: string;
  recipient_email?: string;
  action_status?: string;
};

type ZohoRequest = {
  request_id: string;
  request_status: string;
  actions?: ZohoAction[];
};

const FINAL_STATUSES = ["COMPLETED", "DECLINED", "RECALLED", "EXPIRED"];

export default function RequestStatusPage() {
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<ZohoRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    let timer: NodeJS.Timeout;

    async function fetchStatus() {
      try {
        const res = await fetch(`/api/zoho/status?id=${id}`);
        const json = await res.json();

        if (!res.ok) throw new Error(json.error || "Failed to fetch status");

        const req: ZohoRequest = json.requests || json.request || json;
        if (!cancelled) {
          setData(req);
          setLoading(false);

          if (!FINAL_STATUSES.includes(req.request_status)) {
            // keep polling
            timer = setTimeout(fetchStatus, 5000); // 5 seconds
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "Unknown error");
          setLoading(false);
        }
      }
    }

    fetchStatus();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  if (loading) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Signature Request Status</h1>
        <p>Loading status...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Signature Request Status</h1>
        <p className="text-red-600">Error: {error}</p>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Signature Request Status</h1>
        <p className="text-sm text-gray-600 mt-1">Request ID: {data.request_id}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Overall Status:</span>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            data.request_status === "COMPLETED"
              ? "bg-green-100 text-green-800"
              : data.request_status === "SENT"
              ? "bg-blue-100 text-blue-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {data.request_status}
        </span>
      </div>

      {data.actions && (
        <div>
          <h2 className="font-semibold mb-2">Recipients</h2>
          <div className="border rounded-lg divide-y">
            {data.actions.map((a, i) => (
              <div key={i} className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{a.recipient_name || "Recipient"}</div>
                  <div className="text-xs text-gray-600">{a.recipient_email}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                  {a.action_status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!FINAL_STATUSES.includes(data.request_status) && (
        <p className="text-xs text-gray-500">
          This page refreshes status every 5 seconds until the request is completed.
        </p>
      )}
    </main>
  );
}
