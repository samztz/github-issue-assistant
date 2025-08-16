import { useState } from "react";
import { queryLLM } from "./api";

export default function App() {
  const [text, setText] = useState("Cloudflare Workers + GraphQL + ChatGPT");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSummarize() {
    setLoading(true); setOut("");
    try { setOut(await queryLLM(text)); }
    catch (e:any) { setOut(`Error: ${e.message || e}`); }
    finally { setLoading(false); }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "ui-sans-serif, system-ui" }}>
      <h1>LLM Echo (Workers GraphQL)</h1>
      <p style={{color:"#666"}}>API: <code>{import.meta.env.VITE_API_BASE || "/graphql (relative)"}</code></p>

      <textarea rows={5} value={text} onChange={e=>setText(e.target.value)}
        style={{width:"100%",padding:12,borderRadius:8,border:"1px solid #ddd"}} />

      <div style={{marginTop:12,display:"flex",gap:8}}>
        <button onClick={onSummarize} disabled={loading}
          style={{padding:"8px 16px",borderRadius:8,border:"1px solid #333"}}>
          {loading ? "Summarizing..." : "Summarize"}
        </button>
        <button onClick={()=>setOut("")}
          style={{padding:"8px 16px",borderRadius:8,border:"1px solid #aaa"}}>Clear</button>
      </div>

      <pre style={{marginTop:16,background:"#fafafa",padding:12,borderRadius:8,whiteSpace:"pre-wrap"}}>
        {out || "Result will appear here..."}
      </pre>
    </main>
  );
}
