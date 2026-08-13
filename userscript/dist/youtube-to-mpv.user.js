// ==UserScript==
// @name         Steam to MPV (YouTube)
// @namespace    https://github.com/jcchikikomori/stream-to-mpv
// @version      0.3.0
// @description  Open YouTube videos directly in MPV media player via system protocol handlers
// @author       John Cyrill Corsanes
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @license      MIT
// @updateURL    https://raw.githubusercontent.com/jcchikikomori/stream-to-mpv/main/userscript/dist/youtube-to-mpv.user.js
// @installURL   https://raw.githubusercontent.com/jcchikikomori/stream-to-mpv/main/userscript/dist/youtube-to-mpv.user.js
// ==/UserScript==


"use strict";(()=>{var re=Object.defineProperty;var oe=(e,t,n)=>t in e?re(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var i=(e,t,n)=>oe(e,typeof t!="symbol"?t+"":t,n);var p=class extends Error{constructor(t,n){super(t,n),this.name=new.target.name}},v=class extends p{},C=class extends v{},M=class extends p{constructor(n,r,o){super(n);i(this,"statusCode");i(this,"body");this.statusCode=r,this.body=o}},x=class extends p{};var H=new Set(["127.0.0.1","localhost","[::1]"]);function _(e){let t=new URL(e);if(t.protocol!=="http:")throw new RangeError(`mpv-handler base URL must use http:, got "${t.protocol}"`);if(t.username||t.password)throw new RangeError("mpv-handler base URL must not contain credentials");if(!H.has(t.hostname)){let n=[...H].join(", ");throw new RangeError(`mpv-handler base URL host must be loopback (one of ${n}), got "${t.hostname}"`)}}function N(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}function A(e,t){return Object.keys(e).find(n=>!t.includes(n))}var j={safeParse(e){if(!N(e))return{success:!1,error:{message:"expected an object"}};let t=A(e,["status","message"]);return t?{success:!1,error:{message:`unexpected key "${t}"`}}:e.status!=="ok"&&e.status!=="error"?{success:!1,error:{message:'status must be "ok" or "error"'}}:e.message!==void 0&&typeof e.message!="string"?{success:!1,error:{message:"message must be a string"}}:{success:!0,data:e.message!==void 0?{status:e.status,message:e.message}:{status:e.status}}}},B={safeParse(e){if(!N(e))return{success:!1,error:{message:"expected an object"}};let t=A(e,["status"]);return t?{success:!1,error:{message:`unexpected key "${t}"`}}:e.status!=="running"?{success:!1,error:{message:'status must be "running"'}}:{success:!0,data:{status:"running"}}}};var se="http://127.0.0.1:38421",ie=5e3;function ae(e){return typeof e=="object"&&e!==null&&"message"in e&&typeof e.message=="string"}var T=class{constructor(t={}){i(this,"baseUrl");i(this,"timeoutMs");i(this,"fetchImpl");this.baseUrl=t.baseUrl??se,this.timeoutMs=t.timeoutMs??ie,this.fetchImpl=t.fetchImpl??fetch,t.allowNonLoopback?console.warn(`[YouTube to MPV] MpvHandlerClient constructed with allowNonLoopback=true for baseUrl "${this.baseUrl}" \u2014 the loopback SSRF guard is disabled for this instance.`):_(this.baseUrl)}async play(t,n={}){let r=n.timestampSeconds??null;if(r!==null&&!(Number.isFinite(r)&&r>=0))throw new RangeError(`timestampSeconds must be a finite number >= 0, got ${String(r)}`);return this.request("/play",{url:t,t:r!==null?String(r):void 0},j)}async health(){return this.request("/health",{},B)}buildRequestUrl(t,n){let r=Object.entries(n).filter(s=>s[1]!==void 0).map(([s,c])=>`${s}=${encodeURIComponent(c)}`),o=r.length>0?`?${r.join("&")}`:"";return`${this.baseUrl}${t}${o}`}async request(t,n,r){let o=this.buildRequestUrl(t,n),s;try{s=await this.fetchImpl(o,{signal:AbortSignal.timeout(this.timeoutMs)})}catch(l){throw l instanceof Error&&l.name==="TimeoutError"?new C(`mpv-handler did not respond within ${this.timeoutMs}ms (${o})`,{cause:l}):new v(`mpv-handler unreachable at ${this.baseUrl}`,{cause:l})}let c=await s.text(),a;try{a=c.length>0?JSON.parse(c):void 0}catch(l){throw new x("mpv-handler returned a non-JSON response",{cause:l})}if(!s.ok){let l=ae(a)?a.message:`HTTP ${s.status}`;throw new M(`mpv-handler rejected the request: ${l}`,s.status,a)}let w=r.safeParse(a);if(!w.success)throw new x(`mpv-handler response failed validation: ${w.error.message}`);return w.data}};var g=class extends Error{};var P=class{constructor(t){i(this,"client");this.client=t}async open(t,n={}){let r=this.resolveUrl(t);if(!r)throw new g(`${this.platform}: not a valid URL or ID: ${t}`);let o=n.timestampSeconds??null;return await this.client.play(r,{timestampSeconds:o}),{resolvedUrl:r,timestampSeconds:o}}};var le=/^[a-zA-Z0-9_-]{11}$/,ue=new Set(["www.youtube.com","youtube.com","m.youtube.com"]),ce="youtu.be",me=/^\/shorts\/([^/]+)$/;function u(e){return le.test(e)}function de(e){if(e.protocol!=="https:"||e.username||e.password)return null;if(ue.has(e.hostname)){if(e.pathname==="/watch"){let n=e.searchParams.get("v");return n&&u(n)?n:null}let t=me.exec(e.pathname);if(t){let n=t[1];if(n&&u(n))return n}return null}if(e.hostname===ce){let t=e.pathname.slice(1);if(u(t))return t}return null}function S(e){let t=e.trim();if(u(t))return t;try{return de(new URL(t))}catch{return null}}function I(e){return u(e)?`https://www.youtube.com/watch?v=${e}`:null}var pe=/^\d+$/,fe=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;function E(e){if(!e)return null;if(pe.test(e))return parseInt(e,10);let t=fe.exec(e);if(!t||!(t[1]||t[2]||t[3]))return null;let n=parseInt(t[1]??"0",10),r=parseInt(t[2]??"0",10),o=parseInt(t[3]??"0",10);return n*3600+r*60+o}var R=class extends P{constructor(){super(...arguments);i(this,"platform","youtube")}supports(n){return S(n)!==null}resolveUrl(n){let r=S(n);return r?I(r):null}parseTimestamp(n){return E(n)}};function D(e,t,n={}){let r=n.mpvPath??"mpv",o=n.platform==="windows",s=t!==null?` --start=${t}`:"";return o?`${r} "${e}"${s}`:`${r} '${e}'${s}`}async function Y(e){try{return await navigator.clipboard.writeText(e),{copied:!0}}catch{return{copied:!1}}}var ge={mpvPath:"mpv",showButton:!0,autoPlaylist:!1,enableNativeMenuItems:!0};function m(e){return GM_getValue(e,ge[e])}function k(e,t){GM_setValue(e,t)}var q="mpv-toast";function h(e,t,n){document.getElementById(q)?.remove();let r=window.matchMedia("(prefers-color-scheme: dark)").matches,o=t==="error",s=o?"#e74c3c":r?"#333":"#fff",c=o||r?"#fff":"#333",a=o?"transparent":r?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.1)",w=o?"rgba(255,255,255,0.2)":r?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.05)",l=o?"rgba(255,255,255,0.3)":r?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.1)",ne=o||r?"#fff":"#333",d=document.createElement("div");d.id=q,d.style.cssText=`
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${s};
    color: ${c};
    border: 1px solid ${a};
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 99999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: mpv-fade-in 0.3s ease;
    display: flex;
    align-items: center;
    gap: 12px;
  `;let V=document.createElement("span");if(V.textContent=e,d.appendChild(V),n!==void 0){let f=document.createElement("button");f.textContent="Copy",f.style.cssText=`
      background: ${w};
      border: 1px solid ${l};
      color: ${ne};
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `,f.onclick=()=>{navigator.clipboard.writeText(n).then(()=>{f.textContent="Copied!",setTimeout(()=>{f.textContent="Copy"},1e3)}).catch(()=>{})},d.appendChild(f)}document.body.appendChild(d),setTimeout(()=>{d.style.animation="mpv-fade-out 0.3s ease",setTimeout(()=>d.remove(),300)},5e3)}function he(){let e=/[?&]v=([^&]+)/.exec(window.location.search);if(e?.[1]&&u(e[1]))return e[1];let t=window.ytInitialPlayerResponse?.videoDetails?.videoId;if(t&&u(t))return t;let n=document.querySelector('meta[itemprop="videoId"]')?.getAttribute("content");return n&&u(n)?n:null}function b(e=he()){return e?I(e):null}function be(e){if(!e)return null;try{let t=new URL(e,window.location.origin).searchParams.get("v");return t&&u(t)?t:null}catch{return null}}function ye(e){if(!e)return null;try{return E(new URL(e,window.location.origin).searchParams.get("t"))}catch{return null}}function y(e,t,n){if(!t){console.error("[YouTube to MPV] Could not extract video URL"),h("Failed to extract video URL","error");return}e.openInMpv(t,n)}function W(){let e=document.querySelector("video"),t=e?Math.floor(e.currentTime):0;return t>0?t:null}var X=`
  <path d="M8 5v14l11-7z"/>
  <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3z" fill-opacity="0.7"/>
`,we=`<svg height="24" width="24" viewBox="0 0 24 24" fill="white">${X}</svg>`,J=`<svg height="24" width="24" viewBox="0 0 24 24" fill="currentColor">${X}</svg>`,L="mpv-open-btn";function U(e){if(!m("showButton")||document.getElementById(L))return;let t=document.querySelector(".ytp-right-controls");if(!t)return;let n=document.createElement("button");n.id=L,n.className="ytp-button",n.title="Open in MPV (Ctrl+Shift+M)",n.innerHTML=we,n.style.cssText=`
    padding: 0 8px;
    min-width: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  `,n.addEventListener("click",r=>{r.stopPropagation(),y(e,b(),null)}),t.prepend(n)}function Z(){document.getElementById(L)?.remove()}var ve="ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model",O=null;function xe(e){return e.querySelector('a#thumbnail, a[href*="/watch"]')?.getAttribute("href")??null}function $(){document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0,cancelable:!0}))}function F(e,t){let n=document.createElement("div");n.className="ytp-menuitem",n.setAttribute("role","menuitem"),n.tabIndex=0,n.innerHTML=`
    <div class="ytp-menuitem-icon">${J}</div>
    <div class="ytp-menuitem-label"></div>
    <div class="ytp-menuitem-content"></div>
  `;let r=n.querySelector(".ytp-menuitem-label");return r&&(r.textContent=e),n.addEventListener("click",o=>{o.stopPropagation(),t()}),n}function Ce(e){let t=e.closest(".ytp-panel"),n=e.closest(".ytp-contextmenu"),r=`${e.scrollHeight}px`;e.style.height=r,t&&(t.style.height=r),n&&(n.style.height=r)}function Me(e){if(!m("enableNativeMenuItems"))return;let t=document.querySelector(".ytp-contextmenu .ytp-panel-menu");!t||t.dataset.mpvInjected||/copy video url/i.test(t.textContent??"")&&(t.dataset.mpvInjected="true",t.appendChild(F("Open in MPV",()=>{y(e,b(),null),$()})),t.appendChild(F("Open in MPV at current time",()=>{y(e,b(),W()),$()})),Ce(t))}function Te(e,t){let n=document.createElement("div");n.className="mpv-row-menuitem",n.setAttribute("role","menuitem"),n.tabIndex=0,n.innerHTML=J;let r=document.createElement("span");return r.textContent=e,n.appendChild(r),n.addEventListener("click",o=>{o.stopPropagation(),t()}),n}function Pe(e){if(!m("enableNativeMenuItems")||!O)return;let t=document.querySelector("ytd-popup-container");if(!t)return;let n=t.querySelector("tp-yt-paper-listbox#items, yt-list-view-model");!n||n.dataset.mpvInjected||/add to queue|save to playlist/i.test(n.textContent??"")&&(n.dataset.mpvInjected="true",n.appendChild(Te("Open in MPV",()=>{let r=O;r&&(y(e,b(r.videoId),r.timestamp),$())})))}var K="";function G(e){let t=window.location.href;t!==K&&(K=t,Z(),window.location.pathname.startsWith("/watch")&&setTimeout(()=>U(e),500))}var z="mpv-open-styles";function Ie(){if(document.getElementById(z))return;let e=document.createElement("style");e.id=z,e.textContent=`
    @keyframes mpv-fade-in {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes mpv-fade-out {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to { opacity: 0; transform: translateX(-50%) translateY(10px); }
    }
    /* Overrides YouTube's "Delhi" redesign, which pads every .ytp-button svg (12px 12px) and
       would otherwise squeeze our fixed-size icon down to a sliver. The #id selector outranks
       that rule's 4 classes regardless of stylesheet order. */
    #mpv-open-btn svg {
      width: 24px;
      height: 24px;
      padding: 0;
      display: block;
    }
    .mpv-row-menuitem {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 16px;
      font-size: 14px;
      line-height: 20px;
      cursor: pointer;
      color: #0f0f0f;
    }
    .mpv-row-menuitem svg {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }
    .mpv-row-menuitem:hover {
      background: rgba(0, 0, 0, 0.1);
    }
    html[dark] .mpv-row-menuitem {
      color: #fff;
    }
    html[dark] .mpv-row-menuitem:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  `,document.head.appendChild(e)}function Q(e){Ie(),document.addEventListener("click",n=>{let r=n.target;if(!(r instanceof Element))return;let o=r.closest('button[aria-label="Action menu" i], button[aria-label="More actions" i]');if(!o)return;let s=o.closest(ve),c=s?xe(s):null,a=be(c);O=a?{videoId:a,timestamp:ye(c)}:null},!0),new MutationObserver(()=>{G(e),Me(e),Pe(e)}).observe(document.body,{childList:!0,subtree:!0}),window.addEventListener("popstate",()=>G(e)),document.addEventListener("keydown",n=>{n.ctrlKey&&n.shiftKey&&n.key==="M"&&(n.preventDefault(),y(e,b(),W()))}),GM_registerMenuCommand("Open current video in MPV",()=>{y(e,b(),null)}),GM_registerMenuCommand("Toggle button visibility",()=>{let n=m("showButton");k("showButton",!n),n?Z():U(e)}),GM_registerMenuCommand("Toggle MPV menu items",()=>{k("enableNativeMenuItems",!m("enableNativeMenuItems"))}),window.location.pathname.startsWith("/watch")&&(document.readyState==="complete"?U(e):window.addEventListener("load",()=>U(e)))}var ee=(e,t)=>new Promise((n,r)=>{let o=GM_xmlhttpRequest({method:"GET",url:e,onload:s=>{n({ok:s.status>=200&&s.status<300,status:s.status,text:()=>Promise.resolve(s.responseText)})},onerror:()=>{r(new Error(`GM_xmlhttpRequest network error requesting ${e}`))}});t?.signal?.addEventListener("abort",()=>{o.abort(),r(t.signal?.reason)})});function te(e){let t=e.toLowerCase();return t.includes("linux")?"linux":t.includes("mac")?"mac":t.includes("win")?"windows":"unknown"}var Ee=new T({fetchImpl:ee}),Re=new R(Ee);async function Ue(e,t){try{await Re.open(e,{timestampSeconds:t}),h("Opening in MPV...","success",e)}catch(n){if(n instanceof g){console.error("[YouTube to MPV]",n.message),h("Failed to extract video URL","error");return}if(n instanceof p){console.error("[YouTube to MPV] handler unreachable:",n.message);let r=D(e,t,{mpvPath:m("mpvPath"),platform:te(navigator.platform)}),{copied:o}=await Y(r);h(o?`Handler offline. Copied: ${r}`:`Run: ${r}`,"warning",r);return}throw n}}Q({openInMpv:Ue});})();
