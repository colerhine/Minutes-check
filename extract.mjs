// Self-contained: Chrome serializes this function into each approved frame.
export function extract(role) {
  const scopes=[document];
  for(let i=0;i<scopes.length;i++) for(const el of scopes[i].querySelectorAll('*')) if(el.shadowRoot)scopes.push(el.shadowRoot);
  const all=scopes.flatMap(root=>[...root.querySelectorAll('*')]);
  const name=el=>{
    const direct=el.getAttribute('aria-label')||el.getAttribute('title');
    if(direct)return direct;
    return (el.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>el.getRootNode().getElementById?.(id)?.textContent||'').join(' ');
  };
  const roots=all.filter(el=>/document contents/i.test(name(el))||el.getAttribute('role')==='document');
  const collect=root=>{
    const seen=new Set();
    const walk=node=>{
      if(seen.has(node))return '';seen.add(node);
      if(node.nodeType===3)return node.textContent||'';
      if(node.nodeType!==1&&node.nodeType!==11)return '';
      if(node.matches?.('script,style,noscript,[role="toolbar"],[role="menu"],input'))return '';
      let children=[...node.childNodes];
      if(node.shadowRoot)children=[node.shadowRoot];
      // Some Office accessibility nodes own paragraphs outside their DOM parent.
      for(const id of (node.getAttribute?.('aria-owns')||'').split(/\s+/)){
        const owned=node.getRootNode().getElementById?.(id);if(owned)children.push(owned);
      }
      const body=children.map(walk).join('');
      const label=node.getAttribute?.('aria-label')||node.getAttribute?.('aria-description')||'';
      const usefulLabel=label&&!/^(?:decorative|group|shape|text box|document contents|page \d+)$/i.test(label.trim());
      const text=body.trim()?body:(usefulLabel?label:'');
      const block=/^(DIV|P|LI|SECTION|ARTICLE|BR|H[1-6])$/.test(node.tagName)||['paragraph','textbox'].includes(node.getAttribute?.('role'));
      return text+(block?'\n':'');
    };
    return walk(root).replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  };
  const candidates=roots.map(root=>({text:collect(root),kind:'document text and accessibility paragraphs (loaded content only)'}));
  // No page-body or filename fallback: unrelated interface text must not pass review.
  const fallback=all.filter(el=>el.matches('[contenteditable="true"],[role="textbox"][aria-multiline="true"]')&&!el.closest('[role="toolbar"],header')&&!/rename|file name/i.test(name(el)));
  for(const root of fallback)candidates.push({text:collect(root),kind:'editable region (partial)'});
  candidates.sort((a,b)=>b.text.length-a.text.length);
  return {candidates,diagnostic:{documentRegions:roots.length,editableRegions:fallback.length,largest:candidates[0]?.text.length||0}};
}
