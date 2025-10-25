/// <reference types="vite/client" />

// CSS module declarations
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.scss" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.sass" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.less" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.styl" {
  const content: Record<string, string>;
  export default content;
}