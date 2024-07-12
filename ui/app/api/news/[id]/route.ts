import { NextResponse } from "next/server";
import { fetchNewsData } from "../../../../lib/fetchNewsData";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const newsData = await fetchNewsData(params.id);

  if (!newsData) {
    return NextResponse.json({ error: "News not found" }, { status: 404 });
  }

  return NextResponse.json(newsData);
}
