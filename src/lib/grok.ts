export const transcribeWithGrok = async (blob: Blob): Promise<string> => {
  const form = new FormData();
  form.append('file', blob, 'recording.webm');

  const res = await fetch('/api/grok/transcribe', {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const data = (await res.json()) as { text: string };
  return data.text;
};
