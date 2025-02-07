import { OllamaService } from './ollamaService';

interface ValidatedBusinessData {
  name: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  hours?: string;
  isValid: boolean;
}

export class DataValidationService {
  private ollama: OllamaService;

  constructor() {
    this.ollama = new OllamaService();
  }

  async validateAndCleanData(rawText: string): Promise<ValidatedBusinessData> {
    try {
      const prompt = `
        You are a business data validation expert. Extract and validate business information from the following text.
        Return ONLY a JSON object with the following format, nothing else:
        {
          "name": "verified business name",
          "phone": "formatted phone number or N/A",
          "email": "verified email address or N/A",
          "address": "verified physical address or N/A",
          "description": "short business description",
          "hours": "business hours if available",
          "isValid": boolean
        }

        Rules:
        1. Phone numbers should be in (XXX) XXX-XXXX format
        2. Addresses should be properly formatted with street, city, state, zip
        3. Remove any irrelevant text from descriptions
        4. Set isValid to true only if name and at least one contact method is found
        5. Clean up any obvious formatting issues
        6. Validate email addresses for proper format

        Text to analyze:
        ${rawText}
      `;

      const response = await this.ollama.generateResponse(prompt);
      
      try {
        // Find the JSON object in the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        
        const result = JSON.parse(jsonMatch[0]);
        return this.validateResult(result);
      } catch (parseError) {
        console.error('Failed to parse Ollama response:', parseError);
        throw parseError;
      }
    } catch (error) {
      console.error('Data validation failed:', error);
      return {
        name: 'Unknown',
        phone: 'N/A',
        email: 'N/A',
        address: 'N/A',
        description: '',
        hours: '',
        isValid: false
      };
    }
  }

  private validateResult(result: any): ValidatedBusinessData {
    // Ensure all required fields are present
    const validated: ValidatedBusinessData = {
      name: this.cleanField(result.name) || 'Unknown',
      phone: this.formatPhone(result.phone) || 'N/A',
      email: this.cleanField(result.email) || 'N/A',
      address: this.cleanField(result.address) || 'N/A',
      description: this.cleanField(result.description) || '',
      hours: this.cleanField(result.hours),
      isValid: Boolean(result.isValid)
    };

    return validated;
  }

  private cleanField(value: any): string {
    if (!value || typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ');
  }

  private formatPhone(phone: string): string {
    if (!phone || phone === 'N/A') return 'N/A';
    
    // Extract digits
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    }
    
    return phone;
  }
} 