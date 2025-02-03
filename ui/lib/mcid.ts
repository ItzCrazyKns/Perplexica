// utils/mcid.ts
export class Mcid {
  private lastTimestamp = -1;
  private sequence = 0;

  constructor(private readonly machineId: number = 0) {
    if (machineId < 0 || machineId > 255) {
      throw new Error('Machine ID must be between 0 and 255');
    }
  }

  generate(): number {
    let now = Date.now();

    if (now < this.lastTimestamp) {
      throw new Error('Clock moved backwards');
    }

    if (now === this.lastTimestamp) {
      this.sequence = (this.sequence + 1) & 0xf;
      if (this.sequence === 0) {
        while (now <= this.lastTimestamp) {
          now = Date.now();
        }
      }
    } else {
      this.sequence = 0;
    }

    this.lastTimestamp = now;

    return (
      (now * 0x1000) +      // 时间戳左移 12 位
      (this.machineId * 16) + // 机器 ID 左移 4 位
      this.sequence          // 序列号
    );
  }
}
