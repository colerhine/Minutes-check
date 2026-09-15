import {settings,setupReview,issueActions,decisions} from './review-ui.mjs';
import {readWord} from './office.mjs';
const officeHost=document.body.dataset.host==='word';
let lastIssues=[],lastComparison=[],renderedSnapshot=null;
import {importPptx} from './pptx.mjs';
import {extract} from './extract.mjs';
import {checkMinutes} from './checker.mjs?v=0.5.1';
import {usableCapture} from './capture-quality.mjs';
import {compareSlides} from './compare.mjs';
const $=id=>document.getElementById(id);
let timer,busy=false,generation=0,sources=null;
let tabs=new Map();
let pendingFrames=[];
let importedDeck=false,importGeneration=0;

function showIssues(container,issues){
  container.replaceChildren();
  for(const issue of issues){
    const el=document.createElement('article');el.className='issue';
    const title=document.createElement('strong');title.textContent=issue.title+(issue.line?` · line ${issue.line}`:'');
    const body=document.createElement('p');body.textContent=issue.message;el.append(title,body);
    if(issue.excerpt){const q=document.createElement('blockquote');q.textContent=issue.excerpt;el.append(q);}
    issueActions(el,issue,render);container.append(el);
  }
}
function render(){
  const text=$('draft').value,slides=$('slides').value;
  const snapshot=JSON.stringify([text,slides,$('full').checked,$('slidesFull').checked,$('type').value,settings]);
  if(snapshot===renderedSnapshot)return;renderedSnapshot=snapshot;
  const issues=checkMinutes(text,{full:$('full').checked,type:$('type').value,settings});
  $('summary').textContent=!text.trim()?(sources?'Waiting for document text — not yet reviewed':'Ready to connect'):issues.length?`${issues.length} items to review`:usableCapture(text)?'No rule matches — complete the final checklist':'Insufficient document text — review not available';
  lastIssues=issues;showIssues($('issues'),issues);
  const validSlides=usableCapture(slides),validMinutes=usableCapture(text);
  $('slidesFull').disabled=!validSlides;if(!validSlides)$('slidesFull').checked=false;
  $('full').disabled=!validMinutes;if(!validMinutes)$('full').checked=false;
  const comparison=validSlides&&validMinutes?compareSlides(slides,text):[];
  const complete=$('full').checked&&$('slidesFull').checked;
  $('comparisonStatus').textContent=!validSlides||!validMinutes?'Comparison unavailable — readable reports needed from both sources':`${complete?'Supplied full texts':'Partial sources'}: ${comparison.length} items to compare — completeness is not verified`;
  lastComparison=comparison;showIssues($('comparison'),comparison);
}
function stop(message){clearInterval(timer);timer=null;generation++;$('stop').disabled=true;if(message)$('status').textContent=message;}
async function refresh(){
  if(officeHost)return;
  try{
    const available=(await chrome.tabs.query({})).filter(t=>t.url?.startsWith('https://'));
    tabs=new Map(available.map(t=>[String(t.id),t]));
    for(const id of ['minutesTab','slidesTab']){
      const select=$(id),old=select.value;select.replaceChildren(new Option('Choose a tab…',''));
      for(const tab of available)select.add(new Option(`${tab.title||'Untitled'} — ${new URL(tab.url).hostname}`,String(tab.id)));
      if(tabs.has(old))select.value=old;
    }
  }catch{$('status').textContent='Could not list tabs. Reload the extension to accept its updated permissions.';}
}
async function capture(source,role){
  const tab=await chrome.tabs.get(source.id);
  if(tab.url!==source.url)throw new Error('The tab navigated. Refresh the tab list and reconnect.');
  const frames=await chrome.webNavigation.getAllFrames({tabId:source.id});
  const allowed=[];
  for(const frame of frames||[]){
    if(!frame.url.startsWith('https://'))continue;
    const origin=new URL(frame.url).origin+'/*';
    if(await chrome.permissions.contains({origins:[origin]}))allowed.push(frame.frameId);
  }
  const results=await Promise.allSettled(allowed.map(frameId=>chrome.scripting.executeScript({target:{tabId:source.id,frameIds:[frameId]},func:extract,args:[role]})));
  const captured=results.flatMap(r=>r.status==='fulfilled'?r.value:[]).map(r=>r.result);
  const candidates=captured.flatMap(r=>r?.candidates||[]).filter(r=>r?.text?.trim()&&usableCapture(r.text,tab.title||''));
  const details=captured.map(r=>r?.diagnostic).filter(Boolean);
  const diagnostic=`${allowed.length} approved frames; ${details.reduce((n,d)=>n+d.documentRegions,0)} document regions; largest region ${Math.max(0,...details.map(d=>d.largest))} characters; ${results.filter(r=>r.status==='rejected').length} frame errors`;
  candidates.sort((a,b)=>b.text.length-a.text.length);
  if(!candidates.length)throw new Error(`No readable report captured (${diagnostic}). Keep a report page open. Capture is not a completed review.`);
  return candidates[0];
}
async function discoverFrames(){
  pendingFrames=[];
  for(const source of Object.values(sources).filter(Boolean)){
    const frames=await chrome.webNavigation.getAllFrames({tabId:source.id});
    for(const frame of frames||[]){
      if(!frame.url.startsWith('https://'))continue;
      const origin=new URL(frame.url).origin+'/*';
      // Only offer Microsoft's Office editor hosts, not analytics or arbitrary frames.
      if(!new URL(frame.url).hostname.endsWith('.officeapps.live.com'))continue;
      if(!await chrome.permissions.contains({origins:[origin]}))pendingFrames.push(origin);
    }
  }
  pendingFrames=[...new Set(pendingFrames)];
  $('frames').hidden=!pendingFrames.length;
  $('frameStatus').textContent=pendingFrames.length?'Word/PowerPoint runs inside these additional editor sites: '+pendingFrames.join(', '):'Editor site access is ready.';
}
async function read(){
  if(officeHost){await readOffice();return;}
  if(busy||!sources)return;busy=true;const current=generation;
  try{
    const roles=['minutes',...(sources.slides?['slides']:[])];
    const results=await Promise.allSettled(roles.map(role=>capture(sources[role],role)));
    if(current!==generation)return;
    let failed=false;
    results.forEach((result,i)=>{
      const role=roles[i],status=role==='minutes'?'status':'slidesStatus',field=role==='minutes'?'draft':'slides';
      $(role==='minutes'?'full':'slidesFull').checked=false;
      if(result.status==='rejected'){failed=true;$(field).value='';$(status).textContent=`${role}: ${result.reason.message}`;return;}
      $(field).value=result.value.text;
      $(status).textContent=`${role}: ${result.value.kind}, ${result.value.text.length.toLocaleString()} characters. Partial coverage. Read ${new Date().toLocaleTimeString()}.`;
    });
    render();if(failed)$('status').textContent+=' Live reader will retry automatically.';
  }finally{busy=false;}
}
$('connect').addEventListener('click',async()=>{
  if(officeHost){stop();sources={office:true};$('stop').disabled=false;timer=setInterval(read,2500);await read();return;}
  const minutes=tabs.get($('minutesTab').value),slides=null;
  if(!minutes){$('status').textContent='Choose the minutes tab first.';return;}
  if(slides?.id===minutes.id){$('status').textContent='Choose different tabs for minutes and slides.';return;}
  stop();const current=generation;
  const origins=[...new Set([minutes,slides].filter(Boolean).map(t=>`${new URL(t.url).origin}/*`))];
  try{
    const granted=await chrome.permissions.request({origins});
    if(current!==generation)return;
    if(!granted){$('status').textContent='Site access was declined. You can still paste both sources.';return;}
    sources={minutes:{id:minutes.id,url:minutes.url},slides:slides?{id:slides.id,url:slides.url}:null};
    $('draft').value='';$('full').checked=false;if(!importedDeck){$('slides').value='';$('slidesFull').checked=false;}
    if(!importedDeck)$('slidesStatus').textContent='Import your PPTX to compare its reports with live minutes.';
    await discoverFrames();
    $('stop').disabled=false;timer=setInterval(read,2000);await read();
  }catch{$('status').textContent='Could not request access. Reload the extension and retry, or paste both sources.';}
});
$('revoke').addEventListener('click',async()=>{
  stop();importedDeck=false;importGeneration++;sources=null;pendingFrames=[];$('frames').hidden=true;$('frameStatus').textContent='';
  try{const permissions=await chrome.permissions.getAll();if(permissions.origins?.length)await chrome.permissions.remove({origins:permissions.origins});
    $('draft').value='';$('slides').value='';$('full').checked=false;$('slidesFull').checked=false;render();
    $('status').textContent='Optional site access revoked; source text cleared.';$('slidesStatus').textContent='No slides connected.';
  }catch{$('status').textContent='Could not revoke access. Open Chrome extension settings to remove site access.';}
});
$('refresh').addEventListener('click',refresh);
$('minutesTab').addEventListener('change',()=>{stop('Minutes tab changed. Reconnect and confirm the imported deck belongs to this meeting.');$('draft').value='';$('full').checked=false;render();});
$('stop').addEventListener('click',()=>stop('Live check stopped. The last captured text remains below.'));
for(const id of ['draft','slides'])$(id).addEventListener('input',()=>{stop('Checking pasted or edited text. Live capture is stopped.');if(id==='slides'){importedDeck=false;importGeneration++;$('slidesStatus').textContent='Using manually edited slide text; file provenance cleared.';}render();});
for(const id of ['full','slidesFull'])$(id).addEventListener('change',()=>{stop('Live capture stopped. Checking the supplied text.');render();});
$('type').addEventListener('change',render);
$('clear').addEventListener('click',()=>{stop('Text cleared.');importedDeck=false;importGeneration++;$('draft').value='';$('slides').value='';$('full').checked=false;$('slidesFull').checked=false;render();});
refresh();

