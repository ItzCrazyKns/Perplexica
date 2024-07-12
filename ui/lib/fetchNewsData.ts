mport fs from "node:fs/promises";
import path from "node:path";

export async function fetchNewsData(id: string) {
  try {
    const dataDirectory = path.join(process.cwd(), "public", "data");
    const filePath = path.join(dataDirectory, `${id}.json`);
    const fileContents = await fs.readFile(filePath, "utf8");
    return JSON.parse(fileContents);
  } catch (error) {
    console.error("Error reading news data:", error);
    return null;
  }
}
