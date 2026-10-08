"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeChange,
  type NodeTypes,
  type OnConnectEnd,
  type OnNodeDrag,
} from "@xyflow/react";
import { Plus } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { BoardChrome } from "@/components/board/board-chrome";
import { CapabilityNode, type CapabilityFlowNode } from "@/components/board/capability-node";
import {
  CapabilityDialog,
  EMPTY_DRAFT,
  NameDialog,
  type CapabilityDraft,
} from "@/components/board/dialogs";
import { AddTechNode, ColumnRule, EraBand, type AddTechFlowNode, type EraFlowNode, type RuleFlowNode } from "@/components/board/era-band";
import {
  BAND_OFFSET_X,
  FIRST_NODE_Y,
  NODE_STEP_Y,
  NODE_WIDTH,
  PLAQUE_HEIGHT,
  PLAQUE_WIDTH,
  columnX,
  milestoneCounts,
  nearestColumnIndex,
  progressPaint,
  roman,
  snapX,
} from "@/lib/board-model";
import {
  getDisplayName,
  getServerDisplayName,
  rememberDisplayName,
  subscribeDisplayName,
  useClientReady,
} from "@/lib/display-name";
import { SignInPanel } from "@/components/auth/sign-in-panel";
import { rememberCampaign } from "@/lib/local-campaigns";
import type { BoardEdge, BoardEra, BoardNode, BoardSnapshot, Milestone } from "@/lib/types";

type MeridianNode = CapabilityFlowNode | EraFlowNode | RuleFlowNode | AddTechFlowNode;

const nodeTypes: NodeTypes = {
  capability: CapabilityNode,
  era: EraBand,
  rule: ColumnRule,
  add: AddTechNode,
};

const edgeDefaults = {
  type: "step" as const,
  interactionWidth: 14,
  pathOptions: { borderRadius: 0, offset: 8 },
  style: { stroke: "#8d7350", strokeWidth: 1.75 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: "#8d7350",
    width: 12,
    height: 12,
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
      detail: node.detail,
      glyph: node.glyph,
      proficiency: node.proficiency,
      commitment: node.commitment,
      eraId: node.eraId,
      author: node.author,
      milestones: node.milestones,
      updatedAt: node.updatedAt,
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
    sourceHandle: "out",
    targetHandle: "in",
    selected,
    zIndex: 2,
    ...edgeDefaults,
    data: { author: edge.author },
  };
}

function settlePosition(
  x: number,
  y: number,
  selfId: string,
  nodes: CapabilityFlowNode[],
  columnCount: number,
) {
  const snappedX = snapX(x, columnCount);
  let nextY = Math.max(FIRST_NODE_Y, Math.round(y));
  const others = nodes.filter(
    (node) => node.id !== selfId && Math.abs(node.position.x - snappedX) < 8,
  );
  let guard = 0;
  while (others.some((node) => Math.abs(node.position.y - nextY) < 48) && guard < 24) {
    const blocker = others
      .filter((node) => Math.abs(node.position.y - nextY) < 48)
      .sort((a, b) => a.position.y - b.position.y)[0];
    nextY = Math.round((blocker?.position.y ?? nextY) + NODE_STEP_Y);
    guard += 1;
  }
  return { x: snappedX, y: nextY };
}

export function Board({ campaignId }: { campaignId: string }) {
  return (
    <ReactFlowProvider>
      <BoardCanvas campaignId={campaignId} />
    </ReactFlowProvider>
  );
}

