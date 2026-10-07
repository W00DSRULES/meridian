import { boardError, boardJson, campaignOf, readJson } from "@/lib/api";
import { createNode } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return boardJson(await createNode(campaignOf(request), body), 201);
  } catch (error) {
    return boardError(error);
  }
}
