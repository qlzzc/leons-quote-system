async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from || !to) return { sent: false, skipped: true };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Email send failed: ${details || response.statusText}`);
  }

  return { sent: true, skipped: false };
}

async function sendSignedQuoteNotifications({ client, project, quote, signedRecord }) {
  const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL;
  const signedTimestamp = signedRecord?.signed_at || new Date().toISOString();
  const subject = `Quote signed: ${client?.full_name || 'Client'} | ${project?.title || project?.id || 'Project'}`;
  const summaryHtml = `
    <p>A quote was signed in the client portal.</p>
    <ul>
      <li><strong>Client</strong>: ${client?.full_name || 'Unknown client'}</li>
      <li><strong>Primary phone</strong>: ${client?.primary_phone || 'Not available'}</li>
      <li><strong>Project</strong>: ${project?.title || 'Untitled project'} (${project?.id || 'n/a'})</li>
      <li><strong>Signed at</strong>: ${signedTimestamp}</li>
      <li><strong>Quote version</strong>: ${quote?.quote_number || `v${quote?.version_number || '?'}`} (${quote?.id || 'n/a'})</li>
    </ul>
  `;
  const summaryText = [
    'A quote was signed in the client portal.',
    `Client: ${client?.full_name || 'Unknown client'}`,
    `Primary phone: ${client?.primary_phone || 'Not available'}`,
    `Project: ${project?.title || 'Untitled project'} (${project?.id || 'n/a'})`,
    `Signed at: ${signedTimestamp}`,
    `Quote version: ${quote?.quote_number || `v${quote?.version_number || '?'}`} (${quote?.id || 'n/a'})`,
  ].join('\n');

  const adminResult = adminTo
    ? await sendEmail({ to: adminTo, subject, html: summaryHtml, text: summaryText })
    : { sent: false, skipped: true };

  let clientResult = { sent: false, skipped: true };
  if (client?.email) {
    clientResult = await sendEmail({
      to: client.email,
      subject: `Quote signed: ${project?.title || 'Your project'}`,
      html: `
        <p>Thank you. Your quote has been signed successfully.</p>
        <ul>
          <li><strong>Project</strong>: ${project?.title || 'Untitled project'}</li>
          <li><strong>Signed at</strong>: ${signedTimestamp}</li>
          <li><strong>Quote version</strong>: ${quote?.quote_number || `v${quote?.version_number || '?'}`}</li>
        </ul>
      `,
      text: [
        'Thank you. Your quote has been signed successfully.',
        `Project: ${project?.title || 'Untitled project'}`,
        `Signed at: ${signedTimestamp}`,
        `Quote version: ${quote?.quote_number || `v${quote?.version_number || '?'}`}`,
      ].join('\n'),
    });
  }

  return {
    admin: adminResult,
    client: clientResult,
  };
}

module.exports = {
  sendEmail,
  sendSignedQuoteNotifications,
};
