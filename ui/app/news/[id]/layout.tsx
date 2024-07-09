import Link from "next/link";

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <Link href="/" className="text-blue-500 hover:underline mb-4 inline-block">
        &larr; Back to News List
      </Link>
      {children}
    </div>
  );
}
