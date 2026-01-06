export const extractBillNumber = (text) => {
  if (typeof text !== "string") return null;

  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  // Flexible keywords - look for these terms
  const keywordPatterns = [
    /receipt[\s\-]?no\.?[:.\s]*/i,
    /receipt[\s\-]?number[:.\s]*/i,
    /invoice[\s\-]?no\.?[:.\s]*/i,
    /bill[\s\-]?no\.?[:.\s]*/i,
    /bill[\s\-]?number[:.\s]*/i,
    /rech\.?\s*nr\.?[:.\s]*/i,  // German: Rechnung Nummer
    /transaction[\s\-]?id[:.\s]*/i,
    /order[\s\-]?(no|number|id)[:.\s]*/i,
    /ref[\s\-]?(no|number)?[:.\s]*/i,
    /number[:.\s]*\d+/i,  // Catch "Number:8" format
  ];
  
  // Patterns to exclude
  const excludePatterns = [
    /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/, // dates
    /\d{1,2}:\d{2}/, // times
    /^[£₹$€]\s*\d+/, // currency amounts
    /^\d+\.\d{2}$/, // decimal amounts
    /^(GST|PAN|TAN|CIN|GSTIN|FSSAI|MwSt)[\s:]/i, // tax IDs
    /^\d{10,}$/, // phone numbers (10+ digits)
  ];

  let candidates = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || "";
    
    // Check if line matches any keyword pattern
    let foundKeyword = false;
    for (const pattern of keywordPatterns) {
      if (pattern.test(line)) {
        foundKeyword = true;
        
        // Try to extract directly from the same line first
        const afterKeyword = line.replace(pattern, '').trim();
        if (afterKeyword) {
          // Extract potential bill number from remaining text
          const match = afterKeyword.match(/^([A-Z0-9\-\/]+)/i);
          if (match && match[1]) {
            const token = match[1];
            if (/\d/.test(token) && token.length >= 2) {
              if (!excludePatterns.some(p => p.test(token))) {
                candidates.push({ 
                  token, 
                  score: 10, // Highest score for same-line extraction
                  length: token.length 
                });
              }
            }
          }
        }
        
        // Also check next line
        if (nextLine && !afterKeyword) {
          const tokens = nextLine.match(/\b[A-Z0-9\-\/]{2,}\b/gi) || [];
          tokens.forEach(token => {
            if (/\d/.test(token) && !excludePatterns.some(p => p.test(token))) {
              candidates.push({ token, score: 8, length: token.length });
            }
          });
        }
        
        break;
      }
    }
  }

  // Fallback: look for patterns that resemble bill numbers
  if (!candidates.length) {
    lines.forEach((line) => {
      // Look for "Number:" followed by digits
      const numberMatch = line.match(/number\s*:?\s*(\d+)/i);
      if (numberMatch) {
        candidates.push({ token: numberMatch[1], score: 5, length: numberMatch[1].length });
      }
      
      // Look for alphanumeric codes with letters and numbers
      const tokens = line.match(/\b[A-Z]{2,}\d{3,}\b/gi) || 
                     line.match(/\b\d{2,}[A-Z]{2,}\b/gi) ||
                     line.match(/\b[A-Z]\d{6,}\b/gi) || [];
      
      tokens.forEach(token => {
        if (!excludePatterns.some(p => p.test(token))) {
          candidates.push({ token, score: 3, length: token.length });
        }
      });
    });
  }

  if (!candidates.length) return null;

  // Remove duplicates
  const uniqueCandidates = [];
  const seen = new Set();
  candidates.forEach(c => {
    if (!seen.has(c.token)) {
      seen.add(c.token);
      uniqueCandidates.push(c);
    }
  });

  // Sort by score first, then length
  uniqueCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.length - a.length;
  });

  console.log(uniqueCandidates)
  return uniqueCandidates[0].token;
};