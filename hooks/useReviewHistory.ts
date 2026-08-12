"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearSessions,
  duplicateSession,
  readSessions,
  removeSession,
  upsertSession,
  type ReviewSession,
} from "../lib/session";

export function useReviewHistory() {
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSessions(readSessions(window.localStorage));
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const save = useCallback((session: ReviewSession) => {
    setSessions(upsertSession(window.localStorage, session));
  }, []);

  const remove = useCallback((id: string) => {
    setSessions(removeSession(window.localStorage, id));
  }, []);

  const duplicate = useCallback((session: ReviewSession) => {
    const copy = duplicateSession(session);
    setSessions(upsertSession(window.localStorage, copy));
    return copy;
  }, []);

  const clear = useCallback(() => {
    clearSessions(window.localStorage);
    setSessions([]);
  }, []);

  return { sessions, ready, save, remove, duplicate, clear };
}
