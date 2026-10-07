"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeChange,
  type NodeTypes,
  type OnNodeDrag,
} from "@xyflow/react";
import { Plus } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CapabilityNode, type CapabilityFlowNode } from "@/components/board/capability-node";
import {
  CapabilityDialog,
  EMPTY_DRAFT,
  NameDialog,
  type CapabilityDraft,
} from "@/components/board/dialogs";
import { EraBand, type EraFlowNode } from "@/components/board/era-band";
import {
  BAND_OFFSET_X,
  BAND_WIDTH,
  COLUMNS,
  COLUMN_X,
  COMMITMENT_META,
  FIRST_NODE_Y,
  NODE_STEP_Y,
  NODE_WIDTH,
  PROFICIENCY_META,
  nearestColumnIndex,
  snapX,
} from "@/lib/board-model";
import {
  getDisplayName,
  getServerDisplayName,
  rememberDisplayName,
  subscribeDisplayName,
  useClientReady,
} from "@/lib/display-name";
import type { BoardEdge, BoardNode, BoardSnapshot, Proficiency } from "@/lib/types";

type MeridianNode = CapabilityFlowNode | EraFlowNode;

const nodeTypes: NodeTypes = {
  capability: CapabilityNode,
  era: EraBand,
};

const edgeDefaults = {
  type: "smoothstep" as const,
  interactionWidth: 22,
  style: { stroke: "#e0c088", strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: "#e0c088",
    width: 18,
    height: 18,
  },
};

function toCapabilityNode(node: BoardNode, selected: boolean): CapabilityFlowNode {
  return {
    id: node.id,
    type: "capability",
    position: { x: node.x, y: node.y },
    data: {
      title: node.title,
      description: node.description,
      proficiency: node.proficiency,
      commitment: node.commitment,
      author: node.author,
    },
    selected,
    zIndex: 3,
    style: { width: NODE_WIDTH },
  };
}

function toFlowEdge(edge: BoardEdge, selected: boolean): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    selected,
    zIndex: 2,
    ...edgeDefaults,
    data: { author: edge.author },
  };
}

function settlePosition(x: number, y: number, selfId: string, nodes: CapabilityFlowNode[]) {
  const snappedX = snapX(x);
  let nextY = Math.max(36, Math.round(y));
  const others = nodes.filter(
    (node) => node.id !== selfId && Math.abs(node.position.x - snappedX) < 8,
  );
  let guard = 0;
  while (others.some((node) => Math.abs(node.position.y - nextY) < 136) && guard < 24) {
    const blocker = others
      .filter((node) => Math.abs(node.position.y - nextY) < 136)
      .sort((a, b) => a.position.y - b.position.y)[0];
    nextY = Math.round((blocker?.position.y ?? nextY) + NODE_STEP_Y);
    guard += 1;
  }
  return { x: snappedX, y: nextY };
}

export function Board() {
  return (
    <ReactFlowProvider>
      <BoardCanvas />
    </ReactFlowProvider>
  );
}

