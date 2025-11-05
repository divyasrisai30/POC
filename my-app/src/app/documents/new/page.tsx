/**
 * Features:
 * upload, define recipients, assign page ranges.  
 */

'use client'


import { useState } from "react";

type Recipient = {
  name: string;
  email: string;
  order: number;
  ranges?: string;
};

export default function New(){

        const [file, setFile] = useState<File>();
        const [uploading, setUploading] = useState(false)
        const [uploaded , setUploaded] = useState();
        const [submitting, setSubmitting] = useState(false);
        const [recipients, setRecipients] = useState<Recipient[]>([{
          name: "Divya", email: "dbojanki@asu.edu", order: 1, ranges: "1-3"
        }]);
        const [requestName, setRequestName] = useState('NDA');
        const [notes, setNotes] = useState('Note for all recipients');

  const handleUpload = async () => {
  if (!file) return alert("Choose a PDF first.");
  setUploading(true);

  const fd = new FormData();
  fd.append("file", file);
};


  const addRecipient = () =>{
    setRecipients((recipients)=>[...recipients, {name: "", email: "", order: recipients.length+1, ranges: ""}])
  }
  const removeRecipient = (idx: number) =>{
    setRecipients(recipients.filter((val, i ) => i!==idx));
  }
  const updateRecipient = (idx:number, key:string, value: string | number) =>{
    setRecipients(prev =>
    prev.map((val, i)=>  i===idx?{...val, [key]: value }:val)
    );

  }

  const handleOnSubmit = async()=>{
    console.log("Submit called");

    //checking for inputs
       if (!file) {
      alert('Choose a PDF first.');
      return;
      }
      if (recipients.length === 0) {
        alert('Add at least one recipient.');
        return;
      }
    console.log(recipients);


    //converting the input to API input request
    const actions = recipients
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((r) => ({
        action_type: 'SIGN',
        recipient_email: r.email,
        recipient_name: r.name,
        signing_order: r.order ?? 0,
        verify_recipient: false,
        verification_type: 'EMAIL',
        private_notes: r.ranges ? `Please sign on pages: ${r.ranges}` : 'Please sign',
      }));

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
      console.log(data);
      if (!res.ok) {
        console.error('Zoho error:', data);
        alert(data?.error || 'Zoho request failed. Check console.');
        return;
      }
      console.log('Zoho request created:', data);
      alert('Sent for signature!');
    } catch (e) {
      console.error(e);
      alert('Submit failed. Check console.');
    } finally {
      setSubmitting(false);
    }
    
  }
  return (
    <main className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1>File Upload</h1>
      <div>
        <input type="file" onChange={e => setFile(e.target.files?.[0])}/>
        <button 
        className="px-3 py-2 border rounded disabled:opacity-60"
        onClick={handleUpload}>
        {uploading? "Uploading...": "Upload"}
        </button>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium">Recipients & Page Ranges</div>
        {
          <div className="grid md:grid-cols-12 gap-2 items-center">
            <div className="md:col-span-3">Name</div>
            <div className="md:col-span-4">Email</div>
            <div className="md:col-span-3 ">Page Numbers</div>
            <div className="md:col-span-1 " >Order</div>
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
        <button className="px-3 py-2 border rounded" onClick={addRecipient}>+ Add Recipient</button>

        <p>All the recipients are added then only click on Submit</p>
         <button className="px-3 py-2 border rounded" onClick={handleOnSubmit}>Submit</button>
      </div>
    </main>
  );
}