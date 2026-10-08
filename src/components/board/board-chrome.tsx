"use client";

import { createContext, useContext } from "react";

export const BoardChrome = createContext({
  flashId: null as string | null,
  awaitingIds: new Set<string>(),
  renameEra: (_id: string, _name: string) => {
    void _id;
    void _name;
  },
  addTechnology: (_eraId: string) => {
    void _eraId;
  },
});

export function useBoardChrome() {
  return useContext(BoardChrome);
}
