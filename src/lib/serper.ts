import axios from 'axios';
import {SearchOptions, SearchResult} from "./search";
import {getSerperApiKey} from "../config";

interface SerperParams {
    q: string;
    gl?: string;
    hl?: string;
    num?: number;
    page?: number;
    type?: 'search' | 'images' | 'news' | 'videos' | 'scholar'
}

export const searchSerper = async (
    query: string,
    opts: SearchOptions = {},
) => {
    const serperURL = 'https://google.serper.dev'

    let type = opts.engines?.[0] ?? 'search';
    const url = `${serperURL}/${type}`;

    const params: SerperParams = {
        q: query,
        hl: opts.language ?? 'en',
        gl: opts.country ?? 'us',
        page: opts.pageno ?? 1,
    }
    const res = await axios.post(url, params, {
        headers: {
            'X-API-KEY': getSerperApiKey(),
        }
    });

    const data = res.data;
    let results: SearchResult[] = [];
    const kg = data.knowledgeGraph;
    if (kg) {
        let content: string[] = [];
        kg.type && content.push(kg.type);
        kg.description && content.push(kg.description);
        kg.attributes && Object.entries(kg.attributes).forEach(([k, v]) => content.push(`${k}: ${v}`))
        results.push({
            title: kg.title,
            url: kg.descriptionLink || kg.website,
            content: content.join('\n'),
            img_src: kg.imageUrl,
        });
    }

    const answerBox = data.answerBox;
    if (answerBox) {
        results.push({
            title: answerBox.title,
            url: answerBox.link,
            content: answerBox.answer || answerBox.snippet,
        });
    }

    for (const key of ['organic', 'images', 'news', 'videos']) {
        if (!data[key]) continue;
        results.push(...data[key].map((r) => ({
            title: r.title,
            url: r.link,
            content: r.snippet,
            img_src: r.imageUrl,
            thumbnail_src: r.thumbnailUrl,
        })));
    }

    results = results.filter(r=>!!r.url)

    const suggestions: string[] = res.data.relatedSearches?.map(s => s.query) || [];

    return {results, suggestions};
};
