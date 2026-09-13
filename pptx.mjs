const MAX=24*1024*1024;
export async function readZip(buffer){
  if(buffer.byteLength>80*1024*1024)throw Error('Deck exceeds the 80 MB import limit.');
  const bytes=new Uint8Array(buffer),v=new DataView(buffer),decoder=new TextDecoder();
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===bytes.length){end=i;break;}
  if(end<0)throw Error('Not a supported PPTX ZIP file.');
  const count=v.getUint16(end+10,true),entries=new Map();let pos=v.getUint32(end+16,true),total=0;
  if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||count===65535)throw Error('Multipart and ZIP64 decks are not supported.');
  for(let i=0;i<count;i++){
    if(pos+46>end||v.getUint32(pos,true)!==0x02014b50)throw Error('Invalid ZIP directory.');
    const flags=v.getUint16(pos+8,true),method=v.getUint16(pos+10,true),compressed=v.getUint32(pos+20,true),size=v.getUint32(pos+24,true),nl=v.getUint16(pos+28,true),el=v.getUint16(pos+30,true),cl=v.getUint16(pos+32,true),offset=v.getUint32(pos+42,true);
    const name=decoder.decode(bytes.subarray(pos+46,pos+46+nl));
    if(entries.has(name))throw Error('Duplicate ZIP entries.');
    entries.set(name,{flags,method,compressed,size,offset});pos+=46+nl+el+cl;
  }
  return async name=>{
    const e=entries.get(name);if(!e)throw Error('Missing presentation part: '+name);
    if(e.flags&1||![0,8].includes(e.method)||e.size>MAX||total+e.size>MAX)throw Error('Encrypted, oversized, or unsupported presentation part.');
    if(e.offset+30>bytes.length||v.getUint32(e.offset,true)!==0x04034b50)throw Error('Invalid ZIP entry.');
    const start=e.offset+30+v.getUint16(e.offset+26,true)+v.getUint16(e.offset+28,true);
    if(start+e.compressed>bytes.length)throw Error('Truncated ZIP entry.');
    let result=bytes.slice(start,start+e.compressed);
    if(e.method===8){
      const reader=new Blob([result]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
      const chunks=[];let length=0;
      while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>e.size||length>MAX){await reader.cancel();throw Error('Decompressed part exceeds size limit.');}chunks.push(value);}
      result=new Uint8Array(length);let p=0;for(const chunk of chunks){result.set(chunk,p);p+=chunk.length;}
    }
    if(result.length!==e.size)throw Error('Presentation part size mismatch.');total+=result.length;
    return decoder.decode(result);
  };
}
export async function importPptx(buffer,parseXml=source=>{
  if(/<!DOCTYPE|<!ENTITY/i.test(source))throw Error('Unsupported XML declarations.');
  const doc=new DOMParser().parseFromString(source,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw Error('Invalid presentation XML.');
  const convert=node=>({name:node.localName,ns:node.namespaceURI,attrs:Object.fromEntries([...node.attributes||[]].map(a=>[a.name,a.value])),text:node.textContent,children:[...node.children||[]].map(convert)});
  return convert(doc.documentElement);
}){
  const read=await readZip(buffer),presentation=parseXml(await read('ppt/presentation.xml')),rels=parseXml(await read('ppt/_rels/presentation.xml.rels'));
  const descendants=(node,name)=>[...(node.name===name?[node]:[]),...node.children.flatMap(c=>descendants(c,name))];
  const relationships=new Map(descendants(rels,'Relationship').map(r=>[r.attrs.Id,r.attrs]));
  const ids=descendants(presentation,'sldId');if(!ids.length)throw Error('No slides found.');
  const slides=[];
  for(const [i,id] of ids.entries()){
    const rid=Object.entries(id.attrs).find(([key])=>key.endsWith(':id'))?.[1];
    const rel=relationships.get(rid);
    if(!rel||rel.TargetMode==='External'||!rel.Type?.endsWith('/slide'))throw Error('Invalid slide relationship.');
    const parts=[];for(const segment of (rel.Target.startsWith('/')?rel.Target.slice(1):'ppt/'+rel.Target).split('/')){if(segment==='..')parts.pop();else if(segment&&segment!=='.')parts.push(segment);}
    const path=parts.join('/');if(!path.startsWith('ppt/'))throw Error('Invalid slide path.');
    const slide=parseXml(await read(path));
    const paragraphs=descendants(slide,'p').filter(p=>p.ns?.includes('drawingml')||p.ns?.includes('/drawingml/')).map(p=>descendants(p,'t').map(t=>t.text).join('')).filter(t=>t.trim());
    slides.push({number:i+1,text:paragraphs.join('\n'),hidden:slide.attrs.show==='0',images:descendants(slide,'pic').length});
  }
  return {slides,text:slides.map(s=>`[Slide ${s.number}${s.hidden?' · hidden':''}]\n${s.text}`).join('\n\n')};
}
