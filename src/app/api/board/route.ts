import { boardError, boardJson } from "@/lib/api";
import { readBoard } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const board = readBoard();
    const known = url.searchParams.get("revision");
    if (known !== null && Number(known) === board.revision) {
      return boardJson({ revision: board.revision, unchanged: true, nodes: [], edges: [] });
    }
    return boardJson(board);
  } catch (error) {
    return boardError(error);
  }
}
