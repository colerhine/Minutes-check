import {defaultOfficers} from './settings.mjs';
export function checkMinutes(text, {full = false, type = 'chapter', settings = {officers:defaultOfficers,terms:[],roster:[]}} = {}) {
  const issues = [];
  const add = (title, message, line, excerpt = '') => issues.push({title, message, line, excerpt});
  const rules = [
    [/\b(?:pledges?|pledged|pledging)\b/i, 'Terminology', 'Your checklist excludes this term. Use “new members” or “freshmen” where factually appropriate.'],
    [/\b(?:gig[\s-]*books?|paddles?)\b/i, 'Terminology', 'Your checklist uses “requirements.” Confirm the wording preserves the meaning.'],
    [/\bquiz(?:zes)?\b/i, 'Quiz reference', 'Your checklist excludes quiz references. Review this entry.'],
    [/\b(?:hazing|drugs?|under[\s-]*age[\s-]+drinking)\b/i, 'Sensitive subject', 'Review this entry for accuracy and appropriate handling. Do not disguise or falsify an incident.'],
    [/\bproject[\s-]+days?\b/i, 'Project-day entry', 'Check that this entry contains only the date and start time, per your checklist. Review any following bullets too.'],
    [/\bChristmas[\s-]+part(?:y|ies)\b/i, 'Event details', 'Your checklist limits this event to its date and time.'],
    [/\b(?:lock in|keep up the grind|anything else .*tells me|chauffeured)\b/i, 'Formal wording', 'Replace informal wording with the specific relevant action, or omit irrelevant commentary.'],
    [/\bproductive hours\b/i, 'Unclear wording', 'Explain what this means accurately before deciding how to record it.'],
    [/\b(?:tomorrow|next week|next monday|this wednesday)\b/i, 'Relative date', 'Consider using the actual date so this remains clear after the meeting.']
  ];
  const typos = {commitee:'committee',loking:'looking',sqeatshirt:'sweatshirt'};
  text.split(/\r\n?|\n|\u2028|\u2029/).forEach((raw, i) => {
    const line = raw.trim();
    // Word can insert soft hyphens, invisible separators, and typographic dashes.
    // Normalize only matching text; preserve the original excerpt for review.
    const matchingLine = line.normalize('NFKC').replace(/[\u00ad\u200b\u200c\u200d\u2060\ufeff]/g, '').replace(/[\u2010-\u2015\u2212]/g, '-');
    if (!line) return;
    for(const rule of settings.terms||[])if(line.toLowerCase().includes(rule.term.toLowerCase()))add('Chapter rule',rule.message,i+1,line);
    for(const person of settings.roster||[]){
      if(person.role&&line.replace(/^[•●○▪\-\s]+/,'').toLowerCase().startsWith(person.role.toLowerCase())&&person.name&&!line.toLowerCase().includes(person.name.toLowerCase()))add('Check roster',`Expected ${person.role}: ${person.name}. Confirm the current officeholder.`,i+1,line);
    }

    for (const [pattern, title, message] of rules) {
      const matches = [...matchingLine.matchAll(new RegExp(pattern.source, 'gi'))];
      if (matches.length) add(title, `Found: ${[...new Set(matches.map(match=>match[0].toLowerCase()))].map(term=>`“${term}”`).join(', ')}. ${message}`, i+1, line);
    }
    for (const [wrong, right] of Object.entries(typos)) if (new RegExp(`\\b${wrong}\\b`, 'i').test(line)) add('Spelling', `Change “${wrong}” to “${right}”.`, i+1, line);
    if (/roster from\b/i.test(line)) add('Possible typo', 'Did you mean “roster form”?', i+1, line);
    if (/attendance forum\b/i.test(line)) add('Possible typo', 'Did you mean “Attendance Form”?', i+1, line);
    if (/unexcused absences\s*:\s*$/i.test(line)) add('Attendance incomplete', 'Enter the names, or “None” if confirmed.', i+1, line);
    if (/^\s*[•●○▪-]\s*$/.test(raw)) add('Empty bullet', 'Complete this entry or remove the empty bullet.', i+1, line);
  });
  if (full && text.trim()) {
    const sections = [
      [/\b(?:opened|called to order)\b/i, 'Opening statement'],
      [/\b(?:closed|adjourned)\b/i, 'Closing statement'],
      [/officer reports/i, 'Officer reports'], [/old business/i, 'Old business'], [/new business/i, 'New business'],
      [/respectfully submitted|submitted by/i, 'Submission statement'],
      [/\b(?:TKE|Teke) of the week\b/i, 'TKE of the Week'],
      [/\bJoe of the week\b/i, 'Joe of the Week'], [/\bJerry of the week\b/i, 'Jerry of the Week'],
      [type === 'officer' ? /\bpresent\s*:/i : /attendance/i, 'Attendance']
    ];
    for (const [pattern, name] of sections) if (!pattern.test(text)) add('Missing section', `${name} was not found. Add it if applicable; do not invent missing information.`);
    for (const name of settings.officers) {
      if (!text.toLowerCase().includes(name.toLowerCase())) add('Officer not found', `Check the ${name} report against your current roster.`);
    }
    for (const match of text.matchAll(/\b(TKE|Teke|Joe|Jerry) of the week\s*:[ \t]*([^\r\n]*)/gi)) {
      if (!match[2].trim()) add('Recognition incomplete', `${match[1]} of the Week has no recipient. Confirm the result.`);
    }
  }
  return issues;
}
