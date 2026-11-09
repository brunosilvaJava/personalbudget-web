#!/usr/bin/env python3
"""Compares the interfaces of src/api/contracts.ts with the DTO records of the back-end.

Usage: python3 scripts/check-contract.py ../personalbudget [src/api/contracts.ts]

Reads every `public record` under the back's controller package, takes the JSON name of each
component (@JsonProperty or the component name; @Schema(hidden = true) ones are skipped) and
prints the fields that exist on one side only. Nested records and enums are not compared.
Until the openapi-typescript check (Phase 5), this is how the contract is rechecked by hand.
"""
import json
import os
import re
import sys


def java_dtos(root):
    out = {}
    for dp, _, fs in os.walk(root):
        for f in fs:
            if not f.endswith('.java'):
                continue
            src = open(os.path.join(dp, f), encoding='utf-8').read()
            m = re.search(r'public record (\w+)\s*\((.*?)\)\s*(implements[^{]*)?\{', src, re.S)
            if not m:
                continue
            name, body = m.group(1), m.group(2)
            fields, depth, cur = [], 0, ''
            for ch in body:
                if ch in '(<{':
                    depth += 1
                if ch in ')>}':
                    depth -= 1
                if ch == ',' and depth == 0:
                    fields.append(cur)
                    cur = ''
                else:
                    cur += ch
            if cur.strip():
                fields.append(cur)
            names = []
            for fl in fields:
                if '@Schema(hidden = true)' in fl:
                    continue
                jp = re.search(r'@JsonProperty\(\s*(?:value\s*=\s*)?"([^"]+)"', fl)
                clean = re.sub(r'@\w+(\((?:[^()]|\([^()]*\))*\))?', '', fl, flags=re.S)
                toks = re.findall(r'[A-Za-z_]\w*', clean)
                if toks:
                    names.append(jp.group(1) if jp else toks[-1])
            out[name] = names
    return out


def ts_interfaces(path):
    ts = open(path, encoding='utf-8').read()
    ifaces = {}
    for m in re.finditer(r'export interface (\w+)(?:<\w+>)?(?: extends (\w+))?\s*\{(.*?)\n\}', ts, re.S):
        name, ext, body = m.group(1), m.group(2), m.group(3)
        body = re.sub(r'/\*.*?\*/', '', body, flags=re.S)
        body = re.sub(r'//.*', '', body)
        fields, depth = [], 0
        for line in body.split('\n'):
            s = line.strip()
            if depth == 0:
                fm = re.match(r'(\w+)\??:', s)
                if fm:
                    fields.append(fm.group(1))
            depth += s.count('{') - s.count('}')
        ifaces[name] = (ext, fields)
    for m in re.finditer(r'^export type (\w+) = (\w+)$', ts, re.M):
        if m.group(2) in ifaces:
            ifaces[m.group(1)] = (m.group(2), [])
    return ifaces


# TS name -> Java record name, where they differ.
ALIASES = {'DailyBalance': 'DailyBalanceResponse', 'ValidationErrorResponse': 'ValidationResponse'}
# Filled from the path by the back; the client never sends them.
IGNORED = {'FixedBillUpdateRequest': {'code'}, 'InstallmentBillUpdateRequest': {'code'}}


def main():
    back = sys.argv[1] if len(sys.argv) > 1 else '../personalbudget'
    contracts = sys.argv[2] if len(sys.argv) > 2 else 'src/api/contracts.ts'
    java = java_dtos(os.path.join(back, 'src/main/java/com/bts/personalbudget/controller'))
    ifaces = ts_interfaces(contracts)

    def fields(n):
        ext, f = ifaces[n]
        return (fields(ext) if ext else []) + f

    problems = 0
    for name in sorted(ifaces):
        record = ALIASES.get(name, name)
        if record not in java:
            continue
        only_java = set(java[record]) - set(fields(name)) - IGNORED.get(name, set())
        only_ts = set(fields(name)) - set(java[record])
        if only_java or only_ts:
            problems += 1
            print(f'{name}: only in the back {sorted(only_java)}, only in contracts.ts {sorted(only_ts)}')
    missing = sorted(set(java) - {ALIASES.get(n, n) for n in ifaces} - {'PagedFinancialMovementResponse', 'PagedFixedBillResponse', 'PagedInstallmentBillResponse'})
    if missing:
        print('records without an interface:', ', '.join(missing))
    print('OK' if problems == 0 else f'{problems} difference(s)')
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
