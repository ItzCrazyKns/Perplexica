import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { VALIDATED_ENV } from "../../../../lib/constants";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    console.log(`Fetching news data for id: ${params.id}`);
    console.log(`API URL: ${VALIDATED_ENV.API_URL}`); // Log the API URL

    const dataDirectory = path.join(process.cwd(), "public", "data");
    const filePath = path.join(dataDirectory, `${params.id}.json`);
    const fileContents = await fs.readFile(filePath, "utf8");
    const newsData = JSON.parse(fileContents);

    // You could use VALIDATED_ENV.API_URL here if you needed to make any external API calls

    return NextResponse.json(newsData);
  } catch (error) {
    console.error("Error reading news data:", error);
    console.log(`WS URL: ${VALIDATED_ENV.WS_URL}`); // Log the WebSocket URL, just as an example
    return NextResponse.json({ error: "News not found" }, { status: 404 });
  }
}
