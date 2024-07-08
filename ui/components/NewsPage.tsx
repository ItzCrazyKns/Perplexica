"use client";

import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  summary: string;
}

const hardcodedNews: NewsItem[] = [
  {
    "id": "ed701716-e443-5804-aaa9-99e7e04c33e2",
    "title": "胖东来迅速应对擀面皮事件，展现企业责任感",
    "summary": "胖东来商贸集团因擀面皮加工场所卫生问题迅速采取行动，关闭相关档口并展开调查。确认问题后，公司对举报顾客奖励10万元，并对购买问题产品的顾客进行退款和补偿，总计883.3万元。同时，胖东来辞退相关责任人，解除与涉事商户的合作，并制定改进计划以确保食品安全。公众对其快速透明的处理措施表示赞赏，认为其展现了企业的社会责任感。"
  },
  {
    "id": "869d933c-e186-51b0-a225-edc2d338b6fa",
    "title": "姜萍晋级全球数学竞赛决赛引发质疑",
    "summary": "17岁中专生姜萍在2024阿里巴巴全球数学竞赛中晋级决赛，但其成绩真实性受到质疑。北京大学教授袁新意指出她在校内月考成绩仅为83分，建议姜萍通过直播讲解竞赛题目或接受数学教授面试来证明实力。涟水县教育体育局确认了月考成绩的真实性，但质疑声仍未平息。姜萍的成功故事激励了许多人，凸显了教育公平和知识改变命运的重要性。"
  },
];

const NewsPage = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadNews = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        setNews(hardcodedNews);
      } catch (error) {
        console.error("Error loading news:", error);
        setError("Failed to load news. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    loadNews();
  }, []);

  return (
    <div>
      <div className="fixed z-40 top-0 left-0 right-0 lg:pl-[104px] lg:pr-6 lg:px-8 px-4 py-4 lg:py-6 border-b border-light-200 dark:border-dark-200">
        <div className="flex flex-row items-center space-x-2 max-w-screen-lg lg:mx-auto">
          <Newspaper />
          <h2 className="text-black dark:text-white lg:text-3xl lg:font-medium">News</h2>
        </div>
      </div>
      {loading ? (
        <div className="flex flex-row items-center justify-center min-h-screen">
          <p className="text-black/70 dark:text-white/70 text-sm">Loading news...</p>
        </div>
      ) : error ? (
        <div className="flex flex-row items-center justify-center min-h-screen">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      ) : (
        <div className="flex flex-col pt-16 lg:pt-24">
          {news.length === 0 ? (
            <p className="text-black/70 dark:text-white/70 text-sm text-center">No news available.</p>
          ) : (
            news.map((item) => (
              <div key={item.id} className="flex flex-col space-y-4 border-b border-white-200 dark:border-dark-200 py-6 lg:mx-4">
                <h3 className="text-black dark:text-white lg:text-xl font-medium">{item.title}</h3>
                <p className="text-black/70 dark:text-white/70 text-sm">{item.summary}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NewsPage;