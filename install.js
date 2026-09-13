import {manifestForSite} from './install-manifest.mjs';
const status=document.getElementById('status');
document.getElementById('install').addEventListener('click',()=>{
  try{
    const xml=manifestForSite(location.href);
    const url=URL.createObjectURL(new Blob([xml],{type:'application/xml'}));
    const a=document.createElement('a');a.href=url;a.download='minutes-check-word.xml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent='Downloaded minutes-check-word.xml. Upload that file inside Word using Home → Add-ins → More Settings → Upload My Add-in.';
  }catch(e){status.textContent=e.message;}
});
