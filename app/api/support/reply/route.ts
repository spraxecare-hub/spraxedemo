// app/api/support/reply/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { ticketId, customerEmail, subject, message, agentName } = await req.json();

    // 1. Validation
    if (!customerEmail || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 2. Check API Key
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.error("Missing BREVO_API_KEY");
      return NextResponse.json({ error: "Server config error: Missing API Key" }, { status: 500 });
    }

    console.log(`Sending Support Reply for Ticket ${ticketId} to ${customerEmail}...`);

    // 3. Prepare Brevo Payload (Modern Style)
    const payload = {
      sender: {
        name: "Spraxe Support",
        email: "spraxecare@gmail.com" // Must be a verified sender in Brevo
      },
      to: [{ email: customerEmail }],
      subject: `Re: ${subject} [Ticket #${ticketId ? ticketId.slice(0, 8) : 'REF'}]`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
            <h2 style="color:#1e3a8a;text-align:center;margin-bottom:16px;">Support Update</h2>
            <p>Dear Customer,</p>

            <div style="background:#f8fafc;padding:16px;border-left:4px solid #1e3a8a;margin:20px 0;border-radius:6px;">
              ${message.replace(/\n/g, '<br>')}
            </div>

            <p>If you have further questions, please reply directly to this email.</p>

            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">

            <p style="font-size:12px;color:#666;text-align:center;">
              Ticket ID: <strong>${ticketId}</strong><br>
              Replied by: ${agentName || 'Spraxe Support Team'}
            </p>

            <p style="text-align:center;margin-top:16px;">
              💬 <a href="https://m.me/spraxe" target="_blank">Messenger</a> | 📱 <a href="https://wa.me/01606087761" target="_blank">WhatsApp</a>
            </p>
          </div>
        </div>
      `
    };

    // 4. Send Request to Brevo API
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Brevo API Error:", errorData);
      throw new Error(errorData.message || response.statusText);
    }

    const data = await response.json();
    console.log('Support reply sent via API:', data.messageId);

    return NextResponse.json({ success: true, messageId: data.messageId });

  } catch (error: any) {
    console.error('Email Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
