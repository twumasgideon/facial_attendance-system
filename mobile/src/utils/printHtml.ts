import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * Print HTML on web with a visible preview window (blob URL),
 * and on native via PDF share/print.
 */
export async function printHtml(
  html: string,
  opts?: { dialogTitle?: string; onWebPrinted?: () => void },
): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const preview = window.open(url, '_blank', 'noopener,noreferrer,width=900,height=700');

    if (!preview) {
      URL.revokeObjectURL(url);
      // Fallback: same-tab print via temporary iframe sized for print dialog
      await printViaIframe(html);
      opts?.onWebPrinted?.();
      return;
    }

    // Give the preview time to render, then open the system print dialog
    await new Promise<void>((resolve) => {
      const tryPrint = () => {
        try {
          preview.focus();
          preview.print();
          opts?.onWebPrinted?.();
        } catch {
          /* user can still use Ctrl+P in the preview tab */
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        resolve();
      };

      // onload may not fire for blob URLs in every browser — dual path
      preview.addEventListener?.('load', () => setTimeout(tryPrint, 200));
      setTimeout(tryPrint, 600);
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

function printViaIframe(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.inset = '0';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = '0';
      iframe.style.zIndex = '99999';
      iframe.style.background = '#fff';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (!doc || !iframe.contentWindow) {
        document.body.removeChild(iframe);
        reject(new Error('Could not open print preview'));
        return;
      }
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } finally {
          setTimeout(() => {
            try {
              document.body.removeChild(iframe);
            } catch {
              /* ignore */
            }
            resolve();
          }, 500);
        }
      }, 400);
    } catch (e) {
      reject(e instanceof Error ? e : new Error('Print failed'));
    }
  });
}

export function alertPrintError(e: unknown) {
  const msg = e instanceof Error ? e.message : 'Could not print';
  if (Platform.OS === 'web') {
    window.alert(msg);
  } else {
    Alert.alert('Print failed', msg);
  }
}

/** Cross-platform success / info dialog (Alert is unreliable on web). */
export function notify(
  title: string,
  message: string,
  onOk?: () => void,
) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    onOk?.();
    return;
  }
  Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
}

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'OK', style: 'destructive', onPress: onConfirm },
  ]);
}
