const { addCustomer } = require('../lib/actions');

async function test() {
  try {
    console.log("Testing adding a member with card '4444634' (when Newreg has '0004444634')...");
    await addCustomer({
      gymId: '17a5d460-2811-4d25-bd35-b54c15709205',
      name: 'Duplicate Test Member',
      phone: '9999988888',
      nfcCardId: '4444634',
      planType: 'Monthly',
      feeAmount: 2500,
      paidAmount: 2500,
      lastPaymentDate: '2026-09-03',
      nextDueDate: '2026-10-03'
    });
    console.log("ERROR: Duplicate was NOT blocked!");
  } catch (err) {
    console.log("SUCCESS! Backend correctly threw validation error:", err.message);
  }
}

test();
