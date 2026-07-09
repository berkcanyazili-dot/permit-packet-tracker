export type BatchStatus = 'Draft' | 'Ready to Print' | 'Printed' | 'Sent to DMV' | 'Completed' | 'Historical';

export type PacketStatus = 'Not Started' | 'Ready' | 'Printed' | 'Sent to DMV' | 'Completed' | 'Issue' | 'Imported';

export interface PermitBatch {
  id: string;
  batchDate: string;
  sheetName: string;
  sourceFileName: string;
  sourceSheetName: string;
  importedAt: string | null;
  importRunId: string;
  checkNumber: string;
  batchNumber: number;
  status: BatchStatus;
  notes: string;
  printedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PermitPacket {
  id: string;
  batchId: string;
  sourceFileName: string;
  sourceSheetName: string;
  importedAt: string | null;
  importRunId: string;
  stockNumber: string;
  customerName: string;
  dateSold: string;
  registrationCost: number | null;
  collectedAmount: number | null;
  owedAmount: number | null;
  notes: string;
  status: PacketStatus;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PermitStore {
  batches: PermitBatch[];
  packets: PermitPacket[];
  syncMode: 'local-fallback' | 'supabase';
}

export interface BatchWithPackets extends PermitBatch {
  packets: PermitPacket[];
}
