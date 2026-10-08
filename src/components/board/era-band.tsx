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
};

export type EraFlowNode = Node<EraData, "era">;
export type RuleFlowNode = Node<Record<string, never>, "rule">;

export type AddTechData = {
  eraId: string;
  eraName: string;
};

export type AddTechFlowNode = Node<AddTechData, "add">;

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
    </div>
  );
}

export function AddTechNode({ data }: NodeProps<AddTechFlowNode>) {
  const chrome = useBoardChrome();
  return (
    <button
      type="button"
      className="nodrag nopan"
      data-testid="add-technology"
      data-era-name={data.eraName}
      aria-label={`Add technology in ${data.eraName}`}
      style={{
        width: "100%",
        height: 40,
        border: "1px dashed rgba(231, 201, 138, 0.8)",
        borderRadius: 8,
        background: "rgba(16, 36, 58, 0.92)",
        color: "#f3e2b3",
        fontSize: 14,
        fontWeight: 650,
        cursor: "pointer",
      }}
      onClick={() => chrome.addTechnology(data.eraId)}
    >
      Add technology
    </button>
  );
}

export function ColumnRule() {
  return <div className="column-rule" aria-hidden="true" />;
}
