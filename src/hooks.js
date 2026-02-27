import { useState, useRef, useEffect } from "react";

export function useTypewriter(text, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idRef = useRef(null);
  useEffect(() => {
    if (!text) { setDisplayed(""); setDone(true); return; }
    setDisplayed(""); setDone(false);
    let i = 0;
    idRef.current = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(idRef.current); setDone(true); }
    }, speed);
    return () => clearInterval(idRef.current);
  }, [text, speed]);
  return { displayed, done };
}
