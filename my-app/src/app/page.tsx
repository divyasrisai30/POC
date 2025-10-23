'use client'

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File>();
  const [uploading, setUploading] = useState(false)
  const [uploaded , setUploaded] = useState();
  const [submitting, setSubmitting] = useState(false);

  const [recipients, setRecipients] = useState([{
    name: "Divya", email: "alice@example.com", order: 1, ranges: "1-3"
   }]);

  const handleUpload = () =>{
    //if file is not present =? alert with a message
    if (!file) return alert("Choose a PDF first.");
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);

    // try{
    // }catch(){

    // }
  }

  const addRecipient = () =>{
    setRecipients((recipients)=>[...recipients, {name: "", email: "", order: 0, ranges: ""}])
  }
  const removeRecipient = (idx: number) =>{
    setRecipients(recipients.filter((val, i ) => i!==idx));
  }
  const updateRecipient = (idx:number, key:string, value: string | number) =>{
    recipients.map((val, i)=>  i===idx?{...val, [key]: value }:val)

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
      </div>
    </main>
  );
}















