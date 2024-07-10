import React from "react";

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return <div className="max-w-4xl mx-auto p-4">{children}</div>;
}
