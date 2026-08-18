"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Language } from "../lib/analysis";

export type NarratorState = "idle" | "loading" | "speaking" | "paused" | "unsupported" | "unavailable" | "error";

function languageCode(language: Language) {
  return language === "pt" ? "pt-BR" : "en-US";
}

export function useNarrator(language: Language) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [state, setState] = useState<NarratorState>("idle");

  useEffect(() => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      queueMicrotask(() => setState("unsupported"));
      return;
    }

    const refreshVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
      setVoicesLoaded(true);
    };
    refreshVoices();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
    };
  }, []);

  const voice = useMemo(() => {
    const exact = languageCode(language).toLowerCase();
    const base = language.toLowerCase();
    return voices.find((item) => item.lang.toLowerCase() === exact)
      ?? voices.find((item) => item.lang.toLowerCase().startsWith(base))
      ?? null;
  }, [language, voices]);

  const speak = useCallback((text: string) => {
    if (!text.trim()) return;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setState("unsupported");
      return;
    }

    if (voicesLoaded && !voice) {
      setState("unavailable");
      return;
    }

    window.speechSynthesis.cancel();
    setState("loading");
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = languageCode(language);
    utterance.rate = 0.94;
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setState("speaking");
    utterance.onpause = () => setState("paused");
    utterance.onresume = () => setState("speaking");
    utterance.onend = () => setState("idle");
    utterance.onerror = (event) => {
      setState(event.error === "canceled" || event.error === "interrupted" ? "idle" : "error");
    };
    window.speechSynthesis.speak(utterance);
  }, [language, voice, voicesLoaded]);

  const stop = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setState("idle");
  }, []);

  const pause = useCallback(() => {
    if (!("speechSynthesis" in window) || !window.speechSynthesis.speaking) return;
    window.speechSynthesis.pause();
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    if (!("speechSynthesis" in window) || !window.speechSynthesis.paused) return;
    window.speechSynthesis.resume();
    setState("speaking");
  }, []);

  return { state, speak, pause, resume, stop, voiceName: voice?.name ?? null };
}
