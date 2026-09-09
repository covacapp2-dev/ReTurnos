import sharp from 'sharp';

const svgBuffer = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#080808"/>
  <rect x="40" y="40" width="432" height="432" rx="72" fill="#1A1A1A" stroke="#DC2626" stroke-width="6"/>
  <text x="256" y="280" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="180" fill="#DC2626" text-anchor="middle" dominant-baseline="central">RT</text>
</svg>
`);

async function generate() {
  await sharp(svgBuffer).resize(192, 192).png().toFile('public/icon-192.png');
  await sharp(svgBuffer).resize(512, 512).png().toFile('public/icon-512.png');
  console.log('Icons generated: public/icon-192.png, public/icon-512.png');
}

generate();
