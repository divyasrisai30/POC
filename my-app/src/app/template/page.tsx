"use client"

import { useEffect, useState } from "react";

export default function template(){

    type Template = {
        template_id: string;
        template_name: string;
        created_time?: number;
    };

    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);


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


    if (loading) return <div>Loading templates…</div>;

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
            <h1 className="text-xl font-semibold mb-4">Select a TEMPLATE and send the document</h1>
        </div>

        </div>

    )
}