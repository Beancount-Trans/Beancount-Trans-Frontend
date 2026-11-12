import { toPng } from 'html-to-image'

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

export async function captureElementAsPng(element: HTMLElement): Promise<Blob> {
  await waitForPaint()
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#FCFBF8',
  })
  const response = await fetch(dataUrl)
  return response.blob()
}

export async function sharePngBlob(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' })
  const shareData = {
    files: [file],
    title: 'Beancount-Trans',
  }

  if (navigator.canShare?.(shareData)) {
    await navigator.share(shareData)
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
