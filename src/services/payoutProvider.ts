import crypto from 'crypto';
import { db } from '../db';
import { payouts } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * ============= PAYOUT PROVIDER SERVICE =============
 * 
 * Abstraction layer for seller payouts.
 * Mirrors VNPay's pattern but for seller bank transfers.
 * 
 * Supports multiple providers:
 * - 'mock' (default): Simulated/test transfers
 * - 'stp': STP Direct Transfer API (Vietnamese)
 * - 'payoo': PayOO Settlement API (Vietnamese)
 * 
 * To swap providers, only change PAYOUT_PROVIDER in .env
 * All request/response handling stays the same.
 */

// Track which payouts have already had webhooks called to prevent duplicates
const processedPayoutIds = new Set<string>();

export interface PayoutRequest {
  payoutId: string;
  externalPayoutId: string;
  amount: number;
  bankCode: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  bankBranch?: string;
  webhookUrl: string;
}

export interface PayoutResult {
  success: boolean;
  status: 'completed' | 'failed';
  providerTransactionId?: string;
  failureReason?: string;
}

// ============= SIGNATURE GENERATION (HMAC-SHA256) =============

function signPayoutRequest(data: Record<string, any>): string {
  const secret = process.env.PAYOUT_PROVIDER_SECRET || 'payout_secret_key_123';
  const sortedKeys = Object.keys(data).sort();
  const hashData = sortedKeys
    .map(k => `${k}=${encodeURIComponent(data[k])}`)
    .join('&');
  const hmac = crypto.createHmac('sha256', secret);
  return hmac.update(Buffer.from(hashData, 'utf-8')).digest('hex');
}

// ============= MAIN PAYOUT FUNCTION =============

/**
 * Send payout request to provider (mock or real based on .env).
 * Mirrors VNPay's async request + webhook pattern.
 */
export async function sendPayoutRequest(request: PayoutRequest): Promise<void> {
  const provider = process.env.PAYOUT_PROVIDER || 'mock';
  console.log(`[Payout Request] 📤 Sending to provider: ${provider} | Payout ID: ${request.payoutId} | Amount: ${request.amount} VND`);

  switch (provider) {
    case 'stp':
      return await sendToSTP(request);
    case 'payoo':
      return await sendToPayOO(request);
    case 'mock':
    default:
      return await sendToMockProvider(request);
  }
}

// ============= MOCK PROVIDER (FOR TESTING) =============

/**
 * Mock transfer provider - simulates bank processing.
 * 90% success rate for testing failure scenarios.
 * Processing time: 0.5-2 seconds.
 * 
 * Returns immediately so caller can continue, but processes asynchronously.
 * DO NOT await this - it returns immediately by design (like real API).
 */
async function sendToMockProvider(request: PayoutRequest): Promise<void> {
  const processingTime = Math.random() * 1500 + 500; // 0.5-2 seconds (faster for testing)
  const shouldSucceed = Math.random() > 0.1; // 90% success rate

  console.log(
    `[Payout Mock] Queued ${request.externalPayoutId} (${request.amount} VND) ` +
    `to ${request.bankAccountHolder} → ${request.bankCode} ${request.bankAccountNumber} | Success: ${shouldSucceed}`
  );

  // Schedule async processing (fire and forget, like real API)
  // Returns immediately - processing happens in background
  setTimeout(async () => {
    try {
      console.log(`[Payout Mock] Processing started for ${request.externalPayoutId}`);
      
      const result: PayoutResult = {
        success: shouldSucceed,
        status: shouldSucceed ? 'completed' : 'failed',
        providerTransactionId: shouldSucceed ? `MOCK_TFR_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}` : undefined,
        failureReason: !shouldSucceed ? 'Insufficient balance in merchant account' : undefined,
      };

      console.log(`[Payout Mock] ✅ RESULT: ${result.status}`, { externalPayoutId: request.externalPayoutId, payoutId: request.payoutId });

      // Call webhook to notify system
      console.log(`[Payout Mock] About to call webhook for ${request.payoutId}`);
      await callPayoutWebhook(request, result);

      // Update payout record in DB
      await updatePayoutFromResult(request.payoutId, result);
      console.log(`[Payout Mock] ✅ Completed for ${request.externalPayoutId}`);
    } catch (error) {
      console.error('[Payout Mock] Processing error:', error);
      console.error('[Payout Mock] Error stack:', (error as Error).stack);
    }
  }, processingTime);

  console.log(`[Payout Mock] ⏱️ Will process in ~${Math.round(processingTime / 100) / 10}s (${Math.round(processingTime)}ms)`);
}

// ============= STP PROVIDER (WHEN READY) =============

/**
 * STP Direct Transfer API implementation.
 * https://stp.vn/vi/developers
 * 
 * Requires:
 * - STP_API_URL=https://api.stp.vn
 * - STP_MERCHANT_ID=your_merchant_id
 * - STP_SECRET=your_secret_key
 */
