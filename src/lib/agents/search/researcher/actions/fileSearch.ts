import z from "zod";
import { ResearchAction } from "../../types";

const schema = z.object({
    queries: z.array(z.string()).describe("A list of queries to search in files."),
})

const fileSearhAction: ResearchAction<typeof schema> = {
    name: "file_search",
}