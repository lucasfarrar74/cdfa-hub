/// <reference types="vite/client" />

declare const __BUILD_TIMESTAMP__: string;

declare module '*.otf' {
  const src: string;
  export default src;
}
declare module '*.ttf' {
  const src: string;
  export default src;
}
declare module '*.TTF' {
  const src: string;
  export default src;
}
