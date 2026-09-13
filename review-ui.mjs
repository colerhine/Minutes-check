import {loadSettings,validateSettings,defaults,suggestion} from './settings.mjs';
import {applyWordSuggestion} from './office.mjs';
let profileStorage;try{profileStorage=globalThis.localStorage;}catch{}
export let settings=loadSettings(profileStorage);
export const decisions=new Map();
export function download(name,text,type='text/plain'){
  const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function issueActions(el,issue,onChange){
  if(issue.slide){const tag=document.createElement('p');tag.textContent=`Source slide ${issue.slide}`;el.prepend(tag);}
  if(issue.closest){const p=document.createElement('p');p.textContent='Closest minutes text: '+issue.closest;el.append(p);}
  const revised=suggestion(issue);
  if(revised){
    const p=document.createElement('p');p.textContent='Suggested wording: '+revised;el.append(p);
    if(document.body.dataset.host==='word'){
      const button=document.createElement('button');button.textContent='Apply this correction in Word';
      button.onclick=async()=>{button.disabled=true;try{await applyWordSuggestion(issue.excerpt,revised);p.textContent='Correction applied. The next read will refresh this finding.';}catch(e){p.textContent=e.message;}finally{button.disabled=false;}};el.append(button);
    }
  }
  const key=JSON.stringify([issue.title,issue.excerpt,issue.message]);
  const select=document.createElement('select');select.setAttribute('aria-label','Review decision for '+issue.title);
  for(const [value,label]of [['','Needs review'],['recorded','Already recorded'],['irrelevant','Not relevant to minutes'],['confirmed','Reviewed and confirmed']])select.add(new Option(label,value));
  select.value=decisions.get(key)||'';select.onchange=()=>{decisions.set(key,select.value);};el.append(select);
}
export function setupReview(onChange,getReport){
  const section=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Chapter settings and handoff';section.append(summary);
  const p=document.createElement('p');p.textContent='Edit chapter name, officer titles, roster, and custom term reminders. Settings stay in this browser; exports can be given to the next Grammateus.';section.append(p);
  const area=document.createElement('textarea');area.value=JSON.stringify(settings,null,2);area.setAttribute('aria-label','Chapter settings JSON');area.style.height='300px';section.append(area);
  const status=document.createElement('p');status.setAttribute('role','status');
  const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;section.append(b);};
  button('Save settings',()=>{try{settings=validateSettings(JSON.parse(area.value));profileStorage?.setItem('minutes-settings',JSON.stringify(settings));status.textContent=profileStorage?'Settings saved.':'Settings applied for this session; browser storage is unavailable.';onChange();}catch(e){status.textContent=e.message;}});
  button('Export settings',()=>download('minutes-settings.json',JSON.stringify(settings,null,2),'application/json'));
  const input=document.createElement('input');input.type='file';input.accept='.json';input.setAttribute('aria-label','Import chapter settings');input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>100000)throw Error('Settings file too large.');const validated=validateSettings(JSON.parse(await file.text()));area.value=JSON.stringify(validated,null,2);status.textContent='Imported for review. Click Save settings to use them.';}catch(e){status.textContent=e.message;}finally{input.value='';}};section.append(input);
  button('Restore defaults',()=>{area.value=JSON.stringify(defaults,null,2);status.textContent='Defaults loaded for review; click Save settings to use them.';});section.append(status);
  document.querySelector('main').append(section);
  const exportButton=document.createElement('button');exportButton.textContent='Download review report';exportButton.onclick=()=>download('minutes-review.json',JSON.stringify({...getReport(),reviewedAt:new Date().toISOString(),decisions:[...decisions]},null,2),'application/json');section.before(exportButton);
  button('Download minutes template',()=>download('minutes-template.txt',`${settings.chapter} Meeting Minutes
Date: [confirm]
Meeting opened by [name] at [time].
Attendance / Present: [confirm]
Unexcused Absences: [confirm]

Officer Reports
${settings.officers.map(role=>role+' — [current officer]\n[report or confirmed No report]').join('\n\n')}

Committee Reports
[current committees and reports]

Old Business
[proposal, decision, conditions, and outcome]

New Business
[proposal, decision, conditions, and outcome]

TKE of the Week: [confirm]
Joe of the Week: [confirm]
Jerry of the Week: [confirm]

Announcements
[relevant announcements]

Meeting closed by [name] at [time].
Respectfully submitted by [Grammateus].
`));
}
