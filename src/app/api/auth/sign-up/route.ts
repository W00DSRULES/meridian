import { boardError, boardJson, readJson } from "@/lib/api";
import { signUpWithPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await signUpWithPassword(await readJson(request));
    return boardJson({ user }, 201);
  } catch (error) {
    return boardError(error);
  }
}
