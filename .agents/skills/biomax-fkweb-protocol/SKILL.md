---
name: biomax-fkweb-protocol
description: Cheatsheet for integrating Biomax/ZKTeco biometric devices using the FKWeb (hdata.aspx) protocol and deploying on Coolify.
---

# Biomax FKWeb Protocol Integration

When modifying code related to biometric devices, `/hdata.aspx`, or remote commands, you MUST adhere to these hardware constraints:

## 1. HTTP Response Constraints (CRITICAL)
Legacy device firmware parses HTTP manually and crashes on modern HTTP streaming.
- **NEVER** return chunked responses. You MUST explicitly set the `Content-Length` header on all Next.js `NextResponse` objects sent to the device.
- **ALWAYS** set `'Connection': 'close'` and `'Content-Type': 'text/plain'`.

Example:
```typescript
const res = "result=OK";
return new NextResponse(res, {
  status: 200,
  headers: {
    'Content-Type': 'text/plain',
    'Connection': 'close',
    'Content-Length': res.length.toString()
  }
});
```

## 2. Preventing Infinite Loops
When the device sends `RTLogSendAction` (attendance) or `RTEnrollDataAction` (enrollment), it expects a highly specific acknowledgment.
- You **MUST** return exactly `"result=OK"`.
- If you return anything else (like `"OK"` or JSON), the device will enter an infinite loop, continuously re-sending the same log and refusing to poll for new commands.

## 3. Command Payloads (`ReceiveCommandAction`)
When the device polls for commands, do not return JSON. Return the ADMS plain-text command string.
- Remote Enroll: `C:123:ENROLL_FP:PIN={userId}:FID=0:RETRY=3`

## 4. Coolify Deployment & Queues
Coolify deploys Next.js across multiple isolated Docker workers.
- **NEVER** use `globalThis` or memory-based queues to pass commands to the device.
- **ALWAYS** use the database (e.g., Prisma `BiometricCommand`) to queue and consume commands.
