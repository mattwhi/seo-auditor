'use client';
import { useMemo, useState } from 'react';
import AiWorkspace from './AiWorkspace';
import RemediationWorkspace from './RemediationWorkspace';
import BulkAiWorkspace from './BulkAiWorkspace';
import './RemediationCentre.css';

type Page = { id: string; finalUrl: string; title: string | null };
type Section = 'page' | 'analysis' | 'bulk' | 'reviews' | 'proposals';

export default function RemediationCentre({projectId,auditId,pages}: {projectId:string;auditId:string;pages:Page[]}) {
  const [section,setSection] = useState<Section>('page');
  const [pageId,setPageId] = useState('');
  const chosen = pages.find(p=>p.id===pageId);
  const pageOptions = useMemo(()=>[...pages].sort((a,b)=>(a.title||a.finalUrl).localeCompare(b.title||b.finalUrl)),[pages]);
  const activePageId = pageId || pageOptions[0]?.id || '';
  const tabs: {id:Section;label:string;description:string}[] = [
    {id:'page',label:'Page remediation',description:'Select a page, analyse its SEO and review suggested changes.'},
    {id:'analysis',label:'Full AI analysis',description:'Explore all analyses and SEO recommendations from the current audit.'},
    {id:'bulk',label:'Bulk analysis & queue',description:'Analyse up to 10 pages sequentially and review saved recommendations across the audit.'},
    {id:'reviews',label:'Review queue',description:'Review, edit, approve and create eligible WordPress draft proposals.'},
    {id:'proposals',label:'Proposals & verification',description:'Approve drafts, run preflight and explicitly authorise WordPress changes.'},
  ];
  return <section className="remediation-centre">
    <header className="remediation-centre-header">
      <div><span className="eyebrow">v0.9.3 · INTELLIGENT REMEDIATION</span><h2>SEO Remediation Centre</h2><p>Analyse → Recommend → Review → Propose → Verify. Human approval is required before any WordPress update.</p></div>
      <span className="remediation-centre-safety">● Drafts never publish automatically</span>
    </header>
    <nav className="remediation-centre-tabs" aria-label="Remediation workflow">
      {tabs.map(t=><button type="button" key={t.id} aria-current={section===t.id?'page':undefined} className={section===t.id?'active':''} onClick={()=>setSection(t.id)}>{t.label}</button>)}
    </nav>
    <p className="remediation-centre-description">{tabs.find(t=>t.id===section)?.description}</p>
    {section==='page' && <>
      <div className="remediation-centre-selector">
        <label htmlFor="remediation-page-picker">1 · Select an audited page</label>
        <select id="remediation-page-picker" value={activePageId} onChange={e=>setPageId(e.target.value)}>
          {pageOptions.map(p=><option key={p.id} value={p.id}>{p.title || p.finalUrl} · {p.finalUrl}</option>)}
        </select>
        <p>{chosen?.finalUrl || pageOptions.find(p=>p.id===activePageId)?.finalUrl || 'No pages available in this audit.'}</p>
      </div>
      {activePageId ? <AiWorkspace key={`${auditId}:${activePageId}`} projectId={projectId} auditId={auditId} pages={pages} focusPageId={activePageId}/> : <div className="panel">Run a crawl to discover pages before requesting AI analysis.</div>}
      <div className="remediation-centre-next"><strong>Next step: create and inspect the draft</strong><p>After reviewing and approving an eligible AI recommendation, choose “Create WordPress draft” in its review card. Then open Proposals &amp; verification for preflight and approval.</p><button type="button" onClick={()=>setSection('proposals')}>Open proposal queue →</button></div>
    </>}
    {section==='analysis' && <AiWorkspace key={`analysis:${auditId}`} projectId={projectId} auditId={auditId} pages={pages}/>}
    {section==='bulk' && <BulkAiWorkspace projectId={projectId} auditId={auditId} pages={pages}/>}
    {section==='reviews' && <AiWorkspace key={`reviews:${auditId}`} projectId={projectId} auditId={auditId} pages={pages} reviewOnly/>}
    {section==='proposals' && <RemediationWorkspace key={`proposals:${auditId}`} projectId={projectId} auditId={auditId}/>}
  </section>;
}
