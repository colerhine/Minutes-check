const stopwords=new Set('a an the of to for in on at and or is are was were be been will would should can could this that it we you i he she they my our your his her their has have had do does did with from out up by as so need needs please all report reports todo'.split(' '));
const tokens=text=>new Set((text.toLowerCase().match(/[a-z]+|\d+(?:[.:]\d+)?/g)||[]).filter(x=>!stopwords.has(x)));
const numbers=text=>text.match(/\d+(?:[.:]\d+)?/g)||[];
export function compareSlides(slides,minutes){
  if(!slides.trim()||!minutes.trim())return [];
  const lines=minutes.split(/\n|(?<=[.!?])\s+/).map(text=>({text,words:tokens(text)})).filter(x=>x.words.size);
  const output=[],seen=new Set();let slide=null;
  slides.split(/\r?\n/).forEach((raw,i)=>{
    const marker=raw.match(/^\[Slide (\d+)/);if(marker){slide=Number(marker[1]);return;}
    const text=raw.trim().replace(/^[•●○▪\-\s]+/,''),words=tokens(text),key=[...words].join(' ');
    if(/^\[Slide \d+/.test(text)||words.size<2||seen.has(key)||/^(?:https?:|[^\s]+@)/i.test(text))return;
    seen.add(key);
    if(/\b(?:quiz(?:zes)?|pledges?|gig[ -]?books?|paddles?|hazing|drugs?|underage drinking|project days?|Christmas party)\b/i.test(text)){
      output.push({line:i+1,slide,excerpt:text,title:'Review source against your rules',message:'Do not copy this automatically. Apply your terminology and detail rules while preserving an accurate record.'});return;
    }
    let best={score:0,text:''};
    for(const candidate of lines){const score=[...words].filter(w=>candidate.words.has(w)).length/words.size;if(score>best.score)best={score,text:candidate.text};}
    const absent=numbers(text).filter(n=>!numbers(best.text).includes(n));
    if(best.score<0.65)output.push({line:i+1,slide,excerpt:text,closest:best.text,score:best.score,title:'Possibly missing or reworded',message:'No close wording match in the supplied minutes. Decide whether this is relevant and already recorded elsewhere.'});
    else if(absent.length)output.push({line:i+1,slide,excerpt:text,closest:best.text,score:best.score,title:'Check a number or time',message:`Closest match: “${best.text}”. Source numbers not found there: ${[...new Set(absent)].join(', ')}. Confirm rather than copy automatically.`});
  });return output;
}
