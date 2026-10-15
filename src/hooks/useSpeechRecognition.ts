/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { hasSpeechRecognition, speechLanguageTag } from '@/src/lib/ask/speech';
import type { LanguageMode } from '@/src/lib/ask/types';
import { playVoiceCue, primeVoiceCues } from '@/src/lib/ask/voiceCues';

export type SpeechError = 'permission' | 'no-speech' | 'network' | 'other';

export interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  transcript: string;
  interim: string;
  error: SpeechError | null;
  start: () => void;
  stop: () => void;
}

/**
 * Wrap the Web Speech API with a small, controlled hook. One recognizer runs at
 * a time, reports interim and final text, and maps common error codes to a
 * stable error union.
 *
 * The session is continuous and only the user ends it. Chrome still fires
 * `onend` after a long silence even with `continuous`, so `onend` restarts the
 * recognizer while the session is live: a pause must not stop dictation.
 */
export function useSpeechRecognition(language: LanguageMode): UseSpeechRecognitionResult {
  const lang = useMemo(() => speechLanguageTag(language), [language]);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<SpeechError | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  /** True from the moment the user starts until they stop: keeps the mic live. */
  const activeRef = useRef(false);
  const prevLangRef = useRef(lang);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setSupported(false);
      return;
    }
    setSupported(hasSpeechRecognition(window));
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    const wasActive = activeRef.current;
    activeRef.current = false;
    recognitionRef.current = null;
    setListening(false);
    setInterim('');
    if (wasActive) {
      playVoiceCue('stop');
    }
    if (!recognition) {
      return;
    }
    try {
      // Detach first, then abort: a trailing onresult or onend must not reach a
      // session that is already over.
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    } catch {
      // Best effort shutdown.
    }
  }, []);

  const start = useCallback(() => {
    if (typeof window === 'undefined' || !supported || activeRef.current) {
      return;
    }
    const Recognizer = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (typeof Recognizer !== 'function') {
      return;
    }

    setError(null);
    setTranscript('');
    setInterim('');

    const recognition = new Recognizer();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const alternative = result.item(0);
        if (!alternative) {
          continue;
        }
        if (result.isFinal) {
          const finalText = alternative.transcript;
          setTranscript((prev) => prev + finalText);
        } else {
          interimText += alternative.transcript;
        }
      }
      setInterim(interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = event.error;
      const wasActive = activeRef.current;
      activeRef.current = false;
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
      if (wasActive) {
        playVoiceCue('stop');
      }
      if (code === 'aborted') {
        // A user or programmatic stop, not a failure to report.
        return;
      }
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('permission');
      } else if (code === 'no-speech') {
        setError('no-speech');
      } else if (code === 'network') {
        setError('network');
      } else {
        setError('other');
      }
    };

    recognition.onend = () => {
      if (activeRef.current) {
        // A pause, not a stop: restart so dictation continues until the user
        // ends it. A throw here means the recognizer cannot run again, so the
        // session is over rather than looping.
        try {
          recognition.start();
          return;
        } catch {
          activeRef.current = false;
        }
      }
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;
    activeRef.current = true;
    // The tap is the user gesture: prime the context here and cue the start, so
    // the sound does not need a moment of already-running audio to be allowed.
    primeVoiceCues();
    playVoiceCue('start');
    try {
      recognition.start();
    } catch {
      activeRef.current = false;
      recognitionRef.current = null;
      setError('other');
    }
  }, [lang, supported]);

  useEffect(() => {
    if (prevLangRef.current === lang) {
      return;
    }
    prevLangRef.current = lang;
    stop();
  }, [lang, stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    supported,
    listening,
    transcript,
    interim,
    error,
    start,
    stop,
  };
}
