import { ArrowLeftRight } from 'lucide-react';

const Rewrite = ({
  rewrite,
  messageId,
}: {
  rewrite: (messageId: string) => void;
  messageId: string;
}) => {
  return (
    <button
      onClick={() => rewrite(messageId)}
      className="py-2 px-3 rounded-xl hover:bg-secondary transition duration-200 flex flex-row items-center space-x-1"
    >
      <ArrowLeftRight size={18} />
      <p className="text-xs font-medium">Rewrite</p>
    </button>
  );
};

export default Rewrite;
