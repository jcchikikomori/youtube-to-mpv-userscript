// ==UserScript==
// @name         Steam to MPV (YouTube)
// @namespace    https://github.com/jcchikikomori/stream-to-mpv
// @version      0.4.0
// @description  Open YouTube videos directly in MPV media player via system protocol handlers
// @author       John Cyrill Corsanes
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-idle
// @license      MIT
// @updateURL    https://raw.githubusercontent.com/jcchikikomori/stream-to-mpv/main/userscript/dist/youtube-to-mpv.user.js
// @installURL   https://raw.githubusercontent.com/jcchikikomori/stream-to-mpv/main/userscript/dist/youtube-to-mpv.user.js
// ==/UserScript==


"use strict";(()=>{var oe=Object.defineProperty;var se=(e,t,n)=>t in e?oe(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var i=(e,t,n)=>se(e,typeof t!="symbol"?t+"":t,n);var p=class extends Error{constructor(t,n){super(t,n),this.name=new.target.name}},w=class extends p{},C=class extends w{},M=class extends p{constructor(n,r,o){super(n);i(this,"statusCode");i(this,"body");this.statusCode=r,this.body=o}},x=class extends p{};var _=new Set(["127.0.0.1","localhost","[::1]"]);function k(e){let t=new URL(e);if(t.protocol!=="http:")throw new RangeError(`mpv-handler base URL must use http:, got "${t.protocol}"`);if(t.username||t.password)throw new RangeError("mpv-handler base URL must not contain credentials");if(!_.has(t.hostname)){let n=[..._].join(", ");throw new RangeError(`mpv-handler base URL host must be loopback (one of ${n}), got "${t.hostname}"`)}}function N(e){try{return k(e),!0}catch{return!1}}function A(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}function j(e,t){return Object.keys(e).find(n=>!t.includes(n))}var B={safeParse(e){if(!A(e))return{success:!1,error:{message:"expected an object"}};let t=j(e,["status","message"]);return t?{success:!1,error:{message:`unexpected key "${t}"`}}:e.status!=="ok"&&e.status!=="error"?{success:!1,error:{message:'status must be "ok" or "error"'}}:e.message!==void 0&&typeof e.message!="string"?{success:!1,error:{message:"message must be a string"}}:{success:!0,data:e.message!==void 0?{status:e.status,message:e.message}:{status:e.status}}}},D={safeParse(e){if(!A(e))return{success:!1,error:{message:"expected an object"}};let t=j(e,["status"]);return t?{success:!1,error:{message:`unexpected key "${t}"`}}:e.status!=="running"?{success:!1,error:{message:'status must be "running"'}}:{success:!0,data:{status:"running"}}}};var ie="http://127.0.0.1:38421",ae=5e3;function le(e){return typeof e=="object"&&e!==null&&"message"in e&&typeof e.message=="string"}var T=class{constructor(t={}){i(this,"baseUrl");i(this,"timeoutMs");i(this,"fetchImpl");this.baseUrl=t.baseUrl??ie,this.timeoutMs=t.timeoutMs??ae,this.fetchImpl=t.fetchImpl??fetch,t.allowNonLoopback?console.warn(`[YouTube to MPV] MpvHandlerClient constructed with allowNonLoopback=true for baseUrl "${this.baseUrl}" \u2014 the loopback SSRF guard is disabled for this instance.`):k(this.baseUrl)}async play(t,n={}){let r=n.timestampSeconds??null;if(r!==null&&!(Number.isFinite(r)&&r>=0))throw new RangeError(`timestampSeconds must be a finite number >= 0, got ${String(r)}`);return this.request("/play",{url:t,t:r!==null?String(r):void 0},B)}async health(){return this.request("/health",{},D)}buildRequestUrl(t,n){let r=Object.entries(n).filter(s=>s[1]!==void 0).map(([s,c])=>`${s}=${encodeURIComponent(c)}`),o=r.length>0?`?${r.join("&")}`:"";return`${this.baseUrl}${t}${o}`}async request(t,n,r){let o=this.buildRequestUrl(t,n),s;try{s=await this.fetchImpl(o,{signal:AbortSignal.timeout(this.timeoutMs)})}catch(l){throw l instanceof Error&&l.name==="TimeoutError"?new C(`mpv-handler did not respond within ${this.timeoutMs}ms (${this.baseUrl}${t})`,{cause:l}):new w(`mpv-handler unreachable at ${this.baseUrl}`,{cause:l})}let c=await s.text(),a;try{a=c.length>0?JSON.parse(c):void 0}catch(l){throw new x("mpv-handler returned a non-JSON response",{cause:l})}if(!s.ok){let l=le(a)?a.message:`HTTP ${s.status}`;throw new M(`mpv-handler rejected the request: ${l}`,s.status,a)}let v=r.safeParse(a);if(!v.success)throw new x(`mpv-handler response failed validation: ${v.error.message}`);return v.data}};var h=class extends Error{};var P=class{constructor(t){i(this,"client");this.client=t}async open(t,n={}){let r=this.resolveUrl(t);if(!r)throw new h(`${this.platform}: not a valid URL or ID: ${t}`);let o=n.timestampSeconds??null;return await this.client.play(r,{timestampSeconds:o}),{resolvedUrl:r,timestampSeconds:o}}};var ue=/^[a-zA-Z0-9_-]{11}$/,ce=new Set(["www.youtube.com","youtube.com","m.youtube.com"]),de="youtu.be",me=/^\/shorts\/([^/]+)$/;function u(e){return ue.test(e)}function pe(e){if(e.protocol!=="https:"||e.username||e.password)return null;if(ce.has(e.hostname)){if(e.pathname==="/watch"){let n=e.searchParams.get("v");return n&&u(n)?n:null}let t=me.exec(e.pathname);if(t){let n=t[1];if(n&&u(n))return n}return null}if(e.hostname===de){let t=e.pathname.slice(1);if(u(t))return t}return null}function L(e){let t=e.trim();if(u(t))return t;try{return pe(new URL(t))}catch{return null}}function R(e){return u(e)?`https://www.youtube.com/watch?v=${e}`:null}var fe=/^\d+$/,he=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;function E(e){if(!e)return null;if(fe.test(e))return parseInt(e,10);let t=he.exec(e);if(!t||!(t[1]||t[2]||t[3]))return null;let n=parseInt(t[1]??"0",10),r=parseInt(t[2]??"0",10),o=parseInt(t[3]??"0",10);return n*3600+r*60+o}var I=class extends P{constructor(){super(...arguments);i(this,"platform","youtube")}supports(n){return L(n)!==null}resolveUrl(n){let r=L(n);return r?R(r):null}parseTimestamp(n){return E(n)}};function Y(e,t,n={}){let r=n.mpvPath??"mpv",o=n.platform==="windows",s=t!==null?` --start=${t}`:"";return o?`"${r}" "${e}"${s}`:`'${r}' '${e}'${s}`}async function q(e){try{return await navigator.clipboard.writeText(e),{copied:!0}}catch{return{copied:!1}}}var ge={mpvPath:"mpv",showButton:!0,autoPlaylist:!1,enableNativeMenuItems:!0};function d(e){return GM_getValue(e,ge[e])}function S(e,t){GM_setValue(e,t)}var F="mpv-toast";function g(e,t,n){document.getElementById(F)?.remove();let r=window.matchMedia("(prefers-color-scheme: dark)").matches,o=t==="error",s=o?"#e74c3c":r?"#333":"#fff",c=o||r?"#fff":"#333",a=o?"transparent":r?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.1)",v=o?"rgba(255,255,255,0.2)":r?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.05)",l=o?"rgba(255,255,255,0.3)":r?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.1)",re=o||r?"#fff":"#333",m=document.createElement("div");m.id=F,m.style.cssText=`
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
  `;let H=document.createElement("span");if(H.textContent=e,m.appendChild(H),n!==void 0){let f=document.createElement("button");f.textContent="Copy",f.style.cssText=`
      background: ${v};
      border: 1px solid ${l};
      color: ${re};
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `,f.onclick=()=>{navigator.clipboard.writeText(n).then(()=>{f.textContent="Copied!",setTimeout(()=>{f.textContent="Copy"},1e3)}).catch(()=>{})},m.appendChild(f)}document.body.appendChild(m),setTimeout(()=>{m.style.animation="mpv-fade-out 0.3s ease",setTimeout(()=>m.remove(),300)},5e3)}function be(){let e=/[?&]v=([^&]+)/.exec(window.location.search);if(e?.[1]&&u(e[1]))return e[1];let t=window.ytInitialPlayerResponse?.videoDetails?.videoId;if(t&&u(t))return t;let n=document.querySelector('meta[itemprop="videoId"]')?.getAttribute("content");return n&&u(n)?n:null}function b(e=be()){return e?R(e):null}function ye(e){if(!e)return null;try{let t=new URL(e,window.location.origin).searchParams.get("v");return t&&u(t)?t:null}catch{return null}}function ve(e){if(!e)return null;try{return E(new URL(e,window.location.origin).searchParams.get("t"))}catch{return null}}function y(e,t,n){if(!t){console.error("[YouTube to MPV] Could not extract video URL"),g("Failed to extract video URL","error");return}e.openInMpv(t,n)}function X(){let e=document.querySelector("video"),t=e?Math.floor(e.currentTime):0;return t>0?t:null}var J=`
  <path d="M8 5v14l11-7z"/>
  <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3z" fill-opacity="0.7"/>
`,we=`<svg height="24" width="24" viewBox="0 0 24 24" fill="white">${J}</svg>`,Z=`<svg height="24" width="24" viewBox="0 0 24 24" fill="currentColor">${J}</svg>`,O="mpv-open-btn";function U(e){if(!d("showButton")||document.getElementById(O))return;let t=document.querySelector(".ytp-right-controls");if(!t)return;let n=document.createElement("button");n.id=O,n.className="ytp-button",n.title="Open in MPV (Ctrl+Shift+M)",n.innerHTML=we,n.style.cssText=`
    padding: 0 8px;
    min-width: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  `,n.addEventListener("click",r=>{r.stopPropagation(),y(e,b(),null)}),t.prepend(n)}function Q(){document.getElementById(O)?.remove()}var xe="ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model",$=null;function Ce(e){return e.querySelector('a#thumbnail, a[href*="/watch"]')?.getAttribute("href")??null}function V(){document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0,cancelable:!0}))}function K(e,t){let n=document.createElement("div");n.className="ytp-menuitem",n.setAttribute("role","menuitem"),n.tabIndex=0,n.innerHTML=`
    <div class="ytp-menuitem-icon">${Z}</div>
    <div class="ytp-menuitem-label"></div>
    <div class="ytp-menuitem-content"></div>
  `;let r=n.querySelector(".ytp-menuitem-label");return r&&(r.textContent=e),n.addEventListener("click",o=>{o.stopPropagation(),t()}),n}function Me(e){let t=e.closest(".ytp-panel"),n=e.closest(".ytp-contextmenu"),r=`${e.scrollHeight}px`;e.style.height=r,t&&(t.style.height=r),n&&(n.style.height=r)}function Te(e){if(!d("enableNativeMenuItems"))return;let t=document.querySelector(".ytp-contextmenu .ytp-panel-menu");!t||t.dataset.mpvInjected||/copy video url/i.test(t.textContent??"")&&(t.dataset.mpvInjected="true",t.appendChild(K("Open in MPV",()=>{y(e,b(),null),V()})),t.appendChild(K("Open in MPV at current time",()=>{y(e,b(),X()),V()})),Me(t))}function Pe(e,t){let n=document.createElement("div");n.className="mpv-row-menuitem",n.setAttribute("role","menuitem"),n.tabIndex=0,n.innerHTML=Z;let r=document.createElement("span");return r.textContent=e,n.appendChild(r),n.addEventListener("click",o=>{o.stopPropagation(),t()}),n}function Re(e){if(!d("enableNativeMenuItems")||!$)return;let t=document.querySelector("ytd-popup-container");if(!t)return;let n=t.querySelector("tp-yt-paper-listbox#items, yt-list-view-model");!n||n.dataset.mpvInjected||/add to queue|save to playlist/i.test(n.textContent??"")&&(n.dataset.mpvInjected="true",n.appendChild(Pe("Open in MPV",()=>{let r=$;r&&(y(e,b(r.videoId),r.timestamp),V())})))}var G="";function z(e){let t=window.location.href;t!==G&&(G=t,Q(),window.location.pathname.startsWith("/watch")&&setTimeout(()=>U(e),500))}var W="mpv-open-styles";function Ee(){if(document.getElementById(W))return;let e=document.createElement("style");e.id=W,e.textContent=`
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
  `,document.head.appendChild(e)}function ee(e){Ee(),document.addEventListener("click",n=>{let r=n.target;if(!(r instanceof Element))return;let o=r.closest('button[aria-label="Action menu" i], button[aria-label="More actions" i]');if(!o)return;let s=o.closest(xe),c=s?Ce(s):null,a=ye(c);$=a?{videoId:a,timestamp:ve(c)}:null},!0),new MutationObserver(()=>{z(e),Te(e),Re(e)}).observe(document.body,{childList:!0,subtree:!0}),window.addEventListener("popstate",()=>z(e)),document.addEventListener("keydown",n=>{n.ctrlKey&&n.shiftKey&&n.key==="M"&&(n.preventDefault(),y(e,b(),X()))}),GM_registerMenuCommand("Open current video in MPV",()=>{y(e,b(),null)}),GM_registerMenuCommand("Toggle button visibility",()=>{let n=d("showButton");S("showButton",!n),n?Q():U(e)}),GM_registerMenuCommand("Toggle MPV menu items",()=>{S("enableNativeMenuItems",!d("enableNativeMenuItems"))}),window.location.pathname.startsWith("/watch")&&(document.readyState==="complete"?U(e):window.addEventListener("load",()=>U(e)))}var te=(e,t)=>new Promise((n,r)=>{let o=GM_xmlhttpRequest({method:"GET",url:e,onload:s=>{if(!N(s.finalUrl)){r(new Error(`response arrived via a non-loopback URL: ${s.finalUrl}`));return}n({ok:s.status>=200&&s.status<300,status:s.status,text:()=>Promise.resolve(s.responseText)})},onerror:()=>{r(new Error(`GM_xmlhttpRequest network error requesting ${e}`))}});t?.signal?.addEventListener("abort",()=>{o.abort(),r(t.signal?.reason)})});function ne(e){let t=e.toLowerCase();return t.includes("linux")?"linux":t.includes("mac")?"mac":t.includes("win")?"windows":"unknown"}var Ie=new T({fetchImpl:te}),Ue=new I(Ie);async function ke(e,t){try{await Ue.open(e,{timestampSeconds:t}),g("Opening in MPV...","success",e)}catch(n){if(n instanceof h){console.error("[YouTube to MPV] video source rejected the resolved URL as invalid"),g("Failed to extract video URL","error");return}if(n instanceof p){console.error("[YouTube to MPV] handler unreachable:",n.message);let r=Y(e,t,{mpvPath:d("mpvPath"),platform:ne(navigator.platform)}),{copied:o}=await q(r);g(o?`Handler offline. Copied: ${r}`:`Run: ${r}`,"warning",r);return}throw n}}ee({openInMpv:ke});})();
