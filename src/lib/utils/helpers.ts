export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function cleanText(text: string): string {
    return text
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s-.,]/g, '')
        .trim();
}

export function isValidPhone(phone: string): boolean {
    return /^\+?[\d-.()\s]{10,}$/.test(phone);
}

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
} 