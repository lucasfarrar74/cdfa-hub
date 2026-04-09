// WUSATA template image assets — imported as URLs via Vite, loaded on demand
import image1Url from '../assets/wusata/image1.jpeg';
import image2Url from '../assets/wusata/image2.jpeg';
import image3Url from '../assets/wusata/image3.jpeg';
import image4Url from '../assets/wusata/image4.jpeg';
import image5Url from '../assets/wusata/image5.jpeg';
import logoUrl from '../assets/wusata/image6.svg';

const imageUrls = [image1Url, image2Url, image3Url, image4Url, image5Url];

export interface WusataImage {
  dataUrl: string;
  width: number;
  height: number;
  aspectRatio: number; // width / height
}

let cachedImages: WusataImage[] | null = null;

/**
 * Load all WUSATA template images as base64 data URIs with dimensions.
 * Results are cached after first load.
 */
export async function loadWusataImages(): Promise<WusataImage[]> {
  if (cachedImages) return cachedImages;

  const results = await Promise.all(
    imageUrls.map(async (url) => {
      const response = await fetch(url);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      // Get image dimensions
      const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.src = dataUrl;
      });

      return { dataUrl, width, height, aspectRatio: width / height };
    })
  );

  cachedImages = results;
  return results;
}

let cachedLogo: string | null = null;

/**
 * Load the WUSATA SVG logo as a PNG data URL for jsPDF embedding.
 */
export async function loadWusataLogo(): Promise<string> {
  if (cachedLogo) return cachedLogo;

  // Load SVG and render to canvas at high resolution
  const response = await fetch(logoUrl);
  const svgText = await response.text();

  const canvas = document.createElement('canvas');
  const scale = 4; // render at 4x for quality
  canvas.width = 211 * scale;
  canvas.height = 152 * scale;
  const ctx = canvas.getContext('2d')!;

  const img = new Image();
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
  const svgUrl = URL.createObjectURL(svgBlob);

  await new Promise<void>((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve();
    };
    img.src = svgUrl;
  });

  URL.revokeObjectURL(svgUrl);
  cachedLogo = canvas.toDataURL('image/png');
  return cachedLogo;
}
