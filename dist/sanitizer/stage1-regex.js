const PATTERNS = {
    apiKeys: /(?:ghp_[a-zA-Z0-9]{10,}|sk-proj-[a-zA-Z0-9_-]{5,}|AKIA[0-9A-Z]{16})/i,
    grundfosEmail: /[a-zA-Z0-9._%+-]+@grundfos\.com/i,
    ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/,
    ipv6: /\b(?:[0-9a-fA-F]{1,4}:){2,}[0-9a-fA-F:]+\b|::1\b|\b(?:[0-9a-fA-F]{1,4}:)*:[0-9a-fA-F:]+\b/,
    filePath: /(?:\/[A-Za-z0-9_.-]+)+\/|[A-Za-z]:[\\\/][A-Za-z0-9_.\-\\\\]+|\\\\[A-Za-z0-9_.-]+\\[A-Za-z0-9_.-]+/,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/,
    creditCard: /\b(?:\d{4}[- ]?){3}\d{4}\b/
};
function luhnCheck(card) {
    const digits = card.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19)
        return false;
    let sum = 0;
    let isEven = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        const digitChar = digits[i];
        if (!digitChar)
            continue;
        let digit = parseInt(digitChar, 10);
        if (isEven) {
            digit *= 2;
            if (digit > 9)
                digit -= 9;
        }
        sum += digit;
        isEven = !isEven;
    }
    return sum % 10 === 0;
}
function validateCreditCard(card) {
    const digits = card.replace(/[-\s]/g, '');
    return luhnCheck(digits);
}
export function sanitizeStage1(content) {
    if (PATTERNS.apiKeys.test(content)) {
        return { blocked: true, reason: 'API key detected' };
    }
    if (PATTERNS.grundfosEmail.test(content)) {
        return { blocked: true, reason: 'grundfos email detected' };
    }
    if (PATTERNS.ssn.test(content)) {
        return { blocked: true, reason: 'SSN detected' };
    }
    const ccMatches = content.match(PATTERNS.creditCard);
    if (ccMatches && ccMatches.length > 0) {
        for (const match of ccMatches) {
            if (validateCreditCard(match)) {
                return { blocked: true, reason: 'credit card detected' };
            }
        }
    }
    if (PATTERNS.ipv4.test(content) || PATTERNS.ipv6.test(content)) {
        return { blocked: true, reason: 'IP address detected' };
    }
    if (PATTERNS.filePath.test(content)) {
        return { blocked: true, reason: 'file path detected' };
    }
    return { blocked: false, sanitized: content };
}
//# sourceMappingURL=stage1-regex.js.map