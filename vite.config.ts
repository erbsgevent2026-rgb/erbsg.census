import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  const isPreviewEnv = process.env.DISABLE_HMR === 'true' || !!process.env.APPLET_ID || !!process.env.GOOGLE_RUNTIME;
  const isHmrDisabled = process.env.DISABLE_HMR === 'true' || (isPreviewEnv && process.env.DISABLE_HMR !== 'false');

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(isHmrDisabled
        ? [
            {
              name: 'disable-hmr-in-preview',
              transformIndexHtml(html: string) {
                return [
                  {
                    tag: 'script',
                    attrs: { id: 'disable-hmr-preview-guard' },
                    children: `(function(){window.__DISABLE_HMR__=true;var O=window.WebSocket;window.WebSocket=function(u,p){var v=(typeof p==="string"&&(p==="vite-hmr"||p==="vite-ping"))||(Array.isArray(p)&&(p.includes("vite-hmr")||p.includes("vite-ping")))||(typeof u==="string"&&u.indexOf("token=")!==-1&&(u.indexOf("24678")!==-1||u.indexOf("3000")!==-1));if(v){var n=function(){};var d={url:u,readyState:1,send:n,close:n,addEventListener:function(t,l){if(t==="open"){setTimeout(function(){try{l({type:"open"})}catch(e){}},0)}},removeEventListener:n,dispatchEvent:function(){return false},onopen:null,onmessage:null,onerror:null,onclose:null};setTimeout(function(){if(d.onopen){try{d.onopen({type:"open"})}catch(e){}}},0);return d}return new O(u,p)};window.WebSocket.prototype=O.prototype;window.WebSocket.CONNECTING=O.CONNECTING;window.WebSocket.OPEN=O.OPEN;window.WebSocket.CLOSING=O.CLOSING;window.WebSocket.CLOSED=O.CLOSED;window.addEventListener("unhandledrejection",function(e){var m=e.reason&&(e.reason.message||String(e.reason));if(m&&typeof m==="string"&&(m.indexOf("WebSocket")!==-1||m.indexOf("vite")!==-1)){e.preventDefault();e.stopImmediatePropagation()}});window.addEventListener("error",function(e){var m=e.message||"";if(m&&typeof m==="string"&&(m.indexOf("WebSocket")!==-1||m.indexOf("vite")!==-1)){e.preventDefault();e.stopImmediatePropagation()}})})()`,
                    injectTo: 'head-prepend' as const,
                  },
                ];
              },
            },
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // Explicitly configure HMR: disable if DISABLE_HMR is set to true;
      // otherwise, configure matching server and client port to maintain stable connection
      hmr: isHmrDisabled
        ? false
        : {
            port: 3000,
            clientPort: 3000,
          },
      ws: (isHmrDisabled ? false : undefined) as false | undefined,
      watch: isHmrDisabled ? null : {},
    },
  };
});
