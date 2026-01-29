// app/invoice/[orderId]/page.tsx
import { notFound } from 'next/navigation';
import { getInvoiceData, generateInvoiceHTML } from '@/lib/invoice/invoice-generator';
import InvoiceViewer from '@/components/invoice/invoice-viewer';

// ✅ Force this page to be dynamic (no caching)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { orderId: string };
}

export default async function InvoicePage({ params }: Props) {
  const invoiceData = await getInvoiceData(params.orderId);

  if (!invoiceData) return notFound();

  const invoiceHTML = generateInvoiceHTML(invoiceData);

  return (
    <InvoiceViewer
      invoiceHTML={invoiceHTML}
      invoiceNumber={invoiceData.invoiceNumber}
    />
  );
}
