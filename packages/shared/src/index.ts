// packages/shared/src/index.ts
import "server-only";

// Правильные экспорты без .js расширения
export * from "./ai";
export * from "./logger";
export * from "./domain";

// Переэкспорт типов
export type * from "@breason/types";
