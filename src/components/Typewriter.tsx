"use client";

import { useEffect, useState } from "react";

/** RPG-style text that types itself out; click to reveal it all at once. */
export default function Typewriter({ text, speed = 28 }: { text: string; speed?: number }) {
  const [shown, setShown] = useState({ text, n: 0 });
  const n = shown.text === text ? shown.n : 0;

  useEffect(() => {
    if (n >= text.length) return;
    const id = setTimeout(() => setShown({ text, n: n + 1 }), speed);
    return () => clearTimeout(id);
  }, [text, n, speed]);

  const done = n >= text.length;
  return (
    <span onClick={() => setShown({ text, n: text.length })} aria-label={text}>
      <span aria-hidden>{text.slice(0, n)}</span>
      {!done && <span className="anim-caret" aria-hidden>_</span>}
      {done && (
        <span className="anim-bounce ml-1 inline-block text-sun" aria-hidden>
          ▼
        </span>
      )}
    </span>
  );
}
