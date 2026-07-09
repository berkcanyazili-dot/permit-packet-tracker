declare module 'xlsx/xlsx.mjs' {
  export type WorkBook = { SheetNames: string[]; Sheets: Record<string, unknown> };
  export type WorkSheet = Record<string, unknown>;
  export type RowObject = Record<string, string | number | boolean | null | undefined>;
  export const read: (data: unknown, options?: Record<string, unknown>) => WorkBook;
  export const utils: {
    sheet_to_json: (sheet: WorkSheet, options?: { header?: 1; defval?: unknown; raw?: boolean }) => unknown[][];
    sheet_to_json: (sheet: WorkSheet, options?: Record<string, unknown>) => RowObject[];
    encode_cell: (cell: { r: number; c: number }) => string;
    decode_range: (range: string) => { s: { r: number; c: number }; e: { r: number; c: number } };
  };
  export const SSF: {
    parse_date_code: (value: number) => { y?: number; m?: number; d?: number } | null;
  };
}
