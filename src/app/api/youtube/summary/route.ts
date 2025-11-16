import { NextResponse } from 'next/server';
import { z } from 'zod';
import { YoutubeTranscript } from 'youtube-transcript';
import ModelRegistry from '@/lib/models/registry';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  url: z.string().url(),
  chatModel: z.object({
    providerId: z.string().min(1, 'chatModel.providerId is required'),
    key: z.string().min(1, 'chatModel.key is required'),
  }),
});

const chunkSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 2000,
  chunkOverlap: 200,
});

const strParser = new StringOutputParser();

const MAX_CHUNKS = 12;

const extractVideoId = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.searchParams.has('v')) return parsed.searchParams.get('v');
      const pathMatch = parsed.pathname.match(/\/shorts\/([A-Za-z0-9_-]{6,})/);
      if (pathMatch?.[1]) return pathMatch[1];
    }
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ?? null;
    }
  } catch {
    return null;
  }
  return null;
};

const fetchMetadata = async (videoUrl: string) => {
  try {
    const oembed = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`,
    );
    if (!oembed.ok) return null;
    return (await oembed.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
  } catch {
    return null;
  }
};

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const parsed = requestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: 'Invalid request body',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { url, chatModel } = parsed.data;

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { message: 'Could not extract a YouTube video id from the provided URL.' },
        { status: 400 },
      );
    }

    let transcript;
    try {
      transcript = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (err) {
      console.error('[youtube-summary] Failed to fetch transcript:', err);
      return NextResponse.json(
        {
          message:
            'Unable to fetch video transcript. The video may not have captions available.',
        },
        { status: 502 },
      );
    }

    if (!transcript?.length) {
      return NextResponse.json(
        {
          message:
            'No transcript entries were returned for this video. Try a different video or enable captions.',
        },
        { status: 404 },
      );
    }

    const transcriptText = transcript
      .map((entry) => entry.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!transcriptText) {
      return NextResponse.json(
        {
          message:
            'The transcript did not contain any readable text to summarise.',
        },
        { status: 422 },
      );
    }

    const chunks = await chunkSplitter.splitText(transcriptText);
    const limitedChunks = chunks.slice(0, MAX_CHUNKS);
    const truncated = chunks.length > limitedChunks.length;

    const registry = new ModelRegistry();
    const llm = await registry.loadChatModel(chatModel.providerId, chatModel.key);

    const chunkPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You summarise short slices of a YouTube transcript. Provide the essential facts in 2-3 sentences. Avoid repetition and keep it concise.',
      ],
      ['user', '{transcript}'],
    ]);

    const chunkChain = chunkPrompt.pipe(llm).pipe(strParser);

    const chunkSummaries: string[] = [];
    for (const chunk of limitedChunks) {
      try {
        const summary = await chunkChain.invoke({ transcript: chunk });
        chunkSummaries.push(summary.trim());
      } catch (err) {
        console.error('[youtube-summary] Failed to summarise chunk:', err);
      }
    }

    if (!chunkSummaries.length) {
      return NextResponse.json(
        {
          message:
            'Failed to summarise the transcript chunks. Please try again or choose a different video.',
        },
        { status: 500 },
      );
    }

    const metadata = await fetchMetadata(url);

    const finalPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are creating a concise study guide for a YouTube video. Using the supplied video metadata and chunk summaries, produce JSON with the following shape:
{
  "summary": "One or two paragraphs giving the overall takeaway.",
  "bulletPoints": ["concise key point", "...", "..."],
  "nextSteps": ["optional action item", "..."]
}
Keep bullet points short (max 150 characters) and avoid Markdown or numbering. If you have no next steps, return an empty array.`,
      ],
      [
        'user',
        `Video title: {title}
Channel: {channel}

Chunk summaries:
{chunkSummaries}`,
      ],
    ]);

    const finalChain = finalPrompt.pipe(llm).pipe(strParser);
    const finalRaw = await finalChain.invoke({
      title: metadata?.title ?? 'Unknown title',
      channel: metadata?.author_name ?? 'Unknown channel',
      chunkSummaries: chunkSummaries.join('\n\n'),
    });

    let parsedSummary: {
      summary?: string;
      bulletPoints?: string[];
      nextSteps?: string[];
    } = {};

    try {
      parsedSummary = JSON.parse(finalRaw);
    } catch (err) {
      console.warn(
        '[youtube-summary] Failed to parse LLM summary JSON. Returning raw text.',
        err,
      );
      parsedSummary.summary = finalRaw.trim();
    }

    const responseBody = {
      summary: parsedSummary.summary?.trim() ?? '',
      bulletPoints: Array.isArray(parsedSummary.bulletPoints)
        ? parsedSummary.bulletPoints.map((point) => String(point).trim()).filter(Boolean)
        : [],
      nextSteps: Array.isArray(parsedSummary.nextSteps)
        ? parsedSummary.nextSteps.map((step) => String(step).trim()).filter(Boolean)
        : [],
      chunkSummaries,
      truncated,
      video: {
        id: videoId,
        url,
        title: metadata?.title ?? null,
        channel: metadata?.author_name ?? null,
        thumbnail: metadata?.thumbnail_url ?? null,
      },
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error('An unexpected error occurred while summarising video:', error);
    return NextResponse.json(
      { message: 'An unexpected error occurred while summarising the video.' },
      { status: 500 },
    );
  }
}

