"use client";

import { useState } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { useBoardChrome } from "@/components/board/board-chrome";
import { LIMITS } from "@/lib/board-model";

export type EraData = {
  eraId: string;
  numeral: string;
  title: string;
  hot: boolean;
  first: boolean;
  last: boolean;
};

export type EraFlowNode = Node<EraData, "era">;
export type RuleFlowNode = Node<Record<string, never>, "rule">;

export function EraBand({ data }: NodeProps<EraFlowNode>) {
  const chrome = useBoardChrome();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.title);

  function commit() {
    const next = draft.trim().replace(/\s+/g, " ");
    setEditing(false);
    if (!next || next === data.title) {
      setDraft(data.title);
      return;
    }
    chrome.renameEra(data.eraId, next);
  }

  return (
    <div className={`era-plaque nodrag nopan ${data.hot ? "era-plaque-hot" : ""}`}>
      <button
        type="button"
        className="era-shift"
        aria-label="Move era earlier"
        disabled={data.first}
        onClick={() => chrome.shiftEra(data.eraId, -1)}
      >
        ‹
      </button>
      {editing ? (
        <input
          className="era-rename"
          aria-label={`Rename ${data.title}`}
          value={draft}
          maxLength={LIMITS.eraName}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setDraft(data.title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button type="button" className="era-name" onClick={() => { setDraft(data.title); setEditing(true); }}>
          <span className="era-numeral">{data.numeral}</span>
          <span className="era-title" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.01em" }}>
            {data.title}
          </span>
        </button>
      )}
      <button
        type="button"
        className="era-shift"
        aria-label="Move era later"
        disabled={data.last}
        onClick={() => chrome.shiftEra(data.eraId, 1)}
      >
        ›
      </button>
      {data.last ? (
        <button type="button" className="era-add" aria-label="Add an era" onClick={() => chrome.addEra()}>
          +
        </button>
      ) : null}
    </div>
  );
}

export function ColumnRule() {
  return <div className="column-rule" aria-hidden="true" />;
}
