import { deflateRawSync } from "node:zlib";

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

export type ZipTestEntry = {
  name: string;
  text: string;
  compressionMethod?: number;
  flags?: number;
  declaredUncompressedSize?: number;
  corruptCrc?: boolean;
};

export function crc32Checksum(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function asArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

export function writeUInt16(value: number) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

export function writeUInt32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

export function createZip(entries: ZipTestEntry[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.from(entry.text, "utf8");
    const compressionMethod = entry.compressionMethod ?? 8;
    const compressed = compressionMethod === 8 ? deflateRawSync(raw) : raw;
    const flags = entry.flags ?? 0x0800;
    const declaredUncompressedSize = entry.declaredUncompressedSize ?? raw.length;
    const actualCrc = crc32Checksum(raw);
    const declaredCrc = entry.corruptCrc ? (actualCrc ^ 0xffffffff) >>> 0 : actualCrc;

    const local = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(flags),
      writeUInt16(compressionMethod),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(declaredCrc),
      writeUInt32(compressed.length),
      writeUInt32(declaredUncompressedSize),
      writeUInt16(name.length),
      writeUInt16(0),
      name,
      compressed,
    ]);
    locals.push(local);

    const central = Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(flags),
      writeUInt16(compressionMethod),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(declaredCrc),
      writeUInt32(compressed.length),
      writeUInt32(declaredUncompressedSize),
      writeUInt16(name.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(localOffset),
      name,
    ]);
    centrals.push(central);
    localOffset += local.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entries.length),
    writeUInt16(entries.length),
    writeUInt32(centralDirectory.length),
    writeUInt32(localOffset),
    writeUInt16(0),
  ]);

  return Buffer.concat([...locals, centralDirectory, end]);
}
