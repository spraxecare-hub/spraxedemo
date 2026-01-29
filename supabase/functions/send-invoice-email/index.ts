import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  invoiceHTML: string;
  invoiceNumber: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { to, invoiceHTML, invoiceNumber }: EmailRequest = await req.json();

    if (!to || !invoiceHTML || !invoiceNumber) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const emailData = {
      personalizations: [
        {
          to: [{ email: to }],
          subject: `Invoice ${invoiceNumber} - Spraxe`,
        },
      ],
      from: {
        email: "support.spraxe@gmail.com",
        name: "Spraxe",
      },
      content: [
        {
          type: "text/html",
          value: invoiceHTML,
        },
      ],
    };

    console.log("Email prepared for:", to);
    console.log("Invoice number:", invoiceNumber);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Invoice email queued (email service not configured yet)",
        note: "To enable email sending, configure SendGrid or another email service"
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});