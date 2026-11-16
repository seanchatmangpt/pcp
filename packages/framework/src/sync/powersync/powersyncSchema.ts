/**
 * @fileoverview PowerSync Schema definitions matching the PATQ specifications.
 * Enforces Profiles, Admission Receipts, and Job Quarantine tables.
 */

export class Column {
  constructor(
    public name: string,
    public type: 'text' | 'integer' | 'real' | 'blob'
  ) {}
}

export const column = {
  text: (name: string) => new Column(name, 'text'),
  integer: (name: string) => new Column(name, 'integer'),
  real: (name: string) => new Column(name, 'real'),
  blob: (name: string) => new Column(name, 'blob'),
};

export class Table {
  public name: string;
  public columns: Column[];

  constructor(options: { name: string; columns: Column[] }) {
    this.name = options.name;
    this.columns = options.columns;
  }
}

export class Schema {
  public tables: Table[];

  constructor(tables: Table[]) {
    this.tables = tables;
  }
}

// 1. profiles table (id, username, full_name, website, avatar_url, updated_at)
export const profilesTable = new Table({
  name: 'profiles',
  columns: [
    column.text('id'),
    column.text('username'),
    column.text('full_name'),
    column.text('website'),
    column.text('avatar_url'),
    column.text('updated_at'),
  ],
});

// 2. sync_admission_receipts table (id, job_id, job_type, entity_id, payload_hash, previous_receipt_hash, receipt_hash, admitted_at, status, error, created_at)
export const syncAdmissionReceiptsTable = new Table({
  name: 'sync_admission_receipts',
  columns: [
    column.text('id'),
    column.integer('job_id'),
    column.text('job_type'),
    column.text('entity_id'),
    column.text('payload_hash'),
    column.text('previous_receipt_hash'),
    column.text('receipt_hash'),
    column.text('admitted_at'),
    column.text('status'),
    column.text('error'),
    column.integer('created_at'),
  ],
});

// 3. sync_job_quarantine table (id, job_type, payload, entity_id, rejection_reason, verdict, created_at)
export const syncJobQuarantineTable = new Table({
  name: 'sync_job_quarantine',
  columns: [
    column.integer('id'),
    column.text('job_type'),
    column.text('payload'),
    column.text('entity_id'),
    column.text('rejection_reason'),
    column.text('verdict'),
    column.integer('created_at'),
  ],
});

export const powersyncSchema = new Schema([
  profilesTable,
  syncAdmissionReceiptsTable,
  syncJobQuarantineTable,
]);
