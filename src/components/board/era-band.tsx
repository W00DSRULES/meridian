"use client";

import type { Node, NodeProps } from "@xyflow/react";

export type EraData = {
  numeral: string;
  title: string;
  blurb: string;
  hot: boolean;
};

export type EraFlowNode = Node<EraData, "era">;

export function EraBand({ data }: NodeProps<EraFlowNode>) {
  return (
    <div className={`era-plaque ${data.hot ? "era-plaque-hot" : ""}`}>
      <p className="era-numeral">{data.numeral}</p>
      <h2 className="era-title">{data.title}</h2>
      <p className="era-blurb">{data.blurb}</p>
    </div>
  );
}
