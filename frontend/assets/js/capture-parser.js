// Rule-Based Quick SMS & Bank Text Parser for FinWise (Pocket Clear style)

const QuickCaptureParser = {
  // Category keywords dictionary for instant mapping
  CATEGORY_KEYWORDS: {
    'Food & Dining': [
      'swiggy', 'zomato', 'starbucks', 'mcdonald', 'kfc', 'burger', 'cafe', 
      'restaurant', 'pizza', 'coffee', 'chai', 'food', 'dining', 'bakery', 'eats'
    ],
    'Transportation': [
      'uber', 'ola', 'rapido', 'metro', 'fuel', 'petrol', 'diesel', 'gas', 
      'toll', 'train', 'irctc', 'flight', 'parking', 'taxi', 'transit'
    ],
    'Shopping': [
      'amazon', 'flipkart', 'myntra', 'zara', 'h&m', 'store', 'mart', 
      'market', 'mall', 'retail', 'clothing', 'supermarket', 'blinkit', 'zepto', 'instamart'
    ],
    'Entertainment': [
      'netflix', 'spotify', 'prime', 'movie', 'cinema', 'pvr', 'inox', 
      'theatre', 'disney', 'hotstar', 'youtube', 'apple', 'game', 'steam'
    ],
    'Utilities': [
      'electricity', 'water', 'wifi', 'broadband', 'airtel', 'jio', 'vi', 
      'recharge', 'bill', 'bescom', 'power', 'dth'
    ],
    'Healthcare': [
      'pharmacy', 'apollo', 'hospital', 'clinic', 'medical', 'doctor', 
      'medicine', '1mg', 'pharmeasy', 'medplus', 'health'
    ],
    'Housing': [
      'rent', 'maintenance', 'landlord', 'society', 'mortgage', 'lease'
    ],
    'Salary': [
      'salary', 'payroll', 'stipend', 'bonus', 'wages', 'employer'
    ],
    'Investments': [
      'zerodha', 'groww', 'mutual fund', 'stocks', 'sip', 'etf', 'crypto', 'coin'
    ]
  },

  parse(rawText, availableCategories = []) {
    if (!rawText || typeof rawText !== 'string') {
      return null;
    }

    const text = rawText.trim();

    // 1. Detect Type (Expense vs Income)
    const lower = text.toLowerCase();
    let type = 'expense';
    const incomeKeywords = ['credited', 'credit', 'received', 'deposited', 'salary', 'refund', 'cashback', 'added to'];
    const expenseKeywords = ['debited', 'debit', 'paid', 'spent', 'sent', 'transferred to', 'purchase', 'withdrawn', 'charged'];

    for (const kw of incomeKeywords) {
      if (lower.includes(kw)) {
        type = 'income';
        break;
      }
    }

    // 2. Extract Amount
    let amount = null;
    // Patterns like: Rs. 450.00, INR 1,200.50, ₹450, $34.99, USD 25, 450.00 debited/spent
    const amountPatterns = [
      /(?:rs\.?|inr|₹|\$|usd|eur|€)\s*([\d,]+(?:\.\d{1,2})?)/i,
      /(?:debited(?:\s+by)?|spent|paid|credited(?:\s+with)?|transferred|amount)\s*(?:rs\.?|inr|₹|\$|usd)?\s*([\d,]+(?:\.\d{1,2})?)/i,
      /([\d,]+(?:\.\d{1,2})?)\s*(?:debited|spent|paid|credited)/i,
      /\b([\d,]+\.\d{2})\b/
    ];

    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cleaned = match[1].replace(/,/g, '');
        const parsedNum = parseFloat(cleaned);
        if (!isNaN(parsedNum) && parsedNum > 0) {
          amount = parsedNum;
          break;
        }
      }
    }

    // 3. Extract Date
    let dateStr = new Date().toISOString().split('T')[0]; // Default to today
    
    // Check ISO: 2026-09-30
    const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (isoMatch) {
      dateStr = isoMatch[1];
    } else {
      // Check: 30-Sep-2026 or 30-Sep-26 or 30 Sep 2026
      const monthNames = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      };
      const textDateMatch = text.match(/\b(\d{1,2})[- ](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[- ](\d{2,4})\b/i);
      if (textDateMatch) {
        const day = textDateMatch[1].padStart(2, '0');
        const month = monthNames[textDateMatch[2].toLowerCase().substring(0, 3)];
        let year = textDateMatch[3];
        if (year.length === 2) year = '20' + year;
        dateStr = `${year}-${month}-${day}`;
      } else {
        // Check: 29/09/2026 or 29-09-2026
        const slashMatch = text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
        if (slashMatch) {
          const day = slashMatch[1].padStart(2, '0');
          const month = slashMatch[2].padStart(2, '0');
          let year = slashMatch[3];
          if (year.length === 2) year = '20' + year;
          dateStr = `${year}-${month}-${day}`;
        }
      }
    }

    // 4. Extract Merchant / Note / Description
    let description = '';
    const merchantPatterns = [
      /(?:at|to|for|from|spent on)\s+([A-Za-z0-9\s&'.\-]+?)(?:\s+on|\s+ref|\s+avl|\s+bal|\s+upi|\.|$)/i,
      /(?:vpa|upi\s+ref|merchant)\s*[:\-]?\s*([A-Za-z0-9\s&'.\-]+?)(?:\s+on|\.|$)/i
    ];

    for (const pattern of merchantPatterns) {
      const m = text.match(pattern);
      if (m && m[1]) {
        let clean = m[1].trim();
        // Remove common trailer words
        clean = clean.replace(/^(the|a)\s+/i, '');
        if (clean.length >= 2 && clean.length <= 40) {
          description = clean;
          break;
        }
      }
    }

    if (!description) {
      // Fallback: take first 30 chars or generic note
      description = type === 'income' ? 'Income Deposit' : 'Card / Bank Expense';
    }

    // 5. Suggest Category
    let categoryId = null;
    let categoryName = null;
    const descLower = (description + ' ' + text).toLowerCase();

    for (const [catName, keywords] of Object.entries(this.CATEGORY_KEYWORDS)) {
      if (keywords.some((kw) => descLower.includes(kw))) {
        const found = availableCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        if (found) {
          categoryId = found.id;
          categoryName = found.name;
          break;
        }
      }
    }

    // If no category matched, pick first appropriate default
    if (!categoryId && availableCategories.length > 0) {
      if (type === 'income') {
        const sal = availableCategories.find(c => c.name.toLowerCase().includes('salary') || c.name.toLowerCase().includes('income'));
        if (sal) { categoryId = sal.id; categoryName = sal.name; }
      } else {
        const misc = availableCategories.find(c => c.name.toLowerCase().includes('other') || c.name.toLowerCase().includes('miscellaneous')) || availableCategories[0];
        if (misc) { categoryId = misc.id; categoryName = misc.name; }
      }
    }

    return {
      amount,
      type,
      date: dateStr,
      description,
      categoryId,
      categoryName
    };
  }
};

window.QuickCaptureParser = QuickCaptureParser;
