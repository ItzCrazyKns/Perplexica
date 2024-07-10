import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewsDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <Link
        href="/news"
        className="inline-flex items-center mb-4 text-sm font-medium text-black dark:text-white hover:underline"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Link>
      {children}
    </div>
  );
}
