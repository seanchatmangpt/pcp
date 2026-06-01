export interface QuarantineRecord {
  commandId: string;
  payload: any;
  error: string;
  quarantinedAt: string;
}

export class Quarantine {
  private static records: QuarantineRecord[] = [];

  static clear() {
    this.records = [];
  }

  static getRecords(): QuarantineRecord[] {
    return this.records;
  }

  /**
   * Isolates a failing payload with error details
   */
  static async isolate(commandId: string, payload: any, errorMsg: string): Promise<QuarantineRecord> {
    const record: QuarantineRecord = {
      commandId,
      payload,
      error: errorMsg,
      quarantinedAt: new Date().toISOString()
    };
    this.records.push(record);
    return record;
  }
}
