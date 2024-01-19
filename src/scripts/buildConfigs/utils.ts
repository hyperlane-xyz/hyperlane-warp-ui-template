import fs from 'fs';
import { parse } from 'yaml';

export function readYaml(path: string) {
  return parse(fs.readFileSync(path, 'utf-8'));
}