async function sendToSTP(request: PayoutRequest): Promise<void> {
  const stpUrl = process.env.STP_API_URL || 'https://api.stp.vn';
  const merchantId = process.env.STP_MERCHANT_ID;
  const stpSecret = process.env.STP_SECRET;

  if (!merchantId || !stpSecret) {
    console.error('[Payout STP] Missing STP credentials in .env');
    throw new Error('STP credentials not configured');
  }

  const stpRequestBody = {
    SubaccountId: merchantId,
    ReceiverName: request.bankAccountHolder,
    ReceiverAccount: request.bankAccountNumber,
    ReceiverBankCode: request.bankCode,
    Amount: Math.round(request.amount),
    Description: `Payout ${request.externalPayoutId}`,
    ClientRefId: request.externalPayoutId, // For idempotency
  };

  const signature = signPayoutRequest(stpRequestBody);

  try {
    console.log(`[Payout STP] Sending transfer request: ${request.externalPayoutId}`);

    const response = await fetch(`${stpUrl}/api/v2/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
      },
      body: JSON.stringify(stpRequestBody),
    });

    if (!response.ok) {
      throw new Error(`STP API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('[Payout STP] Transfer initiated:', result);

    // STP will call webhook with result
    // For now, just log the request
  } catch (error) {
    console.error('[Payout STP] Request error:', error);
    throw error;
  }
}

// ============= PAYOO PROVIDER (WHEN READY) =============

/**
 * PayOO Settlement API implementation.
 * https://docs.payoo.vn/
 * 
 * Requires:
 * - PAYOO_API_URL=https://api.payoo.vn
 * - PAYOO_MERCHANT_ID=your_merchant_id
 * - PAYOO_SECRET=your_secret_key
 */
async function sendToPayOO(request: PayoutRequest): Promise<void> {
  const payooUrl = process.env.PAYOO_API_URL || 'https://api.payoo.vn';
  const merchantId = process.env.PAYOO_MERCHANT_ID;

  if (!merchantId) {
    console.error('[Payout PayOO] Missing PayOO credentials in .env');
    throw new Error('PayOO credentials not configured');
  }

  const payooRequestBody = {
    MerchantID: merchantId,
    TransactionID: request.externalPayoutId,
    Amount: Math.round(request.amount),
    BankCode: request.bankCode,
    AccountName: request.bankAccountHolder,
    AccountNumber: request.bankAccountNumber,
    Note: `Payout ${request.externalPayoutId}`,
  };

  const signature = signPayoutRequest(payooRequestBody);

  try {
    console.log(`[Payout PayOO] Sending settlement request: ${request.externalPayoutId}`);

    const response = await fetch(`${payooUrl}/api/payout/v1/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${signature}`,
      },
      body: JSON.stringify(payooRequestBody),
    });

    if (!response.ok) {
      throw new Error(`PayOO API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('[Payout PayOO] Settlement initiated:', result);

    // PayOO will call webhook with result
  } catch (error) {
    console.error('[Payout PayOO] Request error:', error);
    throw error;
  }
}

// ============= WEBHOOK CALLBACK HANDLER =============

/**
 * Call backend webhook with payout result.
 * Prevents duplicate webhook calls for the same payout ID.
 * Mirrors how VNPay sends IPN callbacks.
 */
async function callPayoutWebhook(request: PayoutRequest, result: PayoutResult): Promise<void> {
  // Prevent duplicate webhook calls for the same payout
  if (processedPayoutIds.has(request.payoutId)) {
    console.log(`[Payout Webhook] 🚫 ALREADY PROCESSED: ${request.payoutId}, skipping duplicate`);
    return;
  }
  
  processedPayoutIds.add(request.payoutId);
  console.log(`[Payout Webhook] 📌 Marked as processed: ${request.payoutId}`);

  const callbackData = {
    payoutId: request.payoutId,
    externalPayoutId: request.externalPayoutId,
    status: result.status,
    providerTransactionId: result.providerTransactionId || '',
    failureReason: result.failureReason || '',
  };

  const signature = signPayoutRequest(callbackData);

  try {
    console.log(`[Payout Webhook] 🔗 Calling webhook: ${request.webhookUrl}`);
    console.log(`[Payout Webhook] 📦 Payload:`, { payoutId: request.payoutId, status: result.status });

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(request.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...callbackData,
        signature,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Payout Webhook] ❌ Failed: ${response.status} ${response.statusText}`);
      // In production, implement retry logic here
    } else {
      console.log('[Payout Webhook] ✅ Delivered successfully');
    }
  } catch (error) {
    console.error('[Payout Webhook] ❌ Delivery error:', error);
    // In production, implement retry queue here
  }
}

// ============= DATABASE UPDATE FROM RESULT =============

/**
 * Update payout record in database based on provider result.
 * Called after webhook confirms or for mock provider.
 */
async function updatePayoutFromResult(payoutId: string, result: PayoutResult): Promise<void> {
  try {
    const updateData: any = {};

    if (result.status === 'completed') {
      updateData.status = 'completed';
      updateData.completedAt = new Date();
      if (result.providerTransactionId) {
        updateData.providerTransactionId = result.providerTransactionId;
      }
    } else if (result.status === 'failed') {
      updateData.status = 'failed';
      updateData.failureReason = result.failureReason || 'Transfer failed';
    }

    updateData.webhookReceivedAt = new Date();

    await db.update(payouts).set(updateData).where(eq(payouts.id, payoutId));

    console.log(`[Payout] Updated ${payoutId} to ${result.status}`);
  } catch (error) {
    console.error('[Payout] DB update error:', error);
  }
}

// ============= SIGNATURE VERIFICATION =============

/**
 * Verify webhook signature (for receiving callbacks from real providers).
 * Used in paymentController.handlePayoutCallback()
 */
export function verifyPayoutSignature(data: Record<string, any>, signature: string): boolean {
  const calculatedSignature = signPayoutRequest(data);
  return calculatedSignature === signature;
}
