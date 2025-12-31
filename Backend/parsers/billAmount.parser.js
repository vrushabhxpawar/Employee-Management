export const extractTotalAmount = (text) => {
  if (typeof text !== "string") return null;

  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  // Keywords that indicate total/final amount
  const totalKeywords = /\b(total|grand total|net|amount paid|cash|bill amount|to pay|sum)\b/i;
  
  let candidates = [];

  // Helper function to extract amounts from a line
  const extractAmounts = (text, context = "", lineIndex = 0) => {
    const amounts = [];
    
    // Match various currency formats
    const patterns = [
      // Currency symbol followed by amount
      { regex: /[£₹$€]\s*([\d,]+\.?\d*)/g, priority: 2 },
      { regex: /Rs\.?\s*([\d,]+\.?\d*)/gi, priority: 2 },
      { regex: /CHF\s*([\d,]+\.?\d*)/gi, priority: 2 },
      { regex: /INR\s*([\d,]+\.?\d*)/gi, priority: 2 },
      { regex: /EUR\s*([\d,]+\.?\d*)/gi, priority: 2 },
      
      // Standalone decimal amounts
      { regex: /\b([\d,]+\.\d{2})\b/g, priority: 1 },
      
      // Whole numbers (2+ digits, not part of date/time)
      { regex: /(?<![:\d])\b(\d{2,})\b(?![:\d])/g, priority: 0 },
    ];

    patterns.forEach(({ regex, priority }) => {
      const matches = text.matchAll(regex);
      for (const match of matches) {
        const numStr = match[1].replace(/,/g, '');
        const num = parseFloat(numStr);
        if (!isNaN(num) && num > 0) {
          amounts.push({ 
            value: num, 
            context, 
            priority,
            lineIndex 
          });
        }
      }
    });

    return amounts;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || "";

    // Priority 1: Line with total keyword
    if (totalKeywords.test(line)) {
      const amounts = extractAmounts(line, "total_keyword", i);
      amounts.forEach(a => candidates.push({ ...a, score: 10 + a.priority }));

      // Check next line
      const nextAmounts = extractAmounts(nextLine, "total_next", i + 1);
      nextAmounts.forEach(a => candidates.push({ ...a, score: 9 + a.priority }));
    }

    // Priority 2: Last 5 lines (totals usually at bottom)
    if (i >= lines.length - 5) {
      const amounts = extractAmounts(line, "bottom", i);
      amounts.forEach(a => candidates.push({ ...a, score: 4 + a.priority }));
    }
  }

  // Fallback: find all amounts
  if (!candidates.length) {
    lines.forEach((line, idx) => {
      const amounts = extractAmounts(line, "fallback", idx);
      amounts.forEach(a => {
        const positionScore = idx > lines.length * 0.7 ? 2 : 1;
        candidates.push({ ...a, score: positionScore + a.priority });
      });
    });
  }

  if (!candidates.length) return null;

  // Filter unrealistic amounts
  candidates = candidates.filter(c => {
    return c.value >= 0.5 && c.value <= 1000000;
  });

  if (!candidates.length) return null;

  // Remove duplicate values, keeping highest score
  const valueMap = new Map();
  candidates.forEach(c => {
    if (!valueMap.has(c.value) || valueMap.get(c.value).score < c.score) {
      valueMap.set(c.value, c);
    }
  });
  candidates = Array.from(valueMap.values());

  // Sort by score, then by value
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.value - a.value;
  });

  return candidates[0].value;
};