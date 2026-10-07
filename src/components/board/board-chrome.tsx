"use client";

import { createContext, useContext } from "react";

export const BoardChrome = createContext({
  flashId: null as string | null,
  awaitingIds: new Set<string>(),
});

export function useBoardChrome() {
  return useContext(BoardChrome);
}
