import { boardError, boardJson, readJson } from "@/lib/api";
import { createEdge } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return boardJson(createEdge(body), 201);
  } catch (error) {
    return boardError(error);
  }
}