$('frames').addEventListener('click',async()=>{
  try{
    const granted=await chrome.permissions.request({origins:pendingFrames});
    if(!granted){$('frameStatus').textContent='Editor access declined. Live document reading may remain unavailable.';return;}
    await discoverFrames();await read();
  }catch{$('frameStatus').textContent='Could not connect editor frames. Reconnect selected tabs to retry.';}
});

$('deckFile').addEventListener('change',async()=>{
  const file=$('deckFile').files[0];if(!file)return;
  const version=++importGeneration;importedDeck=false;$('slides').value='';$('slidesFull').checked=false;
  $('slidesStatus').textContent='Reading slide text from the local file…';render();
  try{
    const result=await importPptx(await file.arrayBuffer());if(version!==importGeneration)return;
    importedDeck=true;$('slides').value=result.text;$('slidesFull').checked=true;
    const empty=result.slides.filter(s=>!s.text.trim()).length;
    $('slidesStatus').textContent=`Imported ${file.name}: ${result.slides.length} slides in deck order, ${empty} without embedded text. Snapshot taken ${new Date().toLocaleTimeString()}. Images, charts, and speaker notes are not transcribed. Re-import after changes.`;
    render();
  }catch(error){if(version===importGeneration){$('slidesStatus').textContent='Import failed: '+error.message;render();}}
  finally{$('deckFile').value='';}
});

