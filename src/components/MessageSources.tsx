/* eslint-disable @next/next/no-img-element */
import { Document } from '@langchain/core/documents';
import MessageSource from './MessageSource';

const MessageSources = ({ sources }: { sources: Document[] }) => {
  return (
    <div className="flex flex-col space-y-3">
      {sources.map((source, i) => (
        <MessageSource key={i} source={source} index={i} />
      ))}
    </div>
  );
};

export default MessageSources;
