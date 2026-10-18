// Буфер обмена, скачивание и «Поделиться».
const FILE_NAME = 'absurd-meme.png';

export function canvasBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось собрать картинку'))), 'image/png'),
  );
}

export const canCopyImage = () => !!navigator.clipboard?.write && typeof ClipboardItem !== 'undefined';
export const canShare = () => typeof navigator.share === 'function';

export async function copyImage(canvas) {
  if (!canCopyImage()) throw new Error('Этот браузер не копирует картинки. Нажми «Скачать».');
  // Промис внутри ClipboardItem нужен Safari: запись должна начаться прямо в обработчике клика.
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasBlob(canvas) })]);
}

export async function downloadImage(canvas) {
  const blob = await canvasBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = FILE_NAME;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function shareImage(canvas, url) {
  const blob = await canvasBlob(canvas);
  const file = new File([blob], FILE_NAME, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file] });
  return navigator.share({ url });
}

export async function copyText(text) {
  await navigator.clipboard.writeText(text);
}