async function readOffice(){
  if(busy)return;busy=true;const current=generation;
  try{const text=await readWord();if(current!==generation)return;
    $('draft').value=text;$('full').checked=true;
    $('status').textContent=`Word document body: ${text.length.toLocaleString()} characters. Read ${new Date().toLocaleTimeString()}. Headers, footers, and comments are outside this check.`;render();
  }catch(error){if(current===generation){$('draft').value='';$('full').checked=false;$('status').textContent='Word read failed: '+error.message;render();}}
  finally{busy=false;}
}
setupReview(render,()=>({version:'0.5.1',meetingType:$('type').value,minutesCoverage:$('full').checked?'full body supplied':'partial or unconfirmed',slidesSource:$('slidesStatus').textContent,issues:lastIssues,comparison:lastComparison,notice:'Advisory review; no certification of completeness or accuracy.'}));
if(officeHost){
  $('connect').disabled=true;
  if(globalThis.Office)Office.onReady(info=>{
    if(info.host!==Office.HostType.Word){$('status').textContent='Open this add-in inside Word.';return;}
    if(!Office.context.requirements.isSetSupported('WordApi','1.1')){$('status').textContent='This Word version does not support the required document API.';return;}
    $('connect').disabled=false;$('status').textContent='Word is connected. Start live review to read the document body.';
  });
  else $('status').textContent='Microsoft Office.js did not load. Check your connection and open the add-in through Word.';
}
