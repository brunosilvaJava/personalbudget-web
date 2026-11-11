/**
 * Splits CSV text into rows of fields (RFC 4180: quotes, "" inside quotes, CRLF). No type
 * conversion and no assumption about the columns: the statements of the banks are not consistent
 * (the C6 file has unquoted commas inside the description), so each parser decides what a row means.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = text.replace(/^﻿/, '')

  for (let index = 0; index < source.length; index++) {
    const char = source.charAt(index)
    if (quoted) {
      if (char === '"') {
        if (source.charAt(index + 1) === '"') {
          field += '"'
          index++
        } else quoted = false
      } else field += char
    } else if (char === '"' && field === '') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source.charAt(index + 1) === '\n') index++
      row.push(field)
      field = ''
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
    } else field += char
  }
  row.push(field)
  if (row.some((value) => value.trim() !== '')) rows.push(row)
  return rows
}
