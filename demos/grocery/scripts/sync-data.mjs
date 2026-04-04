import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const PRODUCTS_URL =
    'https://static.airstate.dev/page-use-demo__grocery-ecommerce/products.json';
const PALETTES_URL =
    'https://static.airstate.dev/page-use-demo__grocery-ecommerce/image-palettes.json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public', 'data');

const downloadJson = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.status}`);
    }
    const text = await response.text();
    JSON.parse(text);
    return text;
};

const main = async () => {
    await mkdir(publicDir, {recursive: true});
    const [products, palettes] = await Promise.all([
        downloadJson(PRODUCTS_URL),
        downloadJson(PALETTES_URL),
    ]);

    await Promise.all([
        writeFile(path.join(publicDir, 'products.json'), products),
        writeFile(path.join(publicDir, 'image-palettes.json'), palettes),
    ]);

    console.log('Synced grocery demo data to public/data');
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
