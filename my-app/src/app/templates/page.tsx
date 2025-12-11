"use client";

import React, { useEffect, useState } from "react";
import {
  Template,
  TemplateField,
  ActionField,
  TemplateAction,
  TemplateDetails,
} from "../../types";
import TemplateHistory from "./TemplateHistory/page";
import Link from "next/link";

async function fetchTemplateDetails(
  templateId: string,
  templatesList: Template[],
  signal?: AbortSignal
): Promise<TemplateDetails> {
  const res = await fetch(`/api/zoho/templates/${templateId}`, { signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to load template details: ${res.status} ${text}`);
  }
  const data = await res.json();
  const t = data.templates ?? {};

  // document_fields may be nested per-document; we flatten to a list of fields
  const document_fields: TemplateField[] = (t.document_fields ?? [])
    .flatMap((doc: any) => (doc.fields ?? []).map((f: any) => f))
    .map((f: any) => ({
      field_id: f.field_id ?? f.id ?? f.name,
      field_label: f.field_label ?? f.label ?? f.name,
      field_type: f.field_type ?? f.type ?? f.field_category ?? "text",
      is_mandatory: !!f.is_mandatory,
      default_value: f.default_value ?? f.value ?? "",
      page_no: f.page_no,
      x_coord: f.x_coord,
      y_coord: f.y_coord,
    }));

  const actions: TemplateAction[] = (t.actions ?? []).map((a: any) => ({
    action_id: a.action_id,
    action_type: a.action_type ?? "SIGN",
    role: a.role,
    recipient_name: a.recipient_name ?? "",
    recipient_email: a.recipient_email ?? "",
    signing_order: a.signing_order ?? 0,
    verify_recipient: !!a.verify_recipient,
    verification_type: a.verification_type ?? undefined,
    delivery_mode: a.delivery_mode ?? "EMAIL",
    fields: (a.fields ?? []).map((f: any) => ({
      field_id: f.field_id,
      field_category: f.field_category,
      field_label: f.field_label,
      page_no: f.page_no,
      is_mandatory: !!f.is_mandatory,
      date_format: f.date_format,
      time_zone: f.time_zone,
      time_zone_offset: f.time_zone_offset,
    })),
  }));

  return {
    template_id: t.template_id ?? templateId,
    template_name:
      t.template_name ??
      templatesList.find((x) => x.template_id === templateId)?.template_name ??
      "",
    actions,
    document_fields,
    owner_email: t.owner_email,
    created_time: t.created_time,
  };
}

function useTemplateDetails(selectedTemplateId: string, templates: Template[]) {
  const [details, setDetails] = useState<TemplateDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTemplateId) {
      setDetails(null);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const normalized = await fetchTemplateDetails(
          selectedTemplateId,
          templates,
          controller.signal
        );
        if (!cancelled) setDetails(normalized);
      } catch (e: any) {
        if (!controller.signal.aborted && !cancelled)
          setError(e.message ?? "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedTemplateId, templates]);

  return { details, setDetails, loading, error };
}

export default function TemplatePage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // details hook
  const {
    details,
    setDetails: setDetailsFromHook,
    loading: detailsLoading,
    error: detailsError,
  } = useTemplateDetails(selectedTemplateId, templates);

  const [editable, setEditable] = useState<TemplateDetails | null>(null);

  // load templates list once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/zoho/templates");
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setTemplates(data.templates ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed loading templates");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // sync editable when details changes
  useEffect(() => {
    if (details) {
      // deep clone to avoid mutating hook state
      setEditable(JSON.parse(JSON.stringify(details)));
    } else {
      setEditable(null);
    }
  }, [details]);

  // helpers to update recipient fields
  function updateRecipient(actionId: string, patch: Partial<TemplateAction>) {
    setEditable((d) => {
      if (!d) return d;
      return {
        ...d,
        actions: d.actions.map((a) =>
          a.action_id === actionId ? { ...a, ...patch } : a
        ),
      };
    });
  }

  // simple email validation
  function isValidEmail(email?: string) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Build Zoho createdocument payload and send
  async function handleSend() {
    console.log("==========HAndle Send========");
    if (!editable) return;
    // basic validation: all actions require a valid email
    const missing = editable.actions.find(
      (a) => !isValidEmail(a.recipient_email)
    );
    if (missing) {
      alert("Please provide valid emails for all recipients before sending.");
      return;
    }

    // Build field_data: we don't prefill in this example, but structure included
    const field_data = {
      field_text_data: {},
      field_boolean_data: {},
      field_date_data: {},
    };

    // actions payload according to Zoho sample
    const actionsPayload = editable.actions.map((a) => ({
      action_id: a.action_id,
      action_type: a.action_type,
      recipient_name: a.recipient_name,
      role: a.role ?? "",
      recipient_email: a.recipient_email,
      recipient_phonenumber: "",
      recipient_countrycode: "",
      private_notes: "",
      verify_recipient: !!a.verify_recipient,
      verification_type: a.verification_type ?? "EMAIL",
    }));

    console.log(actionsPayload);

    const payload = {
      templates: {
        // request_name: editable.template_name ?? "Created from template",
        field_data,
        actions: actionsPayload,
        notes: "",
      },
    };

    try {
      console.log(
        "=== Zoho payload (object) ===",
        JSON.stringify(payload, null, 2)
      );
      const encodedBody = `data=${encodeURIComponent(
        JSON.stringify(payload)
      )}&is_quicksend=true`;
      console.log(
        "=== Zoho encoded body (first 300 chars) ===",
        encodedBody.slice(0, 300)
      );
      const body = `data=${encodeURIComponent(
        JSON.stringify(payload)
      )}&is_quicksend=true`;
      const res = await fetch(
        `/api/zoho/templates/${editable.template_id}/createdocument`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editable }),
        }
      );
      console.log("Post call to create decument", res);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Send failed: ${res.status} ${text}`);
      }
      const result = await res.json().catch(() => ({}));
      console.log("Sent, response:", result);
      alert("Document created and sent (quicksend). Check Zoho dashboard.");
    } catch (e: any) {
      console.error("send error", e);
      alert("Failed to send document: " + (e?.message ?? "Unknown error"));
    }
  }

  if (loading) return <div>Loading templates…</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">
        Zoho Available Sign Templates
      </h1>

      {templates.length === 0 && <div>No templates found.</div>}
      <ul className="space-y-2">
        {templates.map((t) => (
          <li key={t.template_id} className="border p-2 rounded">
            <div className="font-medium">{t.template_name}</div>
            <div className="text-xs text-gray-500">ID: {t.template_id}</div>
          </li>
        ))}
      </ul>

      <div>
        <h2 className="text-lg font-semibold mt-6">
          Choose a template and send
        </h2>
        <label htmlFor="template-select" className="block mb-1">
          Select a template
        </label>
        <select
          id="template-select"
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          <option value="" disabled>
            {templates.length === 0
              ? "No templates found"
              : "-- select a template --"}
          </option>
          {templates.map((template) => (
            <option key={template.template_id} value={template.template_id}>
              {template.template_name} — {template.template_id}
            </option>
          ))}
        </select>
      </div>

      <div>
        {detailsLoading && <div>Loading template details…</div>}
        {detailsError && (
          <div className="text-red-600">Error: {detailsError}</div>
        )}
        {editable && (
          <div className="border p-3 rounded mt-2 space-y-4">
            <div className="font-medium">{editable.template_name}</div>
            <div className="text-xs text-gray-500">
              ID: {editable.template_id}
            </div>

            <div>
              <div className="text-sm font-medium">Actions / Recipients</div>
              {editable.actions.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {editable.actions
                    .slice()
                    .sort(
                      (a, b) => (a.signing_order ?? 0) - (b.signing_order ?? 0)
                    )
                    .map((a) => (
                      <li key={a.action_id} className="p-3 border rounded">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 rounded-md font-semibold">
                            {a.signing_order ?? 0}
                          </div>

                          <div className="px-3 py-2 bg-gray-100 rounded text-sm text-gray-700">
                            {a.role ?? "User"}
                          </div>

                          <input
                            type="email"
                            placeholder="Email"
                            className="border px-3 py-2 rounded w-56"
                            value={a.recipient_email}
                            onChange={(e) =>
                              updateRecipient(a.action_id, {
                                recipient_email: e.target.value,
                              })
                            }
                          />

                          <input
                            type="text"
                            placeholder="Name"
                            className="border px-3 py-2 rounded w-56"
                            value={a.recipient_name}
                            onChange={(e) =>
                              updateRecipient(a.action_id, {
                                recipient_name: e.target.value,
                              })
                            }
                          />

                          <select
                            className="border px-3 py-2 rounded"
                            value={a.delivery_mode ?? "EMAIL"}
                            onChange={(e) =>
                              updateRecipient(a.action_id, {
                                delivery_mode: e.target.value,
                              })
                            }
                          >
                            <option value="EMAIL">Email</option>
                            <option value="SMS">SMS</option>
                          </select>

                          <div className="ml-auto flex gap-2">
                            <button
                              className="border px-4 py-2 rounded"
                              onClick={() => {
                                // toggle verify_recipient
                                updateRecipient(a.action_id, {
                                  verify_recipient: !a.verify_recipient,
                                });
                              }}
                            >
                              {a.verify_recipient
                                ? "Verification: ON"
                                : "Verification: OFF"}
                            </button>
                          </div>
                        </div>

                        {/* show how many fields this action has */}
                        <div className="text-xs text-gray-600 mt-2">
                          {a.fields?.length
                            ? `${a.fields.length} fields`
                            : "No fields for this action"}
                        </div>
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">
                  No actions/recipients in template.
                </div>
              )}
            </div>

            <div className="pt-2 flex gap-3">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
                disabled={
                  // disable if any recipient email is invalid or if currently loading details
                  !!detailsLoading ||
                  editable.actions.some((a) => !isValidEmail(a.recipient_email))
                }
                onClick={handleSend}
              >
                Send document (quicksend)
              </button>

              <button
                className="px-4 py-2 border rounded"
                onClick={() => {
                  // reset editable to original details
                  setEditable(
                    details ? JSON.parse(JSON.stringify(details)) : null
                  );
                }}
              >
                Reset changes
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <Link
          href="/templates/TemplateHistory"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Show Past History of All Documents Created Using Templates
        </Link>
      </div>
    </div>
  );
}
