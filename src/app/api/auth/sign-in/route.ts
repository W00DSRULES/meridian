import { boardError, boardJson, readJson } from "@/lib/api";
import { signInWithPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await signInWithPassword(await readJson(request));
    return boardJson({ user });
  } catch (error) {
    return boardError(error);
  }
}
