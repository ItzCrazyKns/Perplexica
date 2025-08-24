// Reader/Extractor prompt for concise structured outputs
export const readerExtractorPrompt = `
You extract key facts and quotes with provenance from readable content.
Return compact JSON: {"facts": string[], "quotes": string[], "provenance": {"url": string, "title": string}, "confidence": number}
Keep facts short; limit quotes to critical sentences.`;
