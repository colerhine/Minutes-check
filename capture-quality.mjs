export function usableCapture(text, title='') {
  const normalizedTitle=title.replace(/\.(?:pptx?|docx?)\b.*$/i,'').trim().toLowerCase();
  if(/Document Contents[\s\S]*Press F2 to Leave[\s\S]*Editing Area/i.test(text))return false;
  const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(s=>/[a-z]{2}/i.test(s)&&s.toLowerCase()!==normalizedTitle&&!/^\d.*chapter slides(?:\.pptx)?$/i.test(s));
  // Deliberately conservative: title-only/current empty slides are not reports.
  return lines.length>=2 && lines.join(' ').split(/\s+/).length>=12;
}
