import {searchSerper} from "./serper";
import {searchSearxng} from "./searxng";
import {getSerperApiKey} from "../config";

export interface SearchOptions {
    categories?: string[];
    engines?: string[];
    language?: string;
    country?: string;
    pageno?: number;
}

export interface SearchResult {
    title: string;
    url: string;
    img_src?: string;
    thumbnail_src?: string;
    content?: string;
    author?: string;
}

export const search = async (
    query: string,
    opts?: SearchOptions,
) => {

    const hasSerperKey = !!getSerperApiKey();
    if (hasSerperKey) {
        let engine = opts?.engines?.[0] ?? 'search';
        if (engine.match(/search|videos|images|news|scholar'/)) {
            engine = engine.replaceAll(/google|bing/g, '').trim();
            return searchSerper(query, {
                ...opts,
                engines: [engine],
            });
        }
    }

    return searchSearxng(query, opts);
};
