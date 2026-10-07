"use client";

import { createContext, useContext } from "react";

export const BoardChrome = createContext({
  flashId: null as string | null,
  awaitingIds: new Set<string>(),
  renameEra: (_id: string, _name: string) => {
    void _id;
    void _name;
  },
  shiftEra: (_id: string, _direction: -1 | 1) => {
    void _id;
    void _direction;
  },
  addEra: () => {},
});

export function useBoardChrome() {
  return useContext(BoardChrome);
}
