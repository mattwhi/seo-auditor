'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import './BulkAiWorkspace.css';

type Page = {id:string;finalUrl:string;title:string|null};
type Analysis = {id:string;pageId:string;status:string;createdAt:string;summary:string|null};
type Review = {id:string;analysisId:string;ruleId:string;field:string;priority:string;status:string;currentValue:string;proposedValue:string;explanation:string;evidence:string;reviewedAt:string|null};
type Policy = {enabled:boolean;configured:boolean;maxAnalysesPerDay:number};
async function api(projectId:string,action:string,method='GET',body?:unknown,params:Record<string,string>={}) {
  const url=new URL('/api/ai',window.location.origin);url.searchParams.set('projectId',projectId);url.searchParams.set('action',action);
  for(const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
  const response=await fetch(url,{method,cache:'no-store',headers:method==='GET'?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json();if(!response.ok)throw Error(result.error||`HTTP ${response.status}`);return result;
}
export default function BulkAiWorkspace({projectId,auditId,pages}:{projectId:string;auditId:string;pages:Page[]}) {
  const [analyses,setAnalyses]=useState<Analysis[]>([]),[reviews,setReviews]=useState<Review[]>([]);
  const [policy,setPolicy]=useState<Policy|null>(null),[selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [filter,setFilter]=useState('pending'),[query,setQuery]=useState(''),[drafts,setDrafts]=useState<Record<string,string>>({});
  const [loaded,setLoaded]=useState(0);
  const refresh=useCallback(async()=>{
    const [a,p]=await Promise.all([api(projectId,'analyses','GET',undefined,{auditId}),api(projectId,'settings')]);
    setAnalyses(a);setPolicy(p);
  },[projectId,auditId]);
  useEffect(()=>{void refresh().catch(e=>setError(String(e)));},[refresh]);
  const analyzed=new Set(analyses.filter(a=>a.status==='completed').map(a=>a.pageId));
  const eligible=pages.filter(p=>!analyzed.has(p.id));
  const selectedPages=pages.filter(p=>selected.includes(p.id));
  async function runBatch(){
    if(!selectedPages.length||busy)return;
    setBusy(true);setError('');setNotice('');let done=0,failed=0;
    // Sequential by design: avoid bursting OpenAI calls and retain existing server-side limits.
    for(const page of selectedPages.slice(0,10)){
      setProgress(`Analysing ${done+failed+1}/${Math.min(selectedPages.length,10)}: ${page.title||page.finalUrl}`);
      try{await api(projectId,'analyse','POST',{auditId,pageId:page.id});done++;}
      catch(e){failed++;setError(`Stopped on ${page.finalUrl}: ${e instanceof Error?e.message:String(e)}. Completed ${done}.`);break;}
    }
    setBusy(false);setProgress('');setSelected([]);
    setNotice(`Completed ${done} page analyses${failed?' before stopping on an error':''}. No website changes were made.`);
    try{await refresh();}catch(e){setError(String(e));}
  }
  async function loadQueue(){
    setBusy(true);setError('');setNotice('');const results:Review[]=[];let count=0;
    try{
      // Existing API materialises saved recommendations idempotently. Limit the scan to the latest 50 analyses.
      for(const a of analyses.filter(a=>a.status==='completed').slice(0,50)){
        const rows:Review[]=await api(projectId,'reviews','GET',undefined,{analysisId:a.id});results.push(...rows);count++;
      }
      setReviews(results);setLoaded(count);setNotice(`Loaded ${results.length} recommendations across ${count} completed analyses.`);
    }catch(e){setError(e instanceof Error?e.message:String(e));setReviews(results);setLoaded(count);}
    finally{setBusy(false);}
  }
  async function decide(r:Review,action:'edit'|'approve'|'reject'){
    setBusy(true);setError('');setNotice('');
    try{
      const payload=action==='edit'?{action,proposedValue:drafts[r.id]??r.proposedValue}:{action};
      const updated:Review=await api(projectId,'review','PATCH',payload,{reviewId:r.id});
      setReviews(old=>old.map(x=>x.id===r.id?updated:x));
      setNotice(action==='approve'?'Approved for human-controlled remediation; nothing published.':action==='reject'?'Rejected and recorded.':'Edited proposal saved.');
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  async function createDraft(r:Review){
    setBusy(true);setError('');setNotice('');
    try{await api(projectId,'proposal','POST',{}, {reviewId:r.id});setNotice('WordPress draft proposal created. Open Proposals & verification for preflight and approval.');}
    catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  const shown=useMemo(()=>reviews.filter(r=>(filter==='all'||r.status===filter)&&[r.field,r.ruleId,r.proposedValue,r.explanation].join(' ').toLowerCase().includes(query.toLowerCase())),[reviews,filter,query]);
  const canDraft=(r:Review)=>r.status==='approved'&&((r.field==='title'&&['title.missing','title.too-short','title.too-long'].includes(r.ruleId))||(r.field==='metaDescription'&&['description.missing','description.too-short','description.too-long'].includes(r.ruleId)));
  return <div className="bulk-ai-workspace">
    {error&&<p className="bulk-ai-error" role="alert">{error}</p>}{notice&&<p className="bulk-ai-notice" role="status">{notice}</p>}
    <section className="bulk-ai-panel"><div className="bulk-ai-heading"><div><span className="eyebrow">BULK AI ANALYSIS</span><h3>Analyse multiple audited pages</h3><p>Run up to 10 selected pages sequentially. Previously completed pages are excluded by default.</p></div><button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh</button></div>
      <div className="bulk-ai-metrics"><div><strong>{pages.length}</strong><span>Audited pages</span></div><div><strong>{analyzed.size}</strong><span>Analysed</span></div><div><strong>{eligible.length}</strong><span>Not analysed</span></div><div><strong>{selected.length}</strong><span>Selected</span></div></div>
      <div className="bulk-ai-controls"><button type="button" disabled={busy} onClick={()=>setSelected(eligible.slice(0,10).map(p=>p.id))}>Select first 10 pending</button><button type="button" disabled={busy} onClick={()=>setSelected([])}>Clear selection</button></div>
      <div className="bulk-ai-pages">{eligible.slice(0,100).map(p=><label key={p.id}><input type="checkbox" disabled={busy||(!selected.includes(p.id)&&selected.length>=10)} checked={selected.includes(p.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/><span><strong>{p.title||'Untitled page'}</strong><small>{p.finalUrl}</small></span></label>)}</div>
      <div className="bulk-ai-controls"><button type="button" className="bulk-ai-primary" disabled={busy||!selected.length||!policy?.enabled||!policy?.configured} onClick={()=>void runBatch()}>{busy?'Working…':`✦ Analyse ${selected.length} selected page${selected.length===1?'':'s'}`}</button><small>{progress||(!policy?.enabled?'Enable AI in project settings before running analysis.':'Each page consumes one AI analysis; project limits still apply.')}</small></div>
    </section>
    <section className="bulk-ai-panel"><div className="bulk-ai-heading"><div><span className="eyebrow">CONSOLIDATED REVIEW QUEUE</span><h3>Review recommendations across pages</h3><p>Load saved recommendations from up to 50 recent completed analyses. Decisions persist in PostgreSQL.</p></div><button type="button" disabled={busy} onClick={()=>void loadQueue()}>{busy?'Loading…':'↻ Load review queue'}</button></div>
      <div className="bulk-ai-controls"><input aria-label="Search recommendations" placeholder="Search rules or suggestions…" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Filter decisions" value={filter} onChange={e=>setFilter(e.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All decisions</option></select><span>{shown.length} shown · {loaded} analyses loaded</span></div>
      <div className="bulk-ai-reviews">{shown.map(r=>{const analysis=analyses.find(a=>a.id===r.analysisId);const page=pages.find(p=>p.id===analysis?.pageId);const value=drafts[r.id]??r.proposedValue;const changed=value!==r.proposedValue;return <article key={r.id}><div className="bulk-ai-review-head"><div><strong>{r.field} · {r.ruleId}</strong><small>{page?.finalUrl||'Audited page'}</small></div><span>{r.status} · {r.priority}</span></div><p>{r.explanation}</p><div className="bulk-ai-diff"><div><b>Before · saved crawl</b><p>{r.currentValue||'Not present'}</p></div><div><b>After · proposed</b><textarea rows={3} disabled={busy||r.status!=='pending'} value={value} onChange={e=>setDrafts(old=>({...old,[r.id]:e.target.value}))}/></div></div><details><summary>Crawl evidence</summary><p>{r.evidence}</p></details><div className="bulk-ai-controls">{r.status==='pending'?<><button type="button" disabled={busy||!changed||!value.trim()} onClick={()=>void decide(r,'edit')}>Save edit</button><button type="button" disabled={busy||changed||!value.trim()} onClick={()=>void decide(r,'approve')}>Approve</button><button type="button" disabled={busy} onClick={()=>void decide(r,'reject')}>Reject</button></>:canDraft(r)?<button type="button" disabled={busy} onClick={()=>void createDraft(r)}>Create WordPress draft →</button>:<small>Decision recorded. Unsupported fields remain manual-only.</small>}</div></article>})}</div>
      {loaded>0&&!shown.length&&<p className="bulk-ai-empty">No recommendations match the current filter.</p>}
      <p className="bulk-ai-footer">Approval does not publish. WordPress changes require a separate draft, human approval, fresh preflight and explicit execution.</p>
    </section>
  </div>;
}
