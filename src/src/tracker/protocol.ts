export type WireValue = number | Uint8Array
export type WireField = { number: number; wireType: number; value: WireValue }

export function fields(bytes: Uint8Array): WireField[] {
  const result: WireField[] = []
  let offset = 0
  while (offset < bytes.length) {
    const key = readVarint(bytes, offset)
    offset = key.offset
    const fieldNumber = Number(key.value >> 3n)
    const wireType = Number(key.value & 7n)
    if (wireType === 0) {
      const value = readVarint(bytes, offset)
      offset = value.offset
      result.push({ number: fieldNumber, wireType, value: Number(value.value) })
    } else if (wireType === 2) {
      const length = readVarint(bytes, offset)
      offset = length.offset
      const end = offset + Number(length.value)
      if (end > bytes.length) throw new Error('Truncated protobuf field')
      result.push({ number: fieldNumber, wireType, value: bytes.slice(offset, end) })
      offset = end
    } else {
      throw new Error(`Unsupported protobuf wire type: ${wireType}`)
    }
  }
  return result
}

function readVarint(bytes: Uint8Array, start: number): { value: bigint; offset: number } {
  let value = 0n
  let shift = 0n
  let offset = start
  while (offset < bytes.length) {
    const byte = bytes[offset++]
    value |= BigInt(byte & 0x7f) << shift
    if (byte < 0x80) return { value, offset }
    shift += 7n
  }
  throw new Error('Truncated protobuf varint')
}

export function text(value: WireValue): string | null {
  if (typeof value === 'number') return null
  return new TextDecoder().decode(value)
}

export function bytes(value: WireValue): Uint8Array | null {
  return typeof value === 'number' ? null : value
}

export function xorAction(data: Uint8Array): Uint8Array {
  const keys = [0x84, 0x5e, 0x4e, 0x42, 0x39, 0xa2, 0x1f, 0x60, 0x1c]
  const base = 23 ^ data.length
  return data.map((byte, index) => byte ^ ((base + 5 * index + keys[index % keys.length]) & 0xff))
}

export function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