function BoardCanvas() {
  const { fitView, setCenter } = useReactFlow();
  const [caps, setCaps, onCapsChange] = useNodesState<CapabilityFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("The shared board didn't answer.");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const displayName = useSyncExternalStore(subscribeDisplayName, getDisplayName, getServerDisplayName);
  const clientReady = useClientReady();
  const [renaming, setRenaming] = useState(false);
  const [nameDialogKey, setNameDialogKey] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [seed, setSeed] = useState<CapabilityDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BoardNode | null>(null);
  const [activeColumn, setActiveColumn] = useState<number | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const revisionRef = useRef(-1);
  const writesRef = useRef(0);
  const draggingRef = useRef<string | null>(null);
  const didFitRef = useRef(false);

  const applySnapshot = useCallback((board: BoardSnapshot) => {
    if (board.unchanged) return;
    if (board.revision < revisionRef.current) return;
    const isNewer = board.revision > revisionRef.current;
    revisionRef.current = board.revision;
    if (isNewer) {
      const dragging = draggingRef.current;
      setCaps((current) =>
        board.nodes.map((node) => {
          const flow = toCapabilityNode(
            node,
            current.some((item) => item.id === node.id && item.selected),
          );
          if (dragging === node.id) {
            const local = current.find((item) => item.id === dragging);
            if (local) flow.position = local.position;
          }
          return flow;
        }),
      );
      setEdges((current) =>
        board.edges.map((edge) =>
          toFlowEdge(edge, current.some((item) => item.id === edge.id && item.selected)),
        ),
      );
      setSelectedEdgeId((current) =>
        current && board.edges.some((edge) => edge.id === current) ? current : null,
      );
    }
    if (!didFitRef.current && board.nodes.length > 0) {
      didFitRef.current = true;
      const focus = board.nodes.map((node) => ({ id: node.id }));
      window.setTimeout(() => {
        void fitView({ nodes: focus, padding: 0.28, maxZoom: 1, duration: 350 });
      }, 40);
    }
    if (board.focusId) {
      const node = board.nodes.find((item) => item.id === board.focusId);
      if (node) {
        window.setTimeout(() => {
          void setCenter(node.x + NODE_WIDTH / 2, node.y + 70, {
            zoom: 1,
            duration: 350,
          });
        }, 40);
      }
    }
    setStatus("ready");
    setSyncError(null);
  }, [fitView, setCaps, setCenter, setEdges]);

  const refresh = useCallback(async (initial: boolean) => {
    try {
      const response = await fetch(`/api/board?revision=${revisionRef.current}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as BoardSnapshot | { error?: string } | null;
      if (!response.ok) {
        throw new Error(data && "error" in data && data.error ? data.error : "The shared board didn't answer.");
      }
      if (writesRef.current > 0) return;
      applySnapshot(data as BoardSnapshot);
      if (!initial) setSyncError(null);
      setStatus("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The shared board didn't answer.";
      if (initial && revisionRef.current < 0) {
        setLoadError(message);
        setStatus("error");
      } else {
        setSyncError("Can't reach the board right now. Still retrying.");
      }
    }
  }, [applySnapshot]);

  useEffect(() => {
    let cancelled = false;
    const kick = window.setTimeout(() => {
      if (!cancelled) void refresh(true);
    }, 0);
    const timer = window.setInterval(() => {
      if (!cancelled) void refresh(false);
    }, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function send(url: string, method: string, body?: unknown): Promise<BoardSnapshot> {
    writesRef.current += 1;
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as (BoardSnapshot & { error?: string }) | null;
      if (!response.ok) {
        throw new Error(data?.error || "The board rejected that change.");
      }
      if (!data) throw new Error("The board sent an empty response.");
      applySnapshot(data);
      return data;
    } finally {
      writesRef.current -= 1;
    }
  }

  function note(message: string) {
    setBanner(message);
    window.setTimeout(() => {
      setBanner((current) => (current === message ? null : current));
    }, 6000);
  }

  function saveName(name: string) {
    const stored = rememberDisplayName(name);
    if (stored === "session") {
      note("This browser wouldn't store your name, but you can keep editing this session.");
    }
    setRenaming(false);
  }

  function openCreate() {
    if (!displayName) {
      setNameDialogKey((key) => key + 1);
      setRenaming(true);
      return;
    }
    setDialogMode("create");
    setEditingId(null);
    setSeed(EMPTY_DRAFT);
    setFormError(null);
    setFormKey((key) => key + 1);
    setDialogOpen(true);
  }

  function openEdit(node: CapabilityFlowNode) {
    setDialogMode("edit");
    setEditingId(node.id);
    setSeed({
      title: node.data.title,
      description: node.data.description,
      proficiency: node.data.proficiency,
      commitment: node.data.commitment,
    });
    setFormError(null);
    setFormKey((key) => key + 1);
    setDialogOpen(true);
  }

  async function submitDraft(draft: CapabilityDraft) {
    if (!displayName) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = { ...draft, author: displayName };
      if (dialogMode === "create") {
        const column = caps.reduce(
          (counts, node) => {
            counts[nearestColumnIndex(node.position.x)] += 1;
            return counts;
          },
          [0, 0, 0, 0],
        );
        let index = 0;
        for (let cursor = 1; cursor < column.length; cursor += 1) {
          if (column[cursor] < column[index]) index = cursor;
        }
        await send("/api/nodes", "POST", {
          ...payload,
          x: COLUMN_X[index],
          y: FIRST_NODE_Y + column[index] * NODE_STEP_Y,
        });
      } else if (editingId) {
        await send(`/api/nodes/${editingId}`, "PATCH", payload);
      }
      setDialogOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Couldn't save that capability.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    setDialogOpen(false);
    try {
      await send(`/api/nodes/${target.id}`, "DELETE");
    } catch (error) {
      note(error instanceof Error ? error.message : "Couldn't remove that capability.");
    }
  }

  async function persistEdge(source: string, target: string) {
    if (!displayName) return;
    try {
      await send("/api/edges", "POST", { source, target, author: displayName });
    } catch (error) {
      note(error instanceof Error ? error.message : "Couldn't add that link.");
    }
  }

  async function removeEdge(id: string) {
    try {
      await send(`/api/edges/${id}`, "DELETE");
      setSelectedEdgeId(null);
    } catch (error) {
      note(error instanceof Error ? error.message : "Couldn't remove that link.");
    }
  }

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    void persistEdge(connection.source, connection.target);
  };

  const onNodeDragStart: OnNodeDrag<MeridianNode> = (_event, node) => {
    draggingRef.current = node.id;
    setActiveColumn(nearestColumnIndex(node.position.x));
  };

  const onNodeDrag: OnNodeDrag<MeridianNode> = (_event, node) => {
    setActiveColumn(nearestColumnIndex(node.position.x));
  };

  const onNodeDragStop: OnNodeDrag<MeridianNode> = (_event, node) => {
    setActiveColumn(null);
    if (node.type !== "capability" || !displayName) {
      draggingRef.current = null;
      return;
    }
    const author = displayName;
    let next = { x: node.position.x, y: node.position.y };
    draggingRef.current = node.id;
    setCaps((current) => {
      next = settlePosition(node.position.x, node.position.y, node.id, current);
      return current.map((item) => (item.id === node.id ? { ...item, position: next } : item));
    });
    void send(`/api/nodes/${node.id}`, "PATCH", {
      x: next.x,
      y: next.y,
      author,
    })
      .catch((error: unknown) => {
        note(error instanceof Error ? error.message : "Couldn't save that move.");
        void refresh(false);
      })
      .finally(() => {
        draggingRef.current = null;
      });
  };

  const bandHeight = useMemo(() => {
    const lowest = caps.reduce((max, node) => Math.max(max, node.position.y), 0);
    return Math.max(820, lowest + 380);
  }, [caps]);

  const flowNodes = useMemo(() => {
    const eras: EraFlowNode[] = COLUMNS.map((column, index) => ({
      id: `era-${column.key}`,
      type: "era",
      position: { x: COLUMN_X[index] + BAND_OFFSET_X, y: -12 },
      data: {
        numeral: column.numeral,
        title: column.title,
        blurb: column.blurb,
        hot: activeColumn === index,
      },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      deletable: false,
      zIndex: 0,
      style: { width: BAND_WIDTH, height: bandHeight, pointerEvents: "none" },
    }));
    return [...eras, ...caps];
  }, [activeColumn, bandHeight, caps]);

  const selectedNode = caps.find((node) => node.selected) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const edgeSource = selectedEdge ? caps.find((node) => node.id === selectedEdge.source) : null;
  const edgeTarget = selectedEdge ? caps.find((node) => node.id === selectedEdge.target) : null;
  const deleteTarget = pendingDelete;
  const nameDialogOpen = renaming || (clientReady && !displayName);

  function askDelete(node: CapabilityFlowNode) {
    setDialogOpen(false);
    setPendingDelete(boardNodeFromFlow(node));
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-[#10161c] text-[#f4efe6]">
      <header className="z-20 border-b border-[#e0c088]/15 bg-[#121920]/95 px-3 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="font-display text-2xl tracking-tight text-[#f6f0e6]">Meridian</h1>
              <span className="hidden text-[11px] font-semibold tracking-[0.18em] text-[#e0c088] uppercase sm:inline">
                Shared tree
              </span>
            </div>
            <p className="max-w-xl text-xs leading-relaxed text-[#9aa6b2] sm:text-sm">
              Sales, dev, and engineering align on what is connected, what the team is good or
              bad at, and what is in motion.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="max-w-[10rem]"
              onClick={() => {
                setNameDialogKey((key) => key + 1);
                setRenaming(true);
              }}
              disabled={!clientReady}
            >
              <span className="truncate">{displayName ?? "Your name"}</span>
            </Button>
            <Button size="sm" data-testid="add-capability" onClick={openCreate}>
              <Plus />
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add capability</span>
            </Button>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-[11px] text-[#9aa6b2]">
          <span className="inline-flex shrink-0 items-center gap-1.5 pr-1">
            <span className={`size-1.5 rounded-full ${syncError ? "bg-[#e07a5f]" : "bg-[#3cba9a]"}`} />
            {syncError ? "Reconnecting" : status === "loading" ? "Opening" : "Live"}
          </span>
          {(Object.keys(PROFICIENCY_META) as Proficiency[]).map((key) => (
            <Badge
              key={key}
              variant="outline"
              className="shrink-0 border-[#e0c088]/20 bg-transparent text-[#d5dbe6]"
            >
              <span className="size-1.5 rounded-full" style={{ background: PROFICIENCY_META[key].stripe }} />
              {PROFICIENCY_META[key].label}
            </Badge>
          ))}
          <Badge variant="outline" className="shrink-0 border-[#e0c088]/20 bg-transparent text-[#e0c088]">
            Doing now
          </Badge>
          <Badge variant="outline" className="shrink-0 border-dashed border-[#e0c088]/50 bg-transparent text-[#e0c088]">
            Next step
          </Badge>
          <Badge variant="outline" className="shrink-0 border-[#e0c088]/15 bg-transparent text-[#9aa6b2]">
            Not doing
          </Badge>
          <span className="hidden shrink-0 items-center sm:inline">
            Drag a card between eras. Pull the gold notch to what it leads to.
          </span>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <ReactFlow<MeridianNode>
          className="meridian-flow"
          nodes={flowNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={(changes) => {
            onCapsChange(
              changes.filter(
                (change) => !("id" in change) || !change.id.startsWith("era-"),
              ) as NodeChange<CapabilityFlowNode>[],
            );
          }}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(_event, node) => {
            if (node.type !== "capability") return;
            setSelectedEdgeId(null);
          }}
          onNodeDoubleClick={(_event, node) => {
            if (node.type !== "capability") return;
            openEdit(node);
          }}
          onEdgeClick={(_event, edge) => {
            setSelectedEdgeId(edge.id);
            setCaps((current) => current.map((node) => ({ ...node, selected: false })));
          }}
          onPaneClick={() => setSelectedEdgeId(null)}
          isValidConnection={(connection) => {
            if (!connection.source || !connection.target) return false;
            if (connection.source === connection.target) return false;
            return !edges.some(
              (edge) => edge.source === connection.source && edge.target === connection.target,
            );
          }}
          fitView={false}
          defaultViewport={{ x: 16, y: 12, zoom: 0.9 }}
          minZoom={0.35}
          maxZoom={1.4}
          connectionRadius={36}
          deleteKeyCode={null}
          multiSelectionKeyCode={null}
          selectionKeyCode={null}
          nodesDraggable={Boolean(displayName)}
          nodesConnectable={Boolean(displayName)}
          elementsSelectable
          panOnScroll
          colorMode="dark"
          proOptions={{ hideAttribution: false }}
          aria-label="Shared capability tree"
        >
          <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(224,192,136,0.16)" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            bgColor="#121920"
            maskColor="rgba(16,22,28,0.72)"
            nodeColor={(node) => {
              if (node.type !== "capability") return "transparent";
              const data = node.data as CapabilityFlowNode["data"];
              return PROFICIENCY_META[data.proficiency]?.stripe ?? "#93a0b5";
            }}
            nodeStrokeWidth={0}
          />
        </ReactFlow>

        {syncError || banner ? (
          <div
            role="status"
            className="absolute top-3 left-1/2 z-20 flex w-[min(100%-1.5rem,36rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-[#e07a5f]/40 bg-[#2a1b18]/95 px-3 py-2 text-sm text-[#f8d7cf] shadow-lg"
          >
            <span>{syncError ?? banner}</span>
            {syncError ? (
              <Button size="xs" variant="outline" onClick={() => void refresh(false)}>
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}

        {status === "loading" ? (
          <Overlay testId="loading-state" title="Opening the shared board" body="Meridian keeps one tree for the whole team. Fetching it now." />
        ) : null}
        {status === "error" ? (
          <Overlay
            testId="error-state"
            title="The board didn't load"
            body={loadError}
            action={<Button onClick={() => { setStatus("loading"); void refresh(true); }}>Try again</Button>}
          />
        ) : null}
        {status === "ready" && caps.length === 0 ? (
          <Overlay
            testId="empty-state"
            title="The tree is still bare"
            body="Add the first capability the team should align on — something you are good at, stuck on, or still figuring out. Then link what it leads to."
            action={<Button data-testid="empty-add" onClick={openCreate}>Add the first capability</Button>}
          />
        ) : null}

        {selectedNode && !selectedEdge ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
            <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-[#e0c088]/25 bg-[#17202a]/95 p-3 shadow-2xl backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display truncate text-base text-[#f6f0e6]">{selectedNode.data.title}</p>
                  <p className="text-xs text-[#9aa6b2]">
                    {PROFICIENCY_META[selectedNode.data.proficiency].label}
                    {" · "}
                    {COMMITMENT_META[selectedNode.data.commitment].label}
                    {" · "}
                    {selectedNode.data.author}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => openEdit(selectedNode)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => askDelete(selectedNode)}>
                  Remove
                </Button>
                <p className="self-center text-xs text-[#8b97a6]">
                  Drag the gold notch on the right to link what this leads to.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {selectedEdge && edgeSource && edgeTarget ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
            <div className="pointer-events-auto flex w-full max-w-lg flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e0c088]/25 bg-[#17202a]/95 p-3 shadow-2xl">
              <p className="text-sm text-[#f4efe6]">
                <span className="font-display">{edgeSource.data.title}</span>
                <span className="text-[#9aa6b2]"> leads to </span>
                <span className="font-display">{edgeTarget.data.title}</span>
              </p>
              <Button size="sm" variant="destructive" onClick={() => void removeEdge(selectedEdge.id)}>
                Remove link
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <NameDialog
        key={nameDialogKey}
        open={nameDialogOpen}
        required={!displayName}
        initialName={displayName ?? ""}
        onOpenChange={setRenaming}
        onSave={saveName}
      />
      <CapabilityDialog
        key={formKey}
        open={dialogOpen}
        mode={dialogMode}
        seed={seed}
        author={displayName ?? ""}
        saving={saving}
        error={formError}
        onOpenChange={setDialogOpen}
        onSubmit={(draft) => void submitDraft(draft)}
        onDelete={
          dialogMode === "edit" && editingId
            ? () => {
                const node = caps.find((item) => item.id === editingId);
                if (node) askDelete(node);
              }
            : undefined
        }
      />
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this capability?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” leaves the shared board, and any links to it go with it.
              Everyone else will see it disappear within a few seconds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function boardNodeFromFlow(node: CapabilityFlowNode): BoardNode {
  return {
    id: node.id,
    title: node.data.title,
    description: node.data.description,
    proficiency: node.data.proficiency,
    commitment: node.data.commitment,
    author: node.data.author,
    x: node.position.x,
    y: node.position.y,
    createdAt: 0,
    updatedAt: 0,
  };
}

function Overlay({
  title,
  body,
  action,
  testId,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  testId: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
      <div
        data-testid={testId}
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-[#e0c088]/25 bg-[#17202a]/95 p-6 text-center shadow-2xl"
      >
        <div className="mx-auto mb-4 grid w-36 grid-cols-3 gap-2" aria-hidden="true">
          <span className="col-start-2 h-7 rounded-md border border-[#e0c088]/50 bg-[#e0c088]/15" />
          <span className="col-start-1 h-7 rounded-md border border-[#3cba9a]/40 bg-[#3cba9a]/10" />
          <span className="col-start-3 h-7 rounded-md border border-[#e07a5f]/40 bg-[#e07a5f]/10" />
        </div>
        <h2 className="font-display text-2xl text-[#f6f0e6]">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#a7b1bd]">{body}</p>
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
