import { fetchNewsData } from "../../../lib/fetchNewsData";
import NewsDetail from "../../../components/NewsDetail";

export default async function NewsPage({ params }: { params: { id: string } }) {
  const newsData = await fetchNewsData(params.id);

  if (!newsData) {
    return <div>News not found</div>;
  }

  return <NewsDetail news={newsData} />;
}
