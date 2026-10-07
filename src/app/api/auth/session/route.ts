import { boardError, boardJson } from "@/lib/api";
import { publicAppUrl, requireUser } from "@/lib/auth";
import { BoardRequestError } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireUser();
    return boardJson({ user, publicUrl: publicAppUrl() });
  } catch (error) {
    if (error instanceof BoardRequestError && error.status === 401) {
      return boardJson({ user: null, publicUrl: publicAppUrl() });
    }
    return boardError(error);
  }
}
