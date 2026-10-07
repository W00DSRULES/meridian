import { boardError, boardJson } from "@/lib/api";
import { signOut } from "@/lib/auth";

export async function POST() {
  try {
    await signOut();
    return boardJson({ ok: true });
  } catch (error) {
    return boardError(error);
  }
}
