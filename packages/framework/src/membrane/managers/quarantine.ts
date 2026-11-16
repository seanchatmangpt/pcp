import { QuarantineRecord } from '../types';

export class QuarantineManager {
  private records: QuarantineRecord[] = [];

  public clear() {
    this.records = [];
  }

  public getRecords(): QuarantineRecord[] {
    return [...this.records];
  }

  public async isolate(
    commandId: string,
    payload: any,
    errorMsg: string
  ): Promise<QuarantineRecord> {
    const record: QuarantineRecord = {
      commandId,
      payload,
      error: errorMsg,
      quarantinedAt: new Date().toISOString(),
    };
    this.records.push(record);
    return record;
  }
}
