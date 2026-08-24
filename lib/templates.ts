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
Team {{gymName}}`
};

export type TemplateType = keyof typeof DEFAULT_TEMPLATES;

export function getTemplate(gymId: string, type: TemplateType): string {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES[type];
  const saved = localStorage.getItem(`template_${type}_${gymId}`);
  return saved || DEFAULT_TEMPLATES[type];
}

export function saveTemplate(gymId: string, type: TemplateType, content: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`template_${type}_${gymId}`, content);
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
