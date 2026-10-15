"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    FB?: { XFBML: { parse: (element?: Element) => void } };
  }
}

const SDK_ID = "facebook-jssdk";
// xfbml=1: SDK ачаалагдмагц хуудсан дээрх бүх .fb-post-ийг өөрөө зурна
const SDK_SRC = "https://connect.facebook.net/mn_MN/sdk.js#xfbml=1&version=v23.0";
// Facebook-ийн embed постын зөвшөөрөгдөх өргөн
const MIN_WIDTH = 350;
const MAX_WIDTH = 750;

/** Facebook постыг (зураг, текстийн хамт) албан ёсны SDK-аар харуулна — өндрийг SDK өөрөө тохируулна */
export function FacebookPost({ href }: { href: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    const post = el?.querySelector(".fb-post");
    if (!el || !post) return;
    post.setAttribute(
      "data-width",
      String(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(el.clientWidth))))
    );

    if (window.FB) {
      window.FB.XFBML.parse(el);
      return;
    }
    if (document.getElementById(SDK_ID)) return; // ачаалагдаж байна — дуусахаараа зурна

    if (!document.getElementById("fb-root")) {
      const root = document.createElement("div");
      root.id = "fb-root";
      document.body.prepend(root);
    }
    const script = document.createElement("script");
    script.id = SDK_ID;
    script.src = SDK_SRC;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    document.body.appendChild(script);
  }, [href]);

  return (
    <div ref={container} className="flex w-full justify-center">
      <div key={href} className="fb-post" data-href={href} data-show-text="true">
        {/* class нь яг "fb-xfbml-parse-ignore" байх ёстой — өөр class нэмбэл SDK постыг зурахгүй орхидог */}
        <blockquote cite={href} className="fb-xfbml-parse-ignore">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground underline hover:text-primary"
          >
            Facebook дээр үзэх
          </a>
        </blockquote>
      </div>
    </div>
  );
}
