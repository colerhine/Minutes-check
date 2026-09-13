export const defaultOfficers=['Prytanis','Epiprytanis','Grammateus','Crysophylos','Histor','Hypophetes','Pylortes','Hegemon','Rush Chairman','House Manager','PR and Brotherhood Coordinator'];
export const defaults={version:1,chapter:'Beta-Eta',officers:defaultOfficers,roster:[],terms:[]};
export function validateSettings(value){
  if(!value||value.version!==1||typeof value.chapter!=='string'||value.chapter.length>100)throw Error('Invalid chapter settings.');
  if(!Array.isArray(value.officers)||value.officers.length>60||value.officers.some(s=>typeof s!=='string'||!s.trim()||s.length>100))throw Error('Officer titles must be a list of short names.');
  if(!Array.isArray(value.terms)||value.terms.length>100||value.terms.some(r=>!r||typeof r.term!=='string'||!r.term.trim()||r.term.length>100||typeof r.message!=='string'||r.message.length>500))throw Error('Each custom term needs a term and a review message.');
  if(!Array.isArray(value.roster)||value.roster.length>100||value.roster.some(r=>!r||['role','name','email'].some(k=>typeof r[k]!=='string'||r[k].length>150)))throw Error('Roster entries need role, name, and email strings.');
  return {version:1,chapter:value.chapter,officers:[...value.officers],terms:value.terms.map(r=>({term:r.term,message:r.message})),roster:value.roster.map(r=>({role:r.role,name:r.name,email:r.email}))};
}
export function loadSettings(storage){try{return validateSettings(JSON.parse(storage.getItem('minutes-settings')))}catch{return structuredClone(defaults)}}
export function suggestion(issue){
  if(!issue.excerpt||!['Spelling','Possible typo'].includes(issue.title))return null;
  const substitutions=[[/\bcommitee\b/gi,'committee'],[/\bloking\b/gi,'looking'],[/\bsqeatshirt\b/gi,'sweatshirt'],[/\broster from\b/gi,'roster form'],[/\battendance forum\b/gi,'Attendance Form']];
  let revised=issue.excerpt;for(const [pattern,replacement]of substitutions)revised=revised.replace(pattern,replacement);
  return revised!==issue.excerpt?revised:null;
}
