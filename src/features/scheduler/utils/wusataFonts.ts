import { jsPDF } from 'jspdf';

import aboveTheBeyondUrl from '../assets/fonts/AboveTheBeyond.ttf';
import centuryGothicUrl from '../assets/fonts/GOTHIC.TTF';
import centuryGothicBoldUrl from '../assets/fonts/GOTHICB.TTF';

export const FONT_TITLE = 'AboveTheBeyond';
export const FONT_BODY = 'CenturyGothic';

async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
}

let cachedFonts: { title: string; body: string; bodyBold: string } | null = null;

export async function registerWusataFonts(doc: jsPDF): Promise<void> {
  if (!cachedFonts) {
    const [title, body, bodyBold] = await Promise.all([
      fetchFontAsBase64(aboveTheBeyondUrl),
      fetchFontAsBase64(centuryGothicUrl),
      fetchFontAsBase64(centuryGothicBoldUrl),
    ]);
    cachedFonts = { title, body, bodyBold };
  }

  doc.addFileToVFS('AboveTheBeyond.ttf', cachedFonts.title);
  doc.addFont('AboveTheBeyond.ttf', FONT_TITLE, 'normal');

  doc.addFileToVFS('CenturyGothic.ttf', cachedFonts.body);
  doc.addFont('CenturyGothic.ttf', FONT_BODY, 'normal');

  doc.addFileToVFS('CenturyGothicBold.ttf', cachedFonts.bodyBold);
  doc.addFont('CenturyGothicBold.ttf', FONT_BODY, 'bold');
}