function BoardCanvas({ campaignId }: { campaignId: string }) {
  const { setCenter, setViewport } = useReactFlow();
  const [caps, setCaps, onCapsChange] = useNodesState<CapabilityFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [campaignName, setCampaignName] = useState("");
  const [savePhase, setSavePhase] = useState<"saved" | "saving">("saved");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [eraPromptOpen, setEraPromptOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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
  const [eras, setEras] = useState<BoardEra[]>([]);
  const [activeColumn, setActiveColumn] = useState<number | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ tone: "milestone" | "researched"; text: string } | null>(null);

  const [session, setSession] = useState<"loading" | "guest" | "in">("loading");
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const revisionRef = useRef(-1);
  const cardTimes = useRef(new Map<string, number>());
  const editBase = useRef<{ id: string; updatedAt: number; revision: number } | null>(null);
  const writesRef = useRef(0);
  const draggingRef = useRef<string | null>(null);
  const didFitRef = useRef(false);
  const refreshGen = useRef(0);

  const applySnapshot = useCallback((board: BoardSnapshot) => {
    if (board.unchanged) return;
    if (board.revision < revisionRef.current) return;
    const isNewer = board.revision > revisionRef.current;
    revisionRef.current = board.revision;
    cardTimes.current = new Map(board.nodes.map((node) => [node.id, node.updatedAt]));
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
      setEras(board.eras ?? []);
      if (board.campaign) {
        setCampaignName(board.campaign.name);
        rememberCampaign({ id: board.campaign.id, name: board.campaign.name });
      }
    }
    if (!didFitRef.current && board.nodes.length > 0) {
      didFitRef.current = true;
      const eraCount = Math.max(1, board.eras?.length ?? 1);
      window.setTimeout(() => {
        const pane = document.querySelector(".meridian-flow");
        const width = pane?.clientWidth ?? 1280;
        const span = columnX(eraCount - 1) + NODE_WIDTH - columnX(0);
        const zoom = Math.min(1.12, Math.max(0.22, (width - 28) / (span + 8)));
        void setViewport({ x: 10, y: 6, zoom }, { duration: 0 });
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
  }, [setCaps, setCenter, setEdges, setViewport]);

  const refresh = useCallback(async (initial: boolean) => {
    const generation = ++refreshGen.current;
    try {
      const response = await fetch(`/api/board?revision=${revisionRef.current}&campaign=${encodeURIComponent(campaignId)}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as BoardSnapshot | { error?: string } | null;
      if (generation !== refreshGen.current) return;
      if (!response.ok) {
        throw new Error(data && "error" in data && data.error ? data.error : "The shared board didn't answer.");
      }
      if (writesRef.current > 0) return;
      applySnapshot(data as BoardSnapshot);
      if (!initial) setSyncError(null);
      setStatus("ready");
    } catch (error) {
      if (generation !== refreshGen.current) return;
      const raw = error instanceof Error ? error.message : "";
      const message =
        raw === "Failed to fetch" || raw === "Load failed"
          ? "The shared board didn't answer. It may be restarting — try again in a moment."
          : raw || "The shared board didn't answer.";
      if (raw === "Sign in to see this tree.") {
        setSession("guest");
        setJoined(false);
        return;
      }
      if (initial && revisionRef.current < 0) {
        setLoadError(message);
        setStatus("error");
      } else {
        setSyncError("Can't reach the board right now. Still retrying.");
      }
    }
  }, [applySnapshot, campaignId]);

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await response.json()) as { user?: { email: string } | null; publicUrl?: string | null };
        if (cancelled) return;
        setPublicUrl(data.publicUrl ?? null);
        setSession(data.user ? "in" : "guest");
      } catch {
        if (!cancelled) setSession("guest");
      }
    }
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (session !== "in") return;
    let cancelled = false;
    async function join() {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/join`, { method: "POST" });
        const data = (await response.json()) as { error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setLoadError(data.error || "Could not join this campaign.");
          setStatus("error");
          setJoined(true);
          return;
        }
        setJoined(true);
      } catch {
        if (cancelled) return;
        setLoadError("Could not join this campaign.");
        setStatus("error");
        setJoined(true);
      }
    }
    void join();
    return () => {
      cancelled = true;
    };
  }, [session, campaignId]);

  useEffect(() => {
    if (!joined) return;
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
  }, [refresh, joined]);

  function scope(url: string) {
    const join = url.includes("?") ? "&" : "?";
    return `${url}${join}campaign=${encodeURIComponent(campaignId)}`;
  }

  function cardStamp(techId: string): { revision: number; updatedAt?: number } {
    if (editBase.current?.id === techId) {
      return { revision: editBase.current.revision, updatedAt: editBase.current.updatedAt };
    }
    return { revision: revisionRef.current, updatedAt: cardTimes.current.get(techId) };
  }

  async function send(url: string, method: string, body?: unknown): Promise<BoardSnapshot> {
    writesRef.current += 1;
    setSavePhase("saving");
    try {
      const extra = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
      const response = await fetch(scope(url), {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: revisionRef.current, ...extra }),
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as (BoardSnapshot & { error?: string }) | null;
      if (response.status === 409) {
        const error = new Error(data?.error || "Someone else changed this card. Reload it, then apply your draft again.");
        error.name = "ConflictError";
        throw error;
      }
      if (!response.ok) {
        throw new Error(data?.error || "The board rejected that change.");
      }
      if (!data) throw new Error("The board sent an empty response.");
      applySnapshot(data);
      if (editBase.current && data.nodes) {
        const fresh = data.nodes.find((node) => node.id === editBase.current?.id);
        if (fresh) editBase.current = { id: fresh.id, updatedAt: fresh.updatedAt, revision: data.revision };
      }
      return data;
    } finally {
      writesRef.current -= 1;
      if (writesRef.current === 0) setSavePhase("saved");
    }
  }

  async function reloadOpenCard() {
    setFormError(null);
    await refresh(false);
    if (!editingId) return;
    const updatedAt = cardTimes.current.get(editingId);
    if (updatedAt === undefined) return;
    editBase.current = { id: editingId, updatedAt, revision: revisionRef.current };
  }

  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    setJoined(false);
    setSession("guest");
  }

  async function exportCopy() {
    try {
      const response = await fetch(`/api/campaigns/export?campaign=${encodeURIComponent(campaignId)}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        note(body?.error || "Couldn't export this campaign.");
        return;
      }
      const blob = await response.blob();
      const header = response.headers.get("Content-Disposition") ?? "";
      const matched = /filename="([^"]+)"/.exec(header);
      const filename = matched?.[1] || "campaign.html";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      note("Couldn't export this campaign.");
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

  function askEra() {
    if (eras.length === 0) return;
    if (!displayName) {
      setNameDialogKey((key) => key + 1);
      setRenaming(true);
      return;
    }
    setEraPromptOpen(true);
  }

  function openCreate(eraId: string) {
    if (!displayName) {
      setNameDialogKey((key) => key + 1);
      setRenaming(true);
      return;
    }
    setEraPromptOpen(false);
    setDialogMode("create");
    setEditingId(null);
    setSeed({ ...EMPTY_DRAFT, eraId });
    setFormError(null);
    setFormKey((key) => key + 1);
    setDialogOpen(true);
  }

  function openEdit(node: CapabilityFlowNode) {
    setDialogMode("edit");
    setEditingId(node.id);
    editBase.current = { id: node.id, updatedAt: node.data.updatedAt, revision: revisionRef.current };
    setSeed({
      title: node.data.title,
      description: node.data.description,
      detail: node.data.detail,
      proficiency: node.data.proficiency,
      commitment: node.data.commitment,
      eraId: node.data.eraId,
      milestones: [],
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
        await send("/api/nodes", "POST", {
          ...payload,
          eraId: draft.eraId || eras[0]?.id,
          milestones: draft.milestones.map((milestone) => ({
            name: milestone.name,
            done: milestone.done,
          })),
        });
      } else if (editingId) {
        const stamp = cardStamp(editingId);
        await send(`/api/nodes/${editingId}`, "PATCH", {
          title: draft.title,
          description: draft.description,
          detail: draft.detail,
          proficiency: draft.proficiency,
          commitment: draft.commitment,
          author: displayName,
          ...stamp,
        });
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
      await send(`/api/nodes/${target.id}`, "DELETE", cardStamp(target.id));
    } catch (error) {
      note(error instanceof Error ? error.message : "Couldn't remove that capability.");
    }
  }

  async function persistEdge(source: string, target: string) {
    const author = requireName();
    if (!author) throw new Error("Add your name before changing the board.");
    await send("/api/edges", "POST", { source, target, author });
  }

  async function removeEdge(id: string) {
    await send(`/api/edges/${id}`, "DELETE");
    setSelectedEdgeId(null);
  }

  function celebrate(tone: "milestone" | "researched", text: string, cardId?: string) {
    setCelebration({ tone, text });
    if (cardId) setFlashId(cardId);
    window.setTimeout(() => {
      setCelebration((current) => (current?.text === text ? null : current));
      if (cardId) setFlashId((current) => (current === cardId ? null : current));
    }, tone === "researched" ? 4200 : 2600);
  }

  function requireName(): string | null {
    if (displayName) return displayName;
    setNameDialogKey((key) => key + 1);
    setRenaming(true);
    return null;
  }

  async function addMilestone(name: string) {
    if (!editingId) return;
    const author = requireName();
    if (!author) throw new Error("Add your name before changing the board.");
    await send(`/api/nodes/${editingId}/milestones`, "POST", { name, author, ...cardStamp(editingId) });
  }

  async function toggleMilestone(milestone: Milestone) {
    if (!editingId) return;
    const author = requireName();
    if (!author) throw new Error("Add your name before changing the board.");
    const card = caps.find((node) => node.id === editingId);
    const completing = !milestone.done;
    const doneAfter = (card?.data.milestones.filter((item) => item.done).length ?? 0) + (completing ? 1 : 0);
    const total = card?.data.milestones.length ?? 0;
    const finishesCard = completing && total > 0 && doneAfter === total;
    await send(`/api/nodes/${editingId}/milestones/${milestone.id}`, "PATCH", {
      done: !milestone.done,
      author,
      ...cardStamp(editingId),
    });
    if (finishesCard && card) {
      celebrate("researched", `Researched. Every milestone on ${card.data.title} is done.`, card.id);
    } else if (completing) {
      celebrate("milestone", "Milestone checked off.");
    }
  }

  async function renameMilestone(milestone: Milestone, name: string) {
    if (!editingId) return;
    const author = requireName();
    if (!author) throw new Error("Add your name before changing the board.");
    await send(`/api/nodes/${editingId}/milestones/${milestone.id}`, "PATCH", { name, author, ...cardStamp(editingId) });
  }

  async function deleteMilestone(milestone: Milestone) {
    if (!editingId) return;
    const author = requireName();
    if (!author) throw new Error("Add your name before changing the board.");
    await send(`/api/nodes/${editingId}/milestones/${milestone.id}`, "DELETE", { author, ...cardStamp(editingId) });
  }

  function failLink(error: unknown) {
    note(error instanceof Error ? error.message : "Couldn't add that link.");
  }

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    void persistEdge(connection.source, connection.target).catch(failLink);
  };

  const onConnectEnd: OnConnectEnd = (event, connectionState) => {
    const fromId = connectionState.fromNode?.id;
    if (!fromId || fromId.startsWith("era-") || fromId.startsWith("add-")) return;
    const point = "changedTouches" in event ? event.changedTouches[0] : event;
    const stack = document.elementsFromPoint(point.clientX, point.clientY);
    const host = stack
      .map((element) => (element instanceof Element ? element.closest(".react-flow__node") : null))
      .find((element): element is Element => element !== null);
    const targetId = host?.getAttribute("data-id") ?? "";
    if (!targetId || targetId === fromId || targetId.startsWith("era-") || targetId.startsWith("rule-") || targetId.startsWith("add-")) return;
    if (connectionState.isValid && connectionState.toNode?.id === targetId) return;
    void persistEdge(fromId, targetId).catch(failLink);
  };

  function renameEra(id: string, name: string) {
    const author = requireName();
    if (!author) return;
    void send(`/api/eras/${id}`, "PATCH", { name, author }).catch((error: unknown) => {
      note(error instanceof Error ? error.message : "Couldn't rename that era.");
    });
  }

  function addTechnology(eraId: string) {
    openCreate(eraId);
  }

  async function changeEra(eraId: string) {
    if (!editingId) return;
    const author = requireName();
    if (!author) throw new Error("Add your name before changing the board.");
    await send(`/api/nodes/${editingId}`, "PATCH", { eraId, author, ...cardStamp(editingId) });
  }

  const onNodeDragStart: OnNodeDrag<MeridianNode> = (_event, node) => {
    draggingRef.current = node.id;
    setActiveColumn(nearestColumnIndex(node.position.x, eras.length));
  };

  const onNodeDrag: OnNodeDrag<MeridianNode> = (_event, node) => {
    setActiveColumn(nearestColumnIndex(node.position.x, eras.length));
  };

  const onNodeDragStop: OnNodeDrag<MeridianNode> = (_event, node) => {
    setActiveColumn(null);
    if (node.type !== "capability" || !displayName) {
      draggingRef.current = null;
      return;
    }
    const author = displayName;
    const next = settlePosition(node.position.x, node.position.y, node.id, caps, eras.length);
    draggingRef.current = node.id;
    setCaps((current) =>
      current.map((item) => (item.id === node.id ? { ...item, position: next } : item)),
    );
    const stamp = cardStamp(node.id);
    void send(`/api/nodes/${node.id}`, "PATCH", {
      x: next.x,
      y: next.y,
      author,
      ...stamp,
    })
      .catch((error: unknown) => {
        note(error instanceof Error ? error.message : "Couldn't save that move.");
        void refresh(false);
      })
      .finally(() => {
        draggingRef.current = null;
      });
  };

  const flowNodes = useMemo(() => {
    const eraNodes: EraFlowNode[] = eras.map((era, index) => ({
      id: `era-${era.id}`,
      type: "era",
      position: { x: columnX(index) + BAND_OFFSET_X, y: 8 },
        data: {
        eraId: era.id,
        numeral: roman(index),
        title: era.name,
        hot: activeColumn === index,
      },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      deletable: false,
      className: "nodrag nopan",
      zIndex: 4,
      style: { width: PLAQUE_WIDTH, height: PLAQUE_HEIGHT, visibility: "visible" },
    }));
    const rules: RuleFlowNode[] = eras.slice(0, -1).map((_, index) => {
      const x = columnX(index);
      const next = columnX(index + 1);
      return {
        id: `rule-${index}`,
        type: "rule",
        position: { x: x + NODE_WIDTH + Math.round((next - x - NODE_WIDTH) / 2), y: 0 },
        data: {},
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        deletable: false,
        zIndex: 0,
        style: { width: 1, height: 2200, pointerEvents: "none", visibility: "visible" },
      };
    });
    const addNodes: AddTechFlowNode[] = eras.map((era, index) => {
      const columnCaps = caps.filter((node) => node.data.eraId === era.id);
      const y = columnCaps.length
        ? Math.max(...columnCaps.map((node) => node.position.y)) + NODE_STEP_Y
        : FIRST_NODE_Y;
      return {
        id: `add-${era.id}`,
        type: "add",
        position: { x: columnX(index), y },
        data: { eraId: era.id, eraName: era.name },
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: true,
        deletable: false,
        className: "nodrag nopan",
        zIndex: 4,
        style: { width: PLAQUE_WIDTH, height: 40, visibility: "visible" },
      };
    });
    return [...rules, ...eraNodes, ...addNodes, ...caps];
  }, [activeColumn, caps, eras]);

  const campaign = useMemo(() => {
    return caps.reduce(
      (totals, node) => {
        const counts = milestoneCounts(node.data.milestones);
        totals.done += counts.done;
        totals.total += counts.total;
        return totals;
      },
      { done: 0, total: 0 },
    );
  }, [caps]);

  const awaitingIds = useMemo(() => {
    const stalled = new Set(
      caps
        .filter((node) => milestoneCounts(node.data.milestones).done === 0)
        .map((node) => node.id),
    );
    const waiting = new Set<string>();
    for (const edge of edges) {
      if (stalled.has(edge.source)) waiting.add(edge.target);
    }
    return waiting;
  }, [caps, edges]);

  const campaignPaint = progressPaint(campaign.done, campaign.total);
  const editingNode = caps.find((node) => node.id === editingId) ?? null;
  const leadsTo = editingNode
    ? edges
        .filter((edge) => edge.source === editingNode.id)
        .map((edge) => ({
          id: edge.id,
          title: caps.find((node) => node.id === edge.target)?.data.title ?? "Missing card",
        }))
    : [];
  const comesFrom = editingNode
    ? edges
        .filter((edge) => edge.target === editingNode.id)
        .map((edge) => ({
          id: edge.id,
          title: caps.find((node) => node.id === edge.source)?.data.title ?? "Missing card",
        }))
    : [];
  const linkChoices = editingNode
    ? caps
        .filter(
          (node) =>
            node.id !== editingNode.id &&
            !edges.some((edge) => edge.source === editingNode.id && edge.target === node.id),
        )
        .map((node) => ({ id: node.id, title: node.data.title }))
    : [];

  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const edgeSource = selectedEdge ? caps.find((node) => node.id === selectedEdge.source) : null;
  const edgeTarget = selectedEdge ? caps.find((node) => node.id === selectedEdge.target) : null;
  const deleteTarget = pendingDelete;
  const nameDialogOpen = session === "in" && (renaming || (clientReady && !displayName));
  const invitePath = `/c/${campaignId}`;
  const inviteLink = publicUrl ? `${publicUrl}${invitePath}` : null;

  if (session === "guest") {
    return <SignInPanel onSuccess={() => setSession("in")} />;
  }
  if (session === "loading") {
    return (
      <div className="meridian-shell flex h-dvh items-center justify-center text-sm text-[#9aa6b2]">
        Checking your sign-in…
      </div>
    );
  }

  function askDelete(node: CapabilityFlowNode) {
    setDialogOpen(false);
    setPendingDelete(boardNodeFromFlow(node));
  }

  return (
    <BoardChrome.Provider value={{ flashId, awaitingIds, renameEra, addTechnology }}>
    <div className="meridian-shell flex h-dvh min-h-0 flex-col text-[#f4efe6]">
      <header className="z-20 border-b border-[#e0c088]/25 bg-[#071422]/90 px-3 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-3">
              <h1 className="font-display text-2xl tracking-tight text-[#f6f0e6]">Meridian</h1>
              <span className="font-display truncate text-lg text-[#f3e2b3]" data-testid="campaign-name">
                {campaignName || "Opening"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-[#e0c088] uppercase">
                <span className={`size-1.5 rounded-full ${syncError ? "bg-[#e07a5f]" : "bg-[#3cba9a]"}`} />
                {syncError ? "Reconnecting" : status === "loading" ? "Opening" : "Live"}
              </span>
              {status === "ready" && !syncError ? (
                <span className="text-[11px] font-semibold tracking-[0.16em] text-[#b7f0df] uppercase" data-testid="saved-state">
                  {savePhase === "saving" ? "Saving" : "Saved"}
                </span>
              ) : null}
            </div>
            <p className="max-w-xl text-xs leading-relaxed text-[#9aa6b2] sm:text-sm">
              Pull from the side of a bar onto the one it leads to. Open a bar for the writeup and the milestones.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-[#e0c088]/30 bg-[#0c1a2c]" asChild>
              <Link href="/">Campaigns</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-[#e0c088]/30 bg-[#0c1a2c]"
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-[#e0c088]/30 bg-[#0c1a2c]"
              data-testid="export-campaign"
              onClick={() => void exportCopy()}
            >
              Export HTML
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-[#e0c088]/30 bg-[#0c1a2c]"
              data-testid="invite-campaign"
              onClick={() => {
                setCopied(false);
                setInviteOpen(true);
              }}
            >
              Invite
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="max-w-[10rem] border-[#e0c088]/30 bg-[#0c1a2c]"
              onClick={() => {
                setNameDialogKey((key) => key + 1);
                setRenaming(true);
              }}
              disabled={!clientReady}
            >
              <span className="truncate">{displayName ?? "Your name"}</span>
            </Button>
            <Button size="sm" data-testid="add-technology-header" onClick={askEra}>
              <Plus />
              Add technology
            </Button>
          </div>
        </div>
        <div className="campaign" data-testid="campaign-bar">
          <span className="campaign-kicker">Progress</span>
          <span className="campaign-track" aria-hidden="true">
            <span
              style={{
                width: `${campaign.total === 0 ? 0 : Math.round((campaign.done / campaign.total) * 100)}%`,
                background: campaignPaint.frame,
              }}
            />
          </span>
          <span className="campaign-count">
            {campaign.done} of {campaign.total} milestones
          </span>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <style>{`
          .meridian-flow .react-flow__node-era,
          .meridian-flow .react-flow__node-add {
            z-index: 4 !important;
            pointer-events: all !important;
            visibility: visible !important;
          }
        `}</style>
        <ReactFlow<MeridianNode>
          className="meridian-flow"
          nodes={flowNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={(changes) => {
            onCapsChange(
              changes.filter(
                (change) =>
                  !("id" in change) ||
                  (!change.id.startsWith("era-") && !change.id.startsWith("rule-") && !change.id.startsWith("add-")),
              ) as NodeChange<CapabilityFlowNode>[],
            );
          }}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(event, node) => {
            if (node.type !== "capability") return;
            const target = event.target as HTMLElement | null;
            if (target?.closest(".react-flow__handle")) return;
            setSelectedEdgeId(null);
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
          defaultViewport={{ x: 10, y: 6, zoom: 1 }}
          minZoom={0.2}
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
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="rgba(150,176,204,0.16)" />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>

        {celebration ? (
          <div className={`celebrate celebrate-${celebration.tone}`} role="status">
            {celebration.text}
          </div>
        ) : null}

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
          <Overlay testId="loading-state" title="Opening this campaign" body="Fetching the shared tree." />
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
            body="Each column has Add technology. The header button asks which era, then opens the same form."
          />
        ) : null}

        {selectedEdge && edgeSource && edgeTarget ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
            <div className="pointer-events-auto flex w-full max-w-lg flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e0c088]/25 bg-[#17202a]/95 p-3 shadow-2xl">
              <p className="text-sm text-[#f4efe6]">
                <span className="font-display">{edgeSource.data.title}</span>
                <span className="text-[#9aa6b2]"> leads to </span>
                <span className="font-display">{edgeTarget.data.title}</span>
              </p>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  void removeEdge(selectedEdge.id).catch((error: unknown) => {
                    note(error instanceof Error ? error.message : "Couldn't remove that link.");
                  });
                }}
              >
                Remove link
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={eraPromptOpen} onOpenChange={setEraPromptOpen}>
        <DialogContent data-testid="era-prompt" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Which era?</DialogTitle>
            <DialogDescription>
              The new technology is added to the column you pick.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {eras.map((era) => (
              <Button
                key={era.id}
                type="button"
                variant="outline"
                className="justify-start border-[#e0c088]/35 bg-[#0c1a2c]"
                data-testid="era-prompt-choice"
                onClick={() => openCreate(era.id)}
              >
                {era.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent data-testid="invite-dialog" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Invite</DialogTitle>
            <DialogDescription>
              {inviteLink
                ? "Anyone on the team who opens this link and signs in joins this tree. Only members can edit it."
                : "This copy is only on this machine. Host Meridian before you send a link teammates can open."}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm break-all text-[#d5deea]" data-testid="invite-link">
            {inviteLink ?? invitePath}
          </p>
          {inviteLink ? (
            <Button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(inviteLink).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
      <NameDialog
        key={`name-${nameDialogKey}`}
        open={nameDialogOpen}
        required={!displayName}
        initialName={displayName ?? ""}
        onOpenChange={setRenaming}
        onSave={saveName}
      />
      <CapabilityDialog
        key={`capability-${formKey}`}
        open={dialogOpen}
        mode={dialogMode}
        seed={seed}
        glyph={caps.find((node) => node.id === editingId)?.data.glyph ?? "compass"}
        author={displayName ?? ""}
        milestones={caps.find((node) => node.id === editingId)?.data.milestones ?? []}
        eras={eras}
        eraId={caps.find((node) => node.id === editingId)?.data.eraId ?? seed.eraId}
        onChangeEra={changeEra}
        saving={saving}
        error={formError}
        onReload={reloadOpenCard}
        onOpenChange={setDialogOpen}
        onSubmit={(draft) => void submitDraft(draft)}
        onAddMilestone={addMilestone}
        onToggleMilestone={toggleMilestone}
        onRenameMilestone={renameMilestone}
        onDeleteMilestone={deleteMilestone}
        leadsTo={leadsTo}
        comesFrom={comesFrom}
        linkChoices={linkChoices}
        onAddLink={async (targetId) => {
          if (!editingId) return;
          await persistEdge(editingId, targetId);
        }}
        onRemoveLink={removeEdge}
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
    </BoardChrome.Provider>
  );
}

function boardNodeFromFlow(node: CapabilityFlowNode): BoardNode {
  return {
    id: node.id,
    title: node.data.title,
    description: node.data.description,
    detail: node.data.detail,
    glyph: node.data.glyph,
    proficiency: node.data.proficiency,
    milestones: node.data.milestones,
    commitment: node.data.commitment,
    eraId: node.data.eraId,
    author: node.data.author,
    x: node.position.x,
    y: node.position.y,
    createdAt: 0,
    updatedAt: node.data.updatedAt,
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
