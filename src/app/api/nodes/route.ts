import { boardError, boardJson, readJson } from "@/lib/api";
import { createNode } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return boardJson(createNode(body), 201);
  } catch (error) {
    return boardError(error);
  }
}
