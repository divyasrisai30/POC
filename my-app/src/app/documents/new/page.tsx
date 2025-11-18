/**
 * Features:
 * upload, define recipients, assign page ranges.  
 */

'use client'


import { useState } from "react";
import { useRouter } from "next/navigation";


type Recipient = {
  name: string;
  email: string;
  order: number;
  ranges?: string;
};

export default function New() {

  const router = useRouter();

  const [file, setFile] = useState<File>();
  const [submitting, setSubmitting] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([{
    name: "Divya", email: "dbojanki@asu.edu", order: 1, ranges: "1-3"
  }]);
  const [requestName, setRequestName] = useState('NDA');
  const [notes, setNotes] = useState('Note for all recipients');

  // Removed incomplete handleUpload function - using handleOnSubmit instead


  const addRecipient = () => {
    setRecipients((recipients) => [...recipients, { name: "", email: "", order: recipients.length + 1, ranges: "" }])
  }
  const removeRecipient = (idx: number) => {
    setRecipients(recipients.filter((val, i) => i !== idx));
  }
  const updateRecipient = (idx: number, key: string, value: string | number) => {
    setRecipients(prev =>
      prev.map((val, i) => i === idx ? { ...val, [key]: value } : val)
    );

  }

  const handleOnSubmit = async () => {
    console.log("Submit called");

    // Validation
    if (!file) {
      alert('Please choose a PDF file first.');
      return;
    }

    if (recipients.length === 0) {
      alert('Please add at least one recipient.');
      return;
    }

    // Validate recipients
    for (const r of recipients) {
      if (!r.name || !r.email) {
        alert('Please fill in name and email for all recipients.');
        return;
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(r.email)) {
        alert(`Please enter a valid email address for ${r.name || 'recipient'}.`);
        return;
      }
    }

    console.log('Recipients:', recipients);


    //converting the input to API input request
    const actions = recipients
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((r) => {
        const action: any = {
          action_type: 'SIGN',
          recipient_email: r.email,
          recipient_name: r.name,
          signing_order: r.order ?? 0,
          verify_recipient: false,
          verification_type: 'EMAIL',
        };

        // // Add page_range if specified (format: "1-3" or "1-3,5" etc.)
        // if (r.ranges && r.ranges.trim()) {
        //   action.page_range = r.ranges.trim();
        // }

        return action;
      });

    const payload = {
      requests: {
        request_name: requestName || 'Untitled Request',
        description: 'Details of document',
        is_sequential: true, // because we’re honoring "order"
        actions,
        expiration_days: 10,
        email_reminders: true,
        reminder_period: 2,
        notes,
      },
    };
    console.log(payload);

    //Converting payload
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('data', JSON.stringify(payload));

    try {
      setSubmitting(true);
      const res = await fetch('/api/zoho/upload', {
        method: 'POST',
        body: fd,
      });
      //
      const data = await res.json();
      console.log('Zoho API Response:', data);

      if (!res.ok) {
        console.error('Zoho error:', data);
        const errorMsg = data?.error || data?.message || 'Zoho request failed. Check console for details.';
        alert(`Error: ${errorMsg}\n\nStatus: ${res.status}\n${data?.details ? `Details: ${JSON.stringify(data.details)}` : ''}`);
        return;
      }

      // Success - show request details
      const requestId = data?.requests?.request_id || data?.request_id || 'N/A';
      if (!requestId) {
        alert("Request created but no request_id returned. Check console.");
        return;
      }
      alert(`✅ Request created. Redirecting to status page...`);
      router.push(`/documents/${requestId}`);
      const requestName = data?.requests?.request_name || 'N/A';
      alert(`✅ Success! Signature request created.\n\nRequest ID: ${requestId}\nRequest Name: ${requestName}\n\nRecipients will receive an email to sign.`);

      // Optionally reset form or redirect
      // setFile(undefined);
      // setRecipients([{ name: "", email: "", order: 1, ranges: "" }]);
    } catch (e: any) {
      console.error('Submit error:', e);
      alert(`Submit failed: ${e?.message || 'Unknown error'}\n\nCheck console for details.`);
    } finally {
      setSubmitting(false);
    }

  }
  return (
    <main className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Create Zoho Sign Request</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Request Name</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            placeholder="e.g., NDA, Contract, etc."
            value={requestName}
            onChange={(e) => setRequestName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Notes (for all recipients)</label>
          <textarea
            className="w-full border rounded px-3 py-2"
            placeholder="Optional notes for all recipients"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">PDF Document</label>
          <input
            type="file"
            accept=".pdf"
            onChange={e => setFile(e.target.files?.[0])}
            className="block"
          />
          {file && <p className="text-sm text-gray-600 mt-1">Selected: {file.name}</p>}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium">Recipients & Page Ranges</div>
          <p className="text-xs text-gray-500 mt-1">Page ranges format: "1-3" or "1-3,5" (leave empty to sign all pages)</p>
        </div>
        {
          <div className="grid md:grid-cols-12 gap-2 items-center font-medium text-sm">
            <div className="md:col-span-3">Name</div>
            <div className="md:col-span-4">Email</div>
            <div className="md:col-span-3">Page Numbers</div>
            <div className="md:col-span-1">Order</div>
            <div className="md:col-span-1">Remove</div>
          </div>
        }
        {recipients.map((r, i) => (
          <div key={i} className="grid md:grid-cols-12 gap-2 items-center">
            <input className="md:col-span-3 border rounded px-2 py-1" placeholder="Name" value={r.name} onChange={(e) => updateRecipient(i, "name", e.target.value)} />
            <input className="md:col-span-4 border rounded px-2 py-1" placeholder="Email" value={r.email} onChange={(e) => updateRecipient(i, "email", e.target.value)} />
            <input className="md:col-span-3 border rounded px-2 py-1" placeholder="e.g. 1-3,5" value={r.ranges} onChange={(e) => updateRecipient(i, "ranges", e.target.value)} />
            <input className="md:col-span-1 border rounded px-2 py-1" type="number" min={1} value={r.order} onChange={(e) => updateRecipient(i, "order", Number(e.target.value))} />
            <button className="md:col-span-1 text-sm underline" onClick={() => removeRecipient(i)}>Remove</button>
          </div>
        ))}
        <button className="px-3 py-2 border rounded hover:bg-gray-50" onClick={addRecipient}>+ Add Recipient</button>

        <div className="pt-4 border-t">
          <button
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleOnSubmit}
            disabled={submitting || !file || recipients.length === 0}
          >
            {submitting ? "Submitting..." : "Submit for Signature"}
          </button>
          {submitting && <p className="text-sm text-gray-600 mt-2">Creating signature request...</p>}
        </div>
      </div>
    </main>
  );
}