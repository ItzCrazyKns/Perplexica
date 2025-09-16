export interface Prompt {
  id: string;
  name: string;
  content: string;
  type: 'system' | 'persona';
  createdAt: Date;
  updatedAt: Date;
  // Indicates if the prompt is read-only (cannot be edited or deleted)
  readOnly?: boolean;
}
