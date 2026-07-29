import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/** Reliable HTML print for web (iframe) and native (PDF share/print). */
export async function printHtml(
  html: string,
  opts?: { dialogTitle?: string; onWebPrinted?: () => void },
): Promise<void> {
  if (Platform.OS === 'web') {
    await new Promise<void>((resolve, reject) => {
      try {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('title', 'print-frame');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.opacity = '0';
        document.body.appendChild(iframe);

        const win = iframe.contentWindow;
        const doc = win?.document;
        if (!win || !doc) {
          document.body.removeChild(iframe);
          reject(new Error('Could not open print frame'));
          return;
        }

        doc.open();
        doc.write(html);
        doc.close();

        const cleanup = () => {
          try {
            document.body.removeChild(iframe);
          } catch {
            /* already removed */
          }
        };

        const doPrint = () => {
          try {
            win.focus();
            win.print();
            opts?.onWebPrinted?.();
            // delay remove so the print dialog can read the document
            setTimeout(cleanup, 1000);
            resolve();
          } catch (e) {
            cleanup();
            reject(e instanceof Error ? e : new Error('Print failed'));
          }
        };

        // Wait for layout/images
        setTimeout(doPrint, 350);
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Print failed'));
      }
    });
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: opts?.dialogTitle || 'Print or share',
      UTI: 'com.adobe.pdf',
    });
  } else {
    await Print.printAsync({ html });
  }
}

export function alertPrintError(e: unknown) {
  Alert.alert('Print failed', e instanceof Error ? e.message : 'Could not print');
}
