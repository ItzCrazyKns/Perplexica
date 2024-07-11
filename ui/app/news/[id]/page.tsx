import { fetchNewsData } from "../../../lib/fetchNewsData";
import NewsDetail from "../../../components/NewsDetail";

export default async function NewsPage({ params }: { params: { id: string } }) {
  const newsData = await fetchNewsData(params.id);

  if (!newsData) {
    return <div className="text-center text-red-500">News not found or failed to load</div>;
  }

  return <NewsDetail news={newsData} />;
}
