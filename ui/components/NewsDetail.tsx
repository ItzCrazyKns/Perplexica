import React from "react";
import ContextItem from "./ContextItem";

interface NewsDetailProps {
  news: {
    title: string;
    sections: {
      title: string;
      content: string;
      context: any[];
    }[];
  };
}

const NewsDetail: React.FC<NewsDetailProps> = ({ news }) => {
  return (
    <article className="prose lg:prose-xl">
      <h1>{news.title}</h1>
      {news.sections.map((section, index) => (
        <section key={index}>
          <h2>{section.title}</h2>
          <p>{section.content}</p>
          <div className="mt-4">
            <h3>Related Context:</h3>
            {section.context.map((item, i) => (
              <ContextItem key={i} item={item} />
            ))}
          </div>
        </section>
      ))}
    </article>
  );
};

export default NewsDetail;
