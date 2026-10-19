"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveChannel } from "@/components/realtime/provider";
import type { LiveStatus } from "@/lib/db/schema";
import type { SignalEnvelope } from "./rtc/signals";

export type BroadcastMode = "browser" | "encoder" | null;

export type ChatMessage = { id: string; body: string; createdAt: string; userId: string; name: string; host: boolean };
export type FloatingReaction = { key: number; emoji: string; x: number };

let reactionSeq = 0;

/**
 * State for one live class, kept current by the class's realtime channel:
 * status changes, chat, pinned note, viewer count and floating reactions.
 */
export function useLiveRoom({
  sessionId,
  viewerId,
  status: initialStatus,
  mode: initialMode,
  chat: initialChat,
  pinned: initialPinned,
  viewers: initialViewers,
  onSignal,
  onHostReady,
}: {
  sessionId: string;
  viewerId: string;
  status: LiveStatus;
  mode: BroadcastMode;
  chat: ChatMessage[];
  pinned: string | null;
  viewers: number;
  /** WebRTC signalling addressed to this person (browser broadcasts). */
  onSignal?: (envelope: SignalEnvelope) => void;
  /** The host started or resumed a browser broadcast. */
  onHostReady?: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [mode, setMode] = useState<BroadcastMode>(initialMode);
  const callbacks = useRef({ onSignal, onHostReady });
  useEffect(() => {
    callbacks.current = { onSignal, onHostReady };
  });
  const [chat, setChat] = useState(initialChat);
  const [pinned, setPinned] = useState(initialPinned);
  const [viewers, setViewers] = useState(initialViewers);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const refresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 300);
  }, [router]);

  const spawnReaction = useCallback((emoji: string) => {
    const key = ++reactionSeq;
    setReactions((r) => [...r.slice(-24), { key, emoji, x: 8 + Math.random() * 30 }]);
    setTimeout(() => setReactions((r) => r.filter((x) => x.key !== key)), 2600);
  }, []);

  const addChat = useCallback((m: ChatMessage) => {
    setChat((list) => (list.some((x) => x.id === m.id) ? list : [...list.slice(-299), m]));
  }, []);

  const connection = useLiveChannel(sessionId, (m) => {
    const data = m.data as Record<string, unknown>;
    switch (m.type) {
      case "live.status": {
        const next = data.status as LiveStatus;
        const nextMode = (data.broadcastMode as BroadcastMode) ?? null;
        setStatus(next);
        setMode(nextMode);
        if (next === "live" && nextMode === "browser") callbacks.current.onHostReady?.();
        refresh();
        break;
      }
      case "live.signal":
        callbacks.current.onSignal?.(data as unknown as SignalEnvelope);
        break;
      case "live.chat":
        addChat(data.message as ChatMessage);
        break;
      case "live.chat.deleted":
        setChat((list) => list.filter((x) => x.id !== data.id));
        break;
      case "live.pinned":
        setPinned((data.note as string | null) ?? null);
        break;
      case "live.viewers":
        setViewers(data.count as number);
        break;
      case "live.reaction":
        // Our own reactions were already shown when clicked.
        if (data.by !== viewerId) spawnReaction(data.emoji as string);
        break;
      case "live.replay":
      case "live.updated":
        refresh();
        break;
    }
  });

  return {
    status,
    setStatus,
    mode,
    setMode,
    chat,
    addChat,
    setChat,
    pinned,
    setPinned,
    viewers,
    setViewers,
    reactions,
    spawnReaction,
    connection,
    refresh,
  };
}
