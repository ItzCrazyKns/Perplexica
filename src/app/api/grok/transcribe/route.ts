import { NextRequest } from 'next/server';

// Remove edge runtime to use Node.js runtime instead
// export const runtime = 'edge';

export async function POST(req: NextRequest) {
  console.log('=== Groq Transcribe API Called ===');
  
  const apiKey = process.env.GROK_API_KEY;
  console.log('API Key exists:', !!apiKey);
  console.log('API Key prefix:', apiKey ? apiKey.substring(0, 10) + '...' : 'undefined');
  
  if (!apiKey) {
    console.error('GROK_API_KEY not configured');
    return new Response('GROK_API_KEY not configured', { status: 500 });
  }

  try {
    console.log('Getting form data...');
    const formData = await req.formData();
    console.log('Form data keys:', Array.from(formData.keys()));
    
    const file = formData.get('file') as File;
    console.log('File info:', {
      name: file?.name,
      size: file?.size,
      type: file?.type
    });
    
    if (!file) {
      console.error('No file provided');
      return new Response('No file provided', { status: 400 });
    }

    // 首先测试 API 密钥是否有效
    console.log('Testing API key...');
    const testResponse = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('API key test failed:', testResponse.status, errorText);
      return new Response(`Invalid API key: ${errorText}`, { status: 401 });
    }

    console.log('API key is valid, proceeding with transcription...');

    // 创建新的 FormData 发送给 Groq
    const groqFormData = new FormData();
    groqFormData.append('file', file, file.name);
    groqFormData.append('model', 'whisper-large-v3-turbo');
    groqFormData.append('response_format', 'json');

    console.log('Sending request to Groq...');
    const grokRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: groqFormData,
    });

    console.log('Groq response status:', grokRes.status);

    if (!grokRes.ok) {
      const errorText = await grokRes.text();
      console.error('Groq API error:', grokRes.status, errorText);
      return new Response(`Groq API error: ${errorText}`, { status: grokRes.status });
    }

    const data = await grokRes.json();
    console.log('Groq response data:', data);
    
    return Response.json({ text: data.text });
  } catch (error) {
    console.error('Transcription error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(`Internal server error: ${errorMessage}`, { status: 500 });
  }
}