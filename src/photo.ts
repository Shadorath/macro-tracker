/**
 * Shrinks a camera photo before it is sent to Gemini:
 * max 1568 px on the long side, JPEG quality 0.8.
 * Smaller photos upload faster and use less of the free quota.
 */

const MAX_SIDE = 1568;
const QUALITY = 0.8;

export type Photo = {
  base64: string;  // JPEG data for Gemini (without the "data:image/jpeg;base64," prefix)
  dataUrl: string; // the same image, for showing the thumbnail
};

export async function preparePhoto(file: File): Promise<Photo> {
  // "from-image" turns the photo upright using the camera's rotation info.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
  return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}
