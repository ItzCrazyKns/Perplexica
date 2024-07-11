import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export async function GET() {
  try {
    const dataDirectory = path.join(process.cwd(), "public", "data");
    const filePath = path.join(dataDirectory, "index.json");
    const fileContents = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(fileContents);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error reading news data:", error);
    return NextResponse.json({ error: "Failed to load news data" }, { status: 500 });
  }
}
