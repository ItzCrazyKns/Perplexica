import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { VALIDATED_ENV } from "../../../../lib/constants";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const dataDirectory = path.join(process.cwd(), "public", "data");
    const filePath = path.join(dataDirectory, `${params.id}.json`);
    const fileContents = await fs.readFile(filePath, "utf8");
    const newsData = JSON.parse(fileContents);

    return NextResponse.json(newsData);
  } catch (error) {
    console.error("Error reading news data:", error);
    return NextResponse.json({ error: "News not found" }, { status: 404 });
  }
}
