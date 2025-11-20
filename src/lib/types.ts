type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type Chunk = {
  content: string;
  metadata: Record<string, any>;
};

type Artifact = {
  id: string;
  type: string;
  data: any;
};
