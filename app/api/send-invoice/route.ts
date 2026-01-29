// app/api/send-invoice/route.ts
import { NextResponse } from 'next/server';
import { getInvoiceData, generateEmailInvoiceHTML } from '@/lib/invoice/invoice-generator';

export async function POST(req: Request) {
  try {
    const { orderId, email } = await req.json();

    if (!orderId || !email) {
      return NextResponse.json({ error: 'Missing orderId or email' }, { status: 400 });
    }

    console.log(`Sending API invoice for ${orderId} to ${email}...`);

    // 1. Fetch Invoice Data
    const invoiceData = await getInvoiceData(orderId);
    if (!invoiceData) {
      return NextResponse.json({ error: 'Invoice data not found' }, { status: 404 });
    }

    // 2. Generate HTML
    const emailHtml = generateEmailInvoiceHTML(invoiceData);

    // 3. Prepare Brevo API Request
    const apiKey = process.env.BREVO_API_KEY; 
    
    if (!apiKey) {
      console.error("Missing BREVO_API_KEY");
      return NextResponse.json({ error: "Server config error: Missing API Key" }, { status: 500 });
    }

    // 👇 UPDATED SENDER DETAILS HERE
    const payload = {
      sender: {
        name: "Spraxe", 
        email: "spraxecare@gmail.com" // This email MUST be verified in Brevo
      },
      to: [
        {
          email: email,
          name: invoiceData.customer.name
        }
      ],
      subject: `Order #${invoiceData.invoiceNumber} Confirmation`,
      htmlContent: emailHtml
    };

    // 4. Send via HTTP (Port 443 - Uses API Key, ignores SMTP Host/User)
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Brevo API Error:", errorData);
      throw new Error(`Brevo API Failed: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('Email sent via API:', data.messageId);

    return NextResponse.json({ success: true, messageId: data.messageId });

  } catch (error: any) {
    console.error('Email Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
