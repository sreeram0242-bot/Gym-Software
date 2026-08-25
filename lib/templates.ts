export const DEFAULT_TEMPLATES = {
  welcome: `🎉 *Welcome to {{gymName}}, {{name}}!* 🏋️‍♂️🔥

We're thrilled to have you join our fitness family!

*Your Membership Details:*
📱 *Registered Number:* {{phone}}
💳 *Selected Plan:* {{plan}}
💰 *Fee Paid:* ₹{{amount}}
📅 *Next Due Date:* {{dueDate}}

Let's crush those fitness goals together! 💪 See you at the gym!

_Best Regards,_
*Team {{gymName}}*`,

  receipt: `🧾 *Payment Receipt - {{gymName}}*

Hi {{name}},

Thank you for your payment! Your membership has been successfully renewed. 🎉

*Payment Details:*
💰 *Amount Paid:* ₹{{amount}}
📅 *New Due Date:* {{dueDate}}

Keep up the great work and keep crushing your fitness goals! 💪🏋️‍♀️

_Best Regards,_
*Team {{gymName}}*`,

  reminder: `⚠️ *Action Required: Membership Due* ⚠️

Hi {{name}},

This is a gentle reminder from *{{gymName}}* that your gym membership fee of *₹{{amount}}* is due on *{{dueDate}}*.

Please clear your dues promptly to avoid any interruption to your workouts! 💪🔥

If you've already paid, please ignore this message.

_Best Regards,_
*Team {{gymName}}*`,

  absentee: `Hi {{name}},

We noticed you haven't checked into {{gymName}} for a few days! 🥺

Consistency is the key to results. We'd love to see you back in the gym soon!

Best,
Team {{gymName}}`,

  checkin: `📊 *{{gymName}} Attendance System*

Hi {{name}}! 
📍 *Status:* Checked IN
⏰ *Time:* {{time}}

Time to hit your targets today. Let's make every rep count! 💯`,

  checkout: `📊 *{{gymName}} Attendance System*

Hi {{name}}! 
📍 *Status:* Checked OUT
⏰ *Time:* {{time}}
⏱️ *Total Time Active:* {{duration}} Minutes

Consistency builds results. Great effort today! 📈💪`
};

export type TemplateType = keyof typeof DEFAULT_TEMPLATES;

// Helper to extract the correct template from the DB settings object, falling back to default
export function getTemplate(settings: any, type: TemplateType): string {
  if (!settings) return DEFAULT_TEMPLATES[type];
  
  switch(type) {
    case 'welcome': return settings.templateWelcome || DEFAULT_TEMPLATES.welcome;
    case 'receipt': return settings.templateReceipt || DEFAULT_TEMPLATES.receipt;
    case 'reminder': return settings.templateReminder || DEFAULT_TEMPLATES.reminder;
    case 'absentee': return settings.templateAbsentee || DEFAULT_TEMPLATES.absentee;
    case 'checkin': return settings.templateCheckIn || DEFAULT_TEMPLATES.checkin;
    case 'checkout': return settings.templateCheckOut || DEFAULT_TEMPLATES.checkout;
    default: return DEFAULT_TEMPLATES[type];
  }
}

export function compileTemplate(template: string, variables: Record<string, string | number>): string {
  let compiled = template;
  for (const [key, value] of Object.entries(variables)) {
    // Replace all instances of {{key}}
    const regex = new RegExp(`{{${key}}}`, 'g');
    compiled = compiled.replace(regex, String(value));
  }
  return compiled;
}
