/**
 * Gera o "PIX copia e cola" (BR Code) no padrão EMV/Bacen.
 * Suficiente para a maioria dos apps bancários abrirem o pagamento.
 */
export interface PixPayloadOpts {
  pixKey: string;
  merchantName: string;   // até 25 chars
  merchantCity: string;   // até 15 chars
  amountCents?: number;   // opcional
  txid?: string;          // opcional (até 25 chars alfanumérico)
  description?: string;   // opcional, livre
}

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function sanitize(s: string, max: number): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .,-]/g, "")
    .trim()
    .slice(0, max)
    .toUpperCase();
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixPayload(opts: PixPayloadOpts): string {
  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", opts.pixKey.trim());
  const additional = opts.txid
    ? tlv("05", sanitize(opts.txid, 25).replace(/\s+/g, ""))
    : tlv("05", "***");

  let payload = "";
  payload += tlv("00", "01"); // Payload Format Indicator
  payload += tlv("26", merchantAccount);
  payload += tlv("52", "0000"); // MCC
  payload += tlv("53", "986"); // BRL
  if (opts.amountCents && opts.amountCents > 0) {
    payload += tlv("54", (opts.amountCents / 100).toFixed(2));
  }
  payload += tlv("58", "BR");
  payload += tlv("59", sanitize(opts.merchantName || "RECEBEDOR", 25));
  payload += tlv("60", sanitize(opts.merchantCity || "BRASIL", 15));
  payload += tlv("62", additional);
  payload += "6304";
  return payload + crc16(payload);
}
