export const sendOTPEmail = async (toEmail, otpCode) => {
  const RESEND_API_KEY = process.env.EXPO_PUBLIC_RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    throw new Error('Resend API key is missing. Please check your .env.local file.');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      // ⚠️ Note: Resend requires a verified domain or 'onboarding@resend.dev' for testing.
      // If you are testing without a custom domain, you MUST use 'onboarding@resend.dev' as the from address,
      // and you can ONLY send emails to the email address registered with your Resend account.
      from: 'Acme <onboarding@resend.dev>',
      to: [toEmail],
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2 style="color: #007AFF;">Welcome to Car Wash Manager!</h2>
          <p>Your one-time verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333; margin: 20px 0;">
            ${otpCode}
          </div>
          <p style="color: #666; font-size: 14px;">This code will expire in 5 minutes.</p>
        </div>
      `
    })
  });

  const data = await res.json();
  
  if (!res.ok) {
    console.error('Resend Error:', data);
    throw new Error(data.message || 'Failed to send email via Resend');
  }

  return data;
};
