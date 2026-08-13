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


"use strict";(()=>{var ie=Object.defineProperty;var ae=(e,t,n)=>t in e?ie(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var a=(e,t,n)=>ae(e,typeof t!="symbol"?t+"":t,n);var d=class extends Error{constructor(t,n){super(t,n),this.name=new.target.name}},b=class extends d{},x=class extends b{},v=class extends d{constructor(n,r,o){super(n);a(this,"statusCode");a(this,"body");this.statusCode=r,this.body=o}},y=class extends d{};var ue=/[\t\n]/,le=["domain","name","value","path","secure","httpOnly","expirationDate"];function ce(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}function E(e,t,n){if(e===void 0){if(n)throw new RangeError(`cookie ${t} is required`);return}if(typeof e!="string")throw new RangeError(`cookie ${t} must be a string`);if(e.length>4096)throw new RangeError(`cookie ${t} exceeds 4096 characters`);if(ue.test(e))throw new RangeError(`cookie ${t} contains a forbidden control character`);if(n&&e.length===0)throw new RangeError(`cookie ${t} must not be empty`);return e}function de(e){if(!ce(e))throw new RangeError("cookie entry must be an object");let t=Object.keys(e).find(i=>!le.includes(i));if(t)throw new RangeError(`unexpected cookie field "${t}"`);let n=E(e.domain,"domain",!0),r=E(e.name,"name",!0),o=E(e.value,"value",!1)??"",s=E(e.path,"path",!1);if(e.secure!==void 0&&typeof e.secure!="boolean")throw new RangeError("cookie secure must be a boolean");if(e.httpOnly!==void 0&&typeof e.httpOnly!="boolean")throw new RangeError("cookie httpOnly must be a boolean");if(e.expirationDate!==void 0&&e.expirationDate!==null&&!(typeof e.expirationDate=="number"&&Number.isFinite(e.expirationDate)))throw new RangeError("cookie expirationDate must be a finite number or null");return{domain:n,name:r,value:o,...s!==void 0?{path:s}:{},...e.secure!==void 0?{secure:e.secure}:{},...e.httpOnly!==void 0?{httpOnly:e.httpOnly}:{},...e.expirationDate!==void 0?{expirationDate:e.expirationDate}:{}}}function H(e){if(e==null)return null;if(!Array.isArray(e))throw new RangeError("cookies must be an array");if(e.length===0)return null;if(e.length>200)throw new RangeError("cookies exceeds the maximum of 200 entries");return e.map(de)}var V=new Set(["127.0.0.1","localhost","[::1]"]);function P(e){let t=new URL(e);if(t.protocol!=="http:")throw new RangeError(`mpv-handler base URL must use http:, got "${t.protocol}"`);if(t.username||t.password)throw new RangeError("mpv-handler base URL must not contain credentials");if(!V.has(t.hostname)){let n=[...V].join(", ");throw new RangeError(`mpv-handler base URL host must be loopback (one of ${n}), got "${t.hostname}"`)}}function D(e){try{return P(e),!0}catch{return!1}}function A(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}function N(e,t){return Object.keys(e).find(n=>!t.includes(n))}var j={safeParse(e){if(!A(e))return{success:!1,error:{message:"expected an object"}};let t=N(e,["status","message"]);return t?{success:!1,error:{message:`unexpected key "${t}"`}}:e.status!=="ok"&&e.status!=="error"?{success:!1,error:{message:'status must be "ok" or "error"'}}:e.message!==void 0&&typeof e.message!="string"?{success:!1,error:{message:"message must be a string"}}:{success:!0,data:e.message!==void 0?{status:e.status,message:e.message}:{status:e.status}}}},F={safeParse(e){if(!A(e))return{success:!1,error:{message:"expected an object"}};let t=N(e,["status"]);return t?{success:!1,error:{message:`unexpected key "${t}"`}}:e.status!=="running"?{success:!1,error:{message:'status must be "running"'}}:{success:!0,data:{status:"running"}}}};var pe="http://127.0.0.1:38421",me=5e3;function fe(e){return typeof e=="object"&&e!==null&&"message"in e&&typeof e.message=="string"}var C=class{constructor(t={}){a(this,"baseUrl");a(this,"timeoutMs");a(this,"fetchImpl");this.baseUrl=t.baseUrl??pe,this.timeoutMs=t.timeoutMs??me,this.fetchImpl=t.fetchImpl??fetch,t.allowNonLoopback?console.warn(`[YouTube to MPV] MpvHandlerClient constructed with allowNonLoopback=true for baseUrl "${this.baseUrl}" \u2014 the loopback SSRF guard is disabled for this instance.`):P(this.baseUrl)}async play(t,n={}){let r=n.timestampSeconds??null;if(r!==null&&!(Number.isFinite(r)&&r>=0))throw new RangeError(`timestampSeconds must be a finite number >= 0, got ${String(r)}`);let o=H(n.cookies);return this.requestJson("/play",{url:t,t:r!==null?String(r):void 0,cookies:o??void 0},j)}async health(){return this.request("/health",{},F)}buildRequestUrl(t,n){let r=Object.entries(n).filter(s=>s[1]!==void 0).map(([s,i])=>`${s}=${encodeURIComponent(i)}`),o=r.length>0?`?${r.join("&")}`:"";return`${this.baseUrl}${t}${o}`}async request(t,n,r){let o=await this.fetch(this.buildRequestUrl(t,n),t,{signal:AbortSignal.timeout(this.timeoutMs)});return this.parseResponse(o,r)}async requestJson(t,n,r){let o=await this.fetch(`${this.baseUrl}${t}`,t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(n),signal:AbortSignal.timeout(this.timeoutMs)});return this.parseResponse(o,r)}async fetch(t,n,r){try{return await this.fetchImpl(t,r)}catch(o){throw o instanceof Error&&o.name==="TimeoutError"?new x(`mpv-handler did not respond within ${this.timeoutMs}ms (${this.baseUrl}${n})`,{cause:o}):new b(`mpv-handler unreachable at ${this.baseUrl}`,{cause:o})}}async parseResponse(t,n){let r=await t.text(),o;try{o=r.length>0?JSON.parse(r):void 0}catch(i){throw new y("mpv-handler returned a non-JSON response",{cause:i})}if(!t.ok){let i=fe(o)?o.message:`HTTP ${t.status}`;throw new v(`mpv-handler rejected the request: ${i}`,t.status,o)}let s=n.safeParse(o);if(!s.success)throw new y(`mpv-handler response failed validation: ${s.error.message}`);return s.data}};var m=class extends Error{};var R=class{constructor(t){a(this,"client");this.client=t}async open(t,n={}){let r=this.resolveUrl(t);if(!r)throw new m(`${this.platform}: not a valid URL or ID: ${t}`);let o=n.timestampSeconds??null,s=n.cookies??null;return await this.client.play(r,{timestampSeconds:o,cookies:s}),{resolvedUrl:r,timestampSeconds:o}}};var he=/^[a-zA-Z0-9_-]{11}$/,ge=new Set(["www.youtube.com","youtube.com","m.youtube.com"]),be="youtu.be",ye=/^\/shorts\/([^/]+)$/;function u(e){return he.test(e)}function we(e){if(e.protocol!=="https:"||e.username||e.password)return null;if(ge.has(e.hostname)){if(e.pathname==="/watch"){let n=e.searchParams.get("v");return n&&u(n)?n:null}let t=ye.exec(e.pathname);if(t){let n=t[1];if(n&&u(n))return n}return null}if(e.hostname===be){let t=e.pathname.slice(1);if(u(t))return t}return null}function O(e){let t=e.trim();if(u(t))return t;try{return we(new URL(t))}catch{return null}}function M(e){return u(e)?`https://www.youtube.com/watch?v=${e}`:null}var xe=/^\d+$/,ve=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;function T(e){if(!e)return null;if(xe.test(e))return parseInt(e,10);let t=ve.exec(e);if(!t||!(t[1]||t[2]||t[3]))return null;let n=parseInt(t[1]??"0",10),r=parseInt(t[2]??"0",10),o=parseInt(t[3]??"0",10);return n*3600+r*60+o}var k=class extends R{constructor(){super(...arguments);a(this,"platform","youtube")}supports(n){return O(n)!==null}resolveUrl(n){let r=O(n);return r?M(r):null}parseTimestamp(n){return T(n)}};function Y(e,t,n={}){let r=n.mpvPath??"mpv",o=n.platform==="windows",s=t!==null?` --start=${t}`:"";return o?`"${r}" "${e}"${s}`:`'${r}' '${e}'${s}`}async function B(e){try{return await navigator.clipboard.writeText(e),{copied:!0}}catch{return{copied:!1}}}var Ee={mpvPath:"mpv",showButton:!0,autoPlaylist:!1,enableNativeMenuItems:!0};function l(e){return GM_getValue(e,Ee[e])}function U(e,t){GM_setValue(e,t)}var q="mpv-toast";function f(e,t,n){document.getElementById(q)?.remove();let r=window.matchMedia("(prefers-color-scheme: dark)").matches,o=t==="error",s=o?"#e74c3c":r?"#333":"#fff",i=o||r?"#fff":"#333",w=o?"transparent":r?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.1)",re=o?"rgba(255,255,255,0.2)":r?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.05)",oe=o?"rgba(255,255,255,0.3)":r?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.1)",se=o||r?"#fff":"#333",c=document.createElement("div");c.id=q,c.style.cssText=`
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${s};
    color: ${i};
    border: 1px solid ${w};
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 99999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: mpv-fade-in 0.3s ease;
    display: flex;
    align-items: center;
    gap: 12px;
  `;let _=document.createElement("span");if(_.textContent=e,c.appendChild(_),n!==void 0){let p=document.createElement("button");p.textContent="Copy",p.style.cssText=`
      background: ${re};
      border: 1px solid ${oe};
      color: ${se};
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `,p.onclick=()=>{navigator.clipboard.writeText(n).then(()=>{p.textContent="Copied!",setTimeout(()=>{p.textContent="Copy"},1e3)}).catch(()=>{})},c.appendChild(p)}document.body.appendChild(c),setTimeout(()=>{c.style.animation="mpv-fade-out 0.3s ease",setTimeout(()=>c.remove(),300)},5e3)}function Ce(){let e=/[?&]v=([^&]+)/.exec(window.location.search);if(e?.[1]&&u(e[1]))return e[1];let t=window.ytInitialPlayerResponse?.videoDetails?.videoId;if(t&&u(t))return t;let n=document.querySelector('meta[itemprop="videoId"]')?.getAttribute("content");return n&&u(n)?n:null}function h(e=Ce()){return e?M(e):null}function Re(e){if(!e)return null;try{let t=new URL(e,window.location.origin).searchParams.get("v");return t&&u(t)?t:null}catch{return null}}function Me(e){if(!e)return null;try{return T(new URL(e,window.location.origin).searchParams.get("t"))}catch{return null}}function g(e,t,n){if(!t){console.error("[YouTube to MPV] Could not extract video URL"),f("Failed to extract video URL","error");return}e.openInMpv(t,n)}function X(){let e=document.querySelector("video"),t=e?Math.floor(e.currentTime):0;return t>0?t:null}var J=`
  <path d="M8 5v14l11-7z"/>
  <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3z" fill-opacity="0.7"/>
`,Te=`<svg height="24" width="24" viewBox="0 0 24 24" fill="white">${J}</svg>`,Z=`<svg height="24" width="24" viewBox="0 0 24 24" fill="currentColor">${J}</svg>`,L="mpv-open-btn";function I(e){if(!l("showButton")||document.getElementById(L))return;let t=document.querySelector(".ytp-right-controls");if(!t)return;let n=document.createElement("button");n.id=L,n.className="ytp-button",n.title="Open in MPV (Ctrl+Shift+M)",n.innerHTML=Te,n.style.cssText=`
    padding: 0 8px;
    min-width: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  `,n.addEventListener("click",r=>{r.stopPropagation(),g(e,h(),null)}),t.prepend(n)}function Q(){document.getElementById(L)?.remove()}var ke="ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model",S=null;function Ie(e){return e.querySelector('a#thumbnail, a[href*="/watch"]')?.getAttribute("href")??null}function $(){document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0,cancelable:!0}))}function K(e,t){let n=document.createElement("div");n.className="ytp-menuitem",n.setAttribute("role","menuitem"),n.tabIndex=0,n.innerHTML=`
    <div class="ytp-menuitem-icon">${Z}</div>
    <div class="ytp-menuitem-label"></div>
    <div class="ytp-menuitem-content"></div>
  `;let r=n.querySelector(".ytp-menuitem-label");return r&&(r.textContent=e),n.addEventListener("click",o=>{o.stopPropagation(),t()}),n}function Pe(e){let t=e.closest(".ytp-panel"),n=e.closest(".ytp-contextmenu"),r=`${e.scrollHeight}px`;e.style.height=r,t&&(t.style.height=r),n&&(n.style.height=r)}function Oe(e){if(!l("enableNativeMenuItems"))return;let t=document.querySelector(".ytp-contextmenu .ytp-panel-menu");!t||t.dataset.mpvInjected||/copy video url/i.test(t.textContent??"")&&(t.dataset.mpvInjected="true",t.appendChild(K("Open in MPV",()=>{g(e,h(),null),$()})),t.appendChild(K("Open in MPV at current time",()=>{g(e,h(),X()),$()})),Pe(t))}function Ue(e,t){let n=document.createElement("div");n.className="mpv-row-menuitem",n.setAttribute("role","menuitem"),n.tabIndex=0,n.innerHTML=Z;let r=document.createElement("span");return r.textContent=e,n.appendChild(r),n.addEventListener("click",o=>{o.stopPropagation(),t()}),n}function Le(e){if(!l("enableNativeMenuItems")||!S)return;let t=document.querySelector("ytd-popup-container");if(!t)return;let n=t.querySelector("tp-yt-paper-listbox#items, yt-list-view-model");!n||n.dataset.mpvInjected||/add to queue|save to playlist/i.test(n.textContent??"")&&(n.dataset.mpvInjected="true",n.appendChild(Ue("Open in MPV",()=>{let r=S;r&&(g(e,h(r.videoId),r.timestamp),$())})))}var G="";function z(e){let t=window.location.href;t!==G&&(G=t,Q(),window.location.pathname.startsWith("/watch")&&setTimeout(()=>I(e),500))}var W="mpv-open-styles";function Se(){if(document.getElementById(W))return;let e=document.createElement("style");e.id=W,e.textContent=`
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
  `,document.head.appendChild(e)}function ee(e){Se(),document.addEventListener("click",n=>{let r=n.target;if(!(r instanceof Element))return;let o=r.closest('button[aria-label="Action menu" i], button[aria-label="More actions" i]');if(!o)return;let s=o.closest(ke),i=s?Ie(s):null,w=Re(i);S=w?{videoId:w,timestamp:Me(i)}:null},!0),new MutationObserver(()=>{z(e),Oe(e),Le(e)}).observe(document.body,{childList:!0,subtree:!0}),window.addEventListener("popstate",()=>z(e)),document.addEventListener("keydown",n=>{n.ctrlKey&&n.shiftKey&&n.key==="M"&&(n.preventDefault(),g(e,h(),X()))}),GM_registerMenuCommand("Open current video in MPV",()=>{g(e,h(),null)}),GM_registerMenuCommand("Toggle button visibility",()=>{let n=l("showButton");U("showButton",!n),n?Q():I(e)}),GM_registerMenuCommand("Toggle MPV menu items",()=>{U("enableNativeMenuItems",!l("enableNativeMenuItems"))}),window.location.pathname.startsWith("/watch")&&(document.readyState==="complete"?I(e):window.addEventListener("load",()=>I(e)))}var te=(e,t)=>new Promise((n,r)=>{let o=GM_xmlhttpRequest({method:t?.method??"GET",url:e,...t?.headers?{headers:t.headers}:{},...t?.body!==void 0?{data:t.body}:{},onload:s=>{if(!D(s.finalUrl)){r(new Error(`response arrived via a non-loopback URL: ${s.finalUrl}`));return}n({ok:s.status>=200&&s.status<300,status:s.status,text:()=>Promise.resolve(s.responseText)})},onerror:()=>{r(new Error(`GM_xmlhttpRequest network error requesting ${e}`))}});t?.signal?.addEventListener("abort",()=>{o.abort(),r(t.signal?.reason)})});function ne(e){let t=e.toLowerCase();return t.includes("linux")?"linux":t.includes("mac")?"mac":t.includes("win")?"windows":"unknown"}var $e=new C({fetchImpl:te}),_e=new k($e);async function He(e,t){try{await _e.open(e,{timestampSeconds:t}),f("Opening in MPV...","success",e)}catch(n){if(n instanceof m){console.error("[YouTube to MPV] video source rejected the resolved URL as invalid"),f("Failed to extract video URL","error");return}if(n instanceof d){console.error("[YouTube to MPV] handler unreachable:",n.message);let r=Y(e,t,{mpvPath:l("mpvPath"),platform:ne(navigator.platform)}),{copied:o}=await B(r);f(o?`Handler offline. Copied: ${r}`:`Run: ${r}`,"warning",r);return}throw n}}ee({openInMpv:He});})();
