'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { BatchWithPackets, PermitBatch, PermitPacket, PermitStore } from './types';

const LOCAL_KEY = 'permit-packet-tracker-v1';
const ACTIVITY_KEY = 'permit-packet-tracker-activity-v1';

let cache: PermitStore = { batches: [], packets: [], syncMode: 'local-fallback' };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getStore() {
  return cache;
}

export function usePermitStore() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, getStore, getStore);
}

export function initializeFallbackStore() {
  if (typeof window === 'undefined') return cache;
  const raw = window.localStorage.getItem(LOCAL_KEY);
  if (!raw) return cache;
  try {
    cache = JSON.parse(raw) as PermitStore;
  } catch {
    cache = { batches: [], packets: [], syncMode: 'local-fallback' };
  }
  return cache;
}

export async function loadStore() {
  const response = await fetch('/api/store', { cache: 'no-store', credentials: 'include' });
  if (!response.ok) throw new Error('Unable to load permit store.');
  const body = await response.json();
  const serverStore = body.store as PermitStore;

  // When Supabase isn't configured the server returns an empty in-memory store
  // that resets on every cold start. Use localStorage as the real source of truth.
  if (serverStore.syncMode === 'local-fallback') {
    cache = initializeFallbackStore();
    emit();
    return cache;
  }

  cache = serverStore;
  emit();
  return cache;
}

export async function saveStore(next: PermitStore, options?: { reconcilePacketBatchIds?: string[] }) {
  const response = await fetch('/api/store', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...next, reconcilePacketBatchIds: options?.reconcilePacketBatchIds }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'Unable to save permit store.');
  }
  cache = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  }
  emit();
}

export function recordActivity(entry: { label: string; detail?: string }) {
  if (typeof window === 'undefined') return;
  const existing = window.localStorage.getItem(ACTIVITY_KEY);
  const items = existing ? (JSON.parse(existing) as Array<{ label: string; detail?: string; at: string }>) : [];
  items.unshift({ label: entry.label, detail: entry.detail, at: new Date().toISOString() });
  window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(items.slice(0, 20)));
}

export function getActivityLog() {
  if (typeof window === 'undefined') return [] as Array<{ label: string; detail?: string; at: string }>;
  const existing = window.localStorage.getItem(ACTIVITY_KEY);
  if (!existing) return [];
  try {
    return JSON.parse(existing) as Array<{ label: string; detail?: string; at: string }>;
  } catch {
    return [];
  }
}

export async function initializeStore(_orgId?: string) {
  await loadStore().catch(() => void 0);
}

export function setCurrentOrganization(_orgId: string | undefined) {}

export function useHydrateFallback() {
  useEffect(() => {
    initializeFallbackStore();
  }, []);
}

export async function refreshStore() {
  await loadStore();
}

export const batchesStore = {
  getAll: () => [...cache.batches],
  save: async (batches: PermitBatch[]) => {
    await saveStore({ ...cache, batches });
  },
  upsert: async (batch: PermitBatch) => {
    const next = cache.batches.some((item) => item.id === batch.id)
      ? cache.batches.map((item) => item.id === batch.id ? batch : item)
      : [batch, ...cache.batches];
    await saveStore({ ...cache, batches: next });
  },
};

export const packetsStore = {
  getAll: () => [...cache.packets],
  save: async (packets: PermitPacket[]) => {
    await saveStore({ ...cache, packets });
  },
  upsert: async (packet: PermitPacket) => {
    const next = cache.packets.some((item) => item.id === packet.id)
      ? cache.packets.map((item) => item.id === packet.id ? packet : item)
      : [packet, ...cache.packets];
    await saveStore({ ...cache, packets: next });
  },
};

export function batchWithPackets(store = cache): BatchWithPackets[] {
  const packetsByBatch = new Map<string, PermitPacket[]>();
  for (const packet of store.packets) {
    const list = packetsByBatch.get(packet.batchId) || [];
    list.push(packet);
    packetsByBatch.set(packet.batchId, list);
  }
  return store.batches.map((batch) => ({ ...batch, packets: packetsByBatch.get(batch.id) || [] }));
}
