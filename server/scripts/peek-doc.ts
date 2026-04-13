import '../src/env';
import { extractText } from '../src/services/textExtraction';
import fs from 'fs';

async function main() {
  const file = process.argv[2];
  const buf = fs.readFileSync(file);
  const text = await extractText(buf, 'application/pdf');
  console.log(text.slice(0, 2000));
}
main();
