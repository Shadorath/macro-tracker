/**
 * Toast at the bottom of the screen: 3 s, or 5 s when it offers Undo.
 */

import { useEffect } from 'preact/hooks';

export type ToastData = { id: number; text: string; undo?: () => void };

export function Toast({ toast, onDone }: { toast: ToastData; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, toast.undo ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [toast.id]);

  return (
    <div class="toast" role="status">
      <span>{toast.text}</span>
      {toast.undo && (
        <button onClick={() => { toast.undo!(); onDone(); }}>Undo</button>
      )}
    </div>
  );
}
