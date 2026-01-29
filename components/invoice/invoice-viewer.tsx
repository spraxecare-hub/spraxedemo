// components/invoice/invoice-viewer.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Loader2,
  Printer,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

interface InvoiceViewerProps {
  invoiceHTML: string;
  invoiceNumber: string;
}

export default function InvoiceViewer({ invoiceHTML, invoiceNumber }: InvoiceViewerProps) {
  const router = useRouter();
  const { toast } = useToast();

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [frameLoaded, setFrameLoaded] = useState(false);

  const srcDoc = useMemo(() => invoiceHTML, [invoiceHTML]);

  useEffect(() => {
    // When HTML changes, show loader again
    setFrameLoaded(false);
  }, [srcDoc]);

  const handlePrint = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;

    setIsPrinting(true);
    try {
      win.focus();
      win.print();
    } finally {
      // printing dialog is async; keep it simple
      setTimeout(() => setIsPrinting(false), 400);
    }
  };

  const handleCopyInvoice = async () => {
    try {
      await navigator.clipboard.writeText(invoiceNumber);
      toast({ title: 'Copied', description: `Invoice number ${invoiceNumber} copied.` });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy invoice number.', variant: 'destructive' });
    }
  };

  const handleOpenNewTab = () => {
    const blob = new Blob([srcDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleDownloadHTML = () => {
    try {
      const blob = new Blob([srcDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNumber || 'invoice'}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast({ title: 'Downloaded', description: 'Invoice downloaded as HTML.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to download HTML', variant: 'destructive' });
    }
  };

  const handleReloadFrame = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setFrameLoaded(false);
    iframe.srcdoc = srcDoc;
  };

  const handleDownloadPDF = async () => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    setIsDownloading(true);

    try {
      const iframeDoc = iframe.contentWindow.document;

      // IMPORTANT FIX:
      // html2pdf captures BODY; your CSS is in HEAD,
      // so copy style/link nodes into body for capture.
      const styleNodes = iframeDoc.querySelectorAll('style, link[rel="stylesheet"]');
      const body = iframeDoc.body;

      // Remove previously injected nodes if user clicks multiple times
      body.querySelectorAll('[data-injected="pdf-style"]').forEach((n) => n.remove());

      styleNodes.forEach((node) => {
        const clone = node.cloneNode(true) as HTMLElement;
        clone.setAttribute('data-injected', 'pdf-style');
        body.prepend(clone);
      });

      // Load html2pdf dynamically
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;

      const opt = {
        margin: [10, 10, 10, 10], // top, left, bottom, right (mm)
        filename: `${invoiceNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          windowWidth: 1000, // force "desktop" rendering width
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(opt).from(body).save();

      toast({ title: 'Success', description: 'Invoice downloaded as PDF' });
    } catch (error) {
      console.error('PDF Download Error:', error);
      toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Top Toolbar */}
      <div className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="h-9"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-bold text-gray-900 truncate">Invoice</div>
                <Badge className="bg-blue-50 text-blue-900 border border-blue-100">
                  {invoiceNumber}
                </Badge>
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
                Private document • Print can save as PDF
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={handleCopyInvoice}>
              <Copy className="h-4 w-4 mr-2" />
              Copy #
            </Button>

            <Button variant="outline" size="sm" className="h-9" onClick={handleReloadFrame}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload
            </Button>

            <Button variant="outline" size="sm" className="h-9" onClick={handleOpenNewTab}>
              <ExternalLink className="h-4 w-4 mr-2" />
              New tab
            </Button>

            <Button variant="outline" size="sm" className="h-9" onClick={handleDownloadHTML}>
              <FileDown className="h-4 w-4 mr-2" />
              HTML
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
            >
              {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {isDownloading ? 'Generating…' : 'PDF'}
            </Button>

            <Button
              size="sm"
              className="h-9 bg-blue-900 hover:bg-blue-800"
              onClick={handlePrint}
              disabled={isPrinting}
            >
              {isPrinting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Viewer */}
      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6 py-6">
        <Card className="shadow-sm border-gray-200 overflow-hidden">
          <CardContent className="p-0 bg-white relative">
            {/* Loading overlay */}
            {!frameLoaded && (
              <div className="absolute inset-0 z-10 bg-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 py-10">
                  <div className="h-9 w-9 rounded-full border-2 border-blue-900 border-t-transparent animate-spin" />
                  <div className="text-sm text-gray-600">Loading invoice…</div>
                </div>
              </div>
            )}

            <iframe
              ref={iframeRef}
              srcDoc={srcDoc}
              title="Invoice"
              className="w-full border-none"
              style={{ height: 'calc(100vh - 140px)' }}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              onLoad={() => setFrameLoaded(true)}
            />
          </CardContent>
        </Card>

        <div className="text-xs text-gray-500 mt-3">
          Tip: Click <b>Print</b> → choose <b>Save as PDF</b> for best quality.
        </div>
      </div>
    </div>
  );
}
