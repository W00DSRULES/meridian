"use client";

import { createContext, useContext } from "react";

export const BoardChrome = createContext({
  linkingFromId: null as string | null,
  flashId: null as string | null,
  awaitingIds: new Set<string>(),
  startLink: (id: string) => {
    void id;
  },
});

export function useBoardChrome() {
  return useContext(BoardChrome);
}
