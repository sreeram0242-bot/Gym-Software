export const DEFAULT_TEMPLATES = {
  welcome: `🎉 *Welcome to {{gymName}}, {{name}}!* 🏋️‍♂️🔥

We're thrilled to have you join our fitness family!

*Your Membership Details:*
📱 *Registered Number:* {{phone}}
💳 *Selected Plan:* {{plan}}
💰 *Fee Paid:* ₹{{amount}}
📅 *Date of Join:* {{joinDate}}
📅 *Next Due Date:* {{dueDate}}

✅ *WhatsApp service has been successfully started.*

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

We noticed you haven't checked into {{gymName}} for a few days.

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

export function compileTemplate(template: string, data: Record<string, string | number>) {
  let compiled = template;
  for (const [key, value] of Object.entries(data)) {
    compiled = compiled.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  }
  
  // 3. ANTI-SPAM MEASURE: Visible Spintax
  // We randomly swap common greetings to ensure visual text diversity.
  // This replaces instances of "Hi", "Hello", etc. at the start of lines.
  const greetings = ['Hi', 'Hello', 'Hey', 'Greetings', 'Good day'];
  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
  compiled = compiled.replace(/^Hi\b/gm, randomGreeting);
  
  // ANTI-SPAM MEASURE: Invisible text salting
  // We append 1 to 5 random Zero-Width characters to the end of the message.
  // These characters are completely invisible to the human eye on WhatsApp,
  // but they change the digital hash (signature) of every single message.
  // This tricks WhatsApp's AI into thinking every message is uniquely typed
  // rather than a 100% identical copy-pasted bulk broadcast!
  const zeroWidthSpaces = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
  let invisibleSalt = '';
  const saltLength = Math.floor(Math.random() * 5) + 1;
  for (let i = 0; i < saltLength; i++) {
    invisibleSalt += zeroWidthSpaces[Math.floor(Math.random() * zeroWidthSpaces.length)];
  }
  
  return compiled + invisibleSalt;
}
