export async function readWord(WordApi=globalThis.Word){
  if(!WordApi)throw Error('Open this pane through the Word add-in.');
  return WordApi.run(async context=>{const body=context.document.body;body.load('text');await context.sync();return body.text.replace(/\r\n?/g,'\n');});
}
export async function applyWordSuggestion(original,replacement,WordApi=globalThis.Word){
  if(!original||original===replacement||original.length>250)throw Error('Select a short, specific correction.');
  return WordApi.run(async context=>{
    const matches=context.document.body.search(original,{matchCase:true,matchWildcards:false});matches.load('items');await context.sync();
    if(matches.items.length!==1)throw Error('The original text changed or occurs more than once. Refresh and edit this sentence in Word.');
    matches.items[0].insertText(replacement,'Replace');await context.sync();
  });
}
