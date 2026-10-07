import { boardError, boardJson } from "@/lib/api";
import { readBoard } from "@/lib/db";
import { guardCampaign } from "@/lib/guard";

export async function GET(request: Request) {
  try {
    const { campaignId } = await guardCampaign(request);
    const url = new URL(request.url);
    const board = await readBoard(campaignId);
    const known = url.searchParams.get("revision");
    if (known !== null && Number(known) === board.revision) {
      return boardJson({ revision: board.revision, unchanged: true, nodes: [], edges: [] });
    }
    return boardJson(board);
  } catch (error) {
    return boardError(error);
  }
}
