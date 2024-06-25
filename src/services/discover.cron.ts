import { CronJob } from 'cron';
import axios from 'axios';
import { getSearxngApiEndpoint } from '../config';
import DiscoverModel from '../database/mongodb/schema/discover';

interface SearxngSearchResult {
  title: string;
  url: string;
  img_src?: string;
  content?: string;
  author?: string;
}

async function discover() {
  try {
    const searxngURL = getSearxngApiEndpoint();

    const url = new URL(`${searxngURL}/search?format=json`);
    url.searchParams.append('q', 'Latest cool articles and developments in AI and technology');

    const res = await axios.get(url.toString());

    const results: SearxngSearchResult[] = res.data.results.map((result: any) => ({
      url: result.url,
      title: result.title,
      content: result.content
    }));

    const limitedResults = results.slice(0, 10);
    await DiscoverModel.deleteMany({});
    await DiscoverModel.create(limitedResults);
  } catch (err) {
    throw new Error('Failed to discover latest articles');
  }
}

const job = new CronJob('*/60 * * * * *', () => {
  discover();
  console.log('This job runs every 60 seconds.');
});

export default job;
