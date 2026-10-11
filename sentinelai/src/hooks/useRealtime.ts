// src/hooks/useRealtime.ts
"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

interface UseRealtimeOptions<T> {
  table: string;
  filter?: string;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: T) => void;
}

export function useRealtime<T>({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeOptions<T>) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const channelConfig: Parameters<typeof supabase.channel>[1] = { config: {} };

    channelRef.current = supabase
      .channel(`realtime-${table}-${filter ?? "all"}`, channelConfig)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: any) => {
          if (payload.eventType === "INSERT" && onInsert) {
            onInsert(payload.new as T);
          } else if (payload.eventType === "UPDATE" && onUpdate) {
            onUpdate(payload.new as T);
          } else if (payload.eventType === "DELETE" && onDelete) {
            onDelete(payload.old as T);
          }
        }
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [table, filter]);
}