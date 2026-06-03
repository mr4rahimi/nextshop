"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

export default function StorySection() {
  const [stories, setStories] = useState<any[]>([]);
  const [ready, setReady] = useState(false);

  
  useEffect(() => {
    fetch("/api/store/stories")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setStories(data);
        }
      })
      .catch(() => {});
  }, []);

 
  useEffect(() => {
    if (!ready || stories.length === 0) return;

    const interval = setInterval(() => {
      const StoryPlayerClass = (window as any).StoryPlayer;
      if (StoryPlayerClass) {
   
        const container = document.getElementById("stories-container");
        if (container) container.innerHTML = "";
        new StoryPlayerClass("stories-container", stories);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [ready, stories]);

  if (stories.length === 0) return null;

  return (
    <>
      <section className="pt-12">
        <div className="container">
          <div id="stories-container" />
        </div>
      </section>

      <Script
        src="/assets/js/plugin/story-player/story-player.js"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
    </>
  );
}
