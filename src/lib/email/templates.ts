export function announcementEmailTemplate({
  orgName,
  title,
  body,
  category,
  link,
}: {
  orgName: string
  title: string
  body: string
  category: string
  link: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: #0274be; color: #ffffff; padding: 24px 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .category { display: inline-block; background: rgba(255,255,255,0.2); color: #ffffff; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 8px; }
    .content { padding: 32px; }
    .content h2 { color: #1a1a1a; font-size: 20px; margin-top: 0; }
    .content p { color: #4a4a4a; margin: 16px 0; }
    .cta { display: inline-block; background: #0274be; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 20px; }
    .footer { padding: 24px 32px; background: #f4f4f4; color: #888; font-size: 12px; text-align: center; border-top: 1px solid #e0e0e0; }
    .footer a { color: #0274be; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${orgName}</h1>
      <div class="category">${category}</div>
    </div>
    <div class="content">
      <h2>${title}</h2>
      <p>${body}</p>
      <a href="${link}" class="cta">View Announcement</a>
    </div>
    <div class="footer">
      <p>This is an automated notification from ${orgName}.</p>
      <p>&copy; ${new Date().getFullYear()} ${orgName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`
}

export function reportReminderEmailTemplate({
  orgName,
  reportType,
  period,
  link,
}: {
  orgName: string
  reportType: string
  period: string
  link: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportType} Report Reminder</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: #21759b; color: #ffffff; padding: 24px 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 32px; }
    .content h2 { color: #1a1a1a; font-size: 20px; margin-top: 0; }
    .content p { color: #4a4a4a; margin: 16px 0; }
    .highlight { background: #eef6fb; border-left: 4px solid #21759b; padding: 16px; margin: 20px 0; }
    .cta { display: inline-block; background: #21759b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 20px; }
    .footer { padding: 24px 32px; background: #f4f4f4; color: #888; font-size: 12px; text-align: center; border-top: 1px solid #e0e0e0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${orgName}</h1>
    </div>
    <div class="content">
      <h2>${reportType} Report Due</h2>
      <p>Your ${reportType.toLowerCase()} report for <strong>${period}</strong> is ready to be submitted.</p>
      <div class="highlight">
        <p style="margin:0"><strong>Period:</strong> ${period}</p>
        <p style="margin:0"><strong>Report type:</strong> ${reportType}</p>
      </div>
      <a href="${link}" class="cta">Submit Report</a>
    </div>
    <div class="footer">
      <p>This is an automated reminder from ${orgName}.</p>
      <p>&copy; ${new Date().getFullYear()} ${orgName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`
}

export function attendanceReminderEmailTemplate({
  orgName,
  staffName,
  type,
  link,
}: {
  orgName: string
  staffName: string
  type: 'check_in' | 'check_out' | 'incomplete'
  link: string
}): string {
  const messages = {
    check_in: "You haven't checked in today yet. Please complete your attendance check-in.",
    check_out: "You haven't signed out yet. Please complete your evening sign-out.",
    incomplete: "Your attendance record is incomplete. Please check your check-in and sign-out times.",
  }
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Attendance Reminder</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: #d97706; color: #ffffff; padding: 24px 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 32px; }
    .content h2 { color: #1a1a1a; font-size: 20px; margin-top: 0; }
    .content p { color: #4a4a4a; margin: 16px 0; }
    .cta { display: inline-block; background: #d97706; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 20px; }
    .footer { padding: 24px 32px; background: #f4f4f4; color: #888; font-size: 12px; text-align: center; border-top: 1px solid #e0e0e0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${orgName}</h1>
    </div>
    <div class="content">
      <h2>Attendance Reminder</h2>
      <p>Hi ${staffName},</p>
      <p>${messages[type]}</p>
      <a href="${link}" class="cta">Record Attendance</a>
    </div>
    <div class="footer">
      <p>This is an automated reminder from ${orgName}.</p>
      <p>&copy; ${new Date().getFullYear()} ${orgName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`
}
