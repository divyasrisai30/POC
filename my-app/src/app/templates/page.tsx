"use client"

import { useEffect, useState } from "react";

export default function template(){

    type Template = {
        template_id: string;
        template_name: string;
        created_time?: number;
    };

    type TemplateField = {
        field_id: string;
        field_label?: string;
        field_type?: string;
        is_mandatory?: boolean;
        default_value?: string | null;
    }
    type TemplateDetails = {
        template_id: string;
        template_name: string;
        actions?: Array<{ 
                recipient_name: string,
                recipient_email: string,
                action_id: string,
                action_type: "SIGN",
                signing_order: number,
                // role: "User",
                verify_recipient: false,
                // private_notes: ""
         }>;
        document_fields?: TemplateField[];
    }

    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
    const [error, setError]   = useState<string | null>();

    const [details, setDetails] = useState<TemplateDetails | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState<string | null>(null);





    useEffect(()=>{
        async function loadTemplates() {
            try{
                const res = await fetch("api/zoho/templates");
                console.log("result",res);
                const data = await res.json();
                setTemplates(data.templates ?? []);
            }finally{
                setLoading(false);
            }
            
        }
        loadTemplates();
    },[])

    useEffect(() => {
        if (!selectedTemplateId) {
            setDetails(null);
            setDetailsError(null);
            setDetailsLoading(false);
            return;
        }

        let cancelled = false;
        const controller = new AbortController();

        async function loadDetails() {
            setDetailsLoading(true);
            setDetailsError(null);

            try {
                // hit your server-side proxy that calls Zoho template details
                const res = await fetch(`/api/zoho/templates/${selectedTemplateId}`, {
                    signal: controller.signal,
                });

                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(`Failed to load template details: ${res.status} ${text}`);
                }

                const data = await res.json();
                console.log("data",data);

                if (cancelled) return;

                // Normalize/ensure document_fields exists so UI can safely iterate later
                const normalized: TemplateDetails = {
                    template_id: data.templates.template_id ?? selectedTemplateId,
                    template_name: data.templates.template_name ?? (templates.find(t => t.template_id === selectedTemplateId)?.template_name ?? ""),
                    actions: data.templates.actions ?? [],
                    document_fields: (data.templates.document_fields ?? []).map((f: any) => ({
                        field_id: f.field_id ?? f.id ?? f.name,
                        field_label: f.field_label ?? f.label ?? f.name,
                        field_type: f.field_type ?? f.type ?? "text",
                        is_mandatory: !!f.is_mandatory,
                        default_value: f.default_value ?? f.value ?? ""
                    }))
                };
                console.log("normalized", normalized);

                setDetails(normalized);
            }
         catch (err: any) {
                if (controller.signal.aborted) {
                    // aborted - ignore
                    return;
                }
                console.error("template details error", err);
                if (!cancelled) setDetailsError(err?.message ?? "Unknown error loading template details");
                setDetails(null);
            } finally {
                if (!cancelled) setDetailsLoading(false);
            }
        }

        loadDetails();
        console.log("details", details);

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [selectedTemplateId, templates]);

 

    if (loading) return <div>Loading templates…</div>;
    console.log(templates);

    return(
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
         <h1 className="text-xl font-semibold mb-4">Zoho Available Sign Templates</h1>
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
            <h1 className="text-xl font-semibold mb-4">Choose a TEMPLATE and send the document</h1>
            <label htmlFor="template-select">Select a template      </label>
            <select 
            id="template-select"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}>
                <option >{templates.length ===0 ?"No templates found":"--select a template--"}</option>
                {templates.map((template)=>
                <option key={template.template_id} value={template.template_id}>{template.template_name} — {template.template_id}</option>
                )}
            </select>
        </div>

        <div className="mt-4">
                {detailsLoading && <div>Loading template details…</div>}
                {detailsError && <div className="text-red-600">Error loading template details: {detailsError}</div>}
                {details 
                && (
                    <div className="border p-3 rounded mt-2">
                        <div className="font-medium">{details.template_name}</div>
                        <div className="text-xs text-gray-500">ID: {details.template_id}</div>


                        <div className="mt-3">
                            <div className="text-sm font-medium">Actions / Recipients</div>
                            {details.actions && details.actions.length > 0 ? (
                                <ul className="mt-2 space-y-2">
                                    {details.actions.map(a => (
                                        <li key={a.action_id} className="p-3 border rounded">
                    <div className="flex items-center gap-3">

                        {/* Signing Order badge */}
                        <div className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 rounded-md font-semibold">
                        {a.signing_order}
                        </div>

                        {/* Role pill */}
                        <div className="px-3 py-2 bg-gray-100 rounded text-sm text-gray-700">
                        User
                        </div>

                        {/* Email */}
                        <input
                        type="email"
                        placeholder="Email"
                        className="border px-3 py-2 rounded w-48"
                        value={a.recipient_email}
                        onChange={() => {}}
                        disabled
                        />

                        {/* Name */}
                        <input
                        type="text"
                        placeholder="Name"
                        className="border px-3 py-2 rounded w-48"
                        value={a.recipient_name}
                        onChange={() => {}}
                        disabled
                        />

                        {/* Needs to sign (count fields) */}
                        {/* <div className="border px-3 py-2 rounded w-40 text-gray-600 text-sm">
                        {a.fields?.length ? `${a.fields.length} fields` : "Needs to sign"}
                        </div> */}

                        {/* Email dropdown (delivery mode) */}
                        <select className="border px-3 py-2 rounded">
                        <option>Email</option>
                        <option>SMS</option>
                        </select>

                        {/* Customize */}
                        <button className="border px-4 py-2 rounded flex items-center gap-2">
                         Customize
                        </button>
                    </div>
                    </li>))}
                                </ul>
                            ) : (
                                <div className="text-sm text-gray-500">No actions/recipients included in template metadata.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

        </div>

    )
}