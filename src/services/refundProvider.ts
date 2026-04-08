import crypto from 'crypto';

export interface RefundRequest {
  refundId: string;
  transactionNo: string;  // vnp_TransactionNo from original payment
  amount: number;          // Refund amount in VND
  reason: string;
  webhookUrl: string;      // Where VNPay sends refund result
}

export interface RefundResponse {
  refundId: string;
  status: 'pending' | 'completed' | 'failed';
  message: string;
}

/**
 * Send refund request to VNPay or mock provider based on REFUND_PROVIDER env var
 * 
 * REFUND_PROVIDER values:
 * - 'vnpay': Real VNPay Refund API (production)
 * - 'mock': Local mock provider with configurable delay (testing/sandbox)
 * - 'mock-instant': Mock with instant confirmation (demo)
 */
export async function sendRefundRequest(request: RefundRequest): Promise<RefundResponse> {
  const provider = process.env.REFUND_PROVIDER || 'mock';
  
  console.log(`[Refund] Using provider: ${provider}`);
  
  if (provider === 'vnpay') {
    return sendToVNPayRefundAPI(request);
  } else if (provider === 'mock-instant') {
    return mockInstantRefund(request);
  } else {
    // Default: mock with 1 minute delay (configurable)
    return mockRefundWithDelay(request);
  }
}

/**
 * Call real VNPay Refund API
 * POST https://api.vnpayment.vn/merchant_webapi/api/transaction
 */
async function sendToVNPayRefundAPI(request: RefundRequest): Promise<RefundResponse> {
  try {
    const tmnCode = process.env.VNP_TMNCODE!;
    const secret = process.env.VNP_SECRET!;
    const accessCode = process.env.VNP_ACCESS_CODE; // VNPay API access code

    if (!accessCode) {
      throw new Error('VNP_ACCESS_CODE not configured for VNPay Refund API');
    }

    // Build refund request
    const timestamp = Math.floor(Date.now() / 1000);
    const requestId = `REFUND_${timestamp}_${request.refundId.slice(0, 8)}`;

    const refundData = {
      RequestId: requestId,
      Version: '2.1.0',
      Command: 'refund',
      Merchant: {
        MerchantId: tmnCode,
        AccessCode: accessCode,
      },
      TransactionRequire: {
        TransactionNo: request.transactionNo,
        Amount: Math.round(request.amount * 100), // VNPay expects centless format
        OrderDescription: request.reason,
        CurrCode: 'VND',
      },
      TmnCode: tmnCode,
      TxnRef: `REFUND_${request.refundId}`,
      CreateDate: Math.floor(Date.now() / 1000),
      IpAddress: '127.0.0.1', // Backend IP
    };

    // Sign request with HMAC
    const dataStr = JSON.stringify(refundData);
    const hmac = crypto.createHmac('sha512', secret);
    const secureHash = hmac.update(Buffer.from(dataStr, 'utf-8')).digest('hex');

    const payload = {
      ...refundData,
      SecureHash: secureHash,
    };

    // Send to VNPay
    const response = await fetch('https://api.vnpayment.vn/merchant_webapi/api/transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as any;

    console.log(`[Refund] VNPay API response:`, result);

    // VNPay returns: { Code: '00'|'XX', Message: string, Data: {...} }
    if (result?.Code === '00') {
      return {
        refundId: request.refundId,
        status: 'pending', // VNPay will process and send webhook when done
        message: 'Refund request submitted to VNPay',
      };
    } else {
      throw new Error(`VNPay API error: ${result?.Message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('[Refund] VNPay API error:', error);
    throw error;
  }
}

/**
 * Mock refund with instant completion (for demo/testing)
 */
async function mockInstantRefund(request: RefundRequest): Promise<RefundResponse> {
  console.log(`[Refund Mock-Instant] Processing refund ${request.refundId}`);
  console.log(`[Refund Mock-Instant] Amount: ${request.amount} VND`);
  console.log(`[Refund Mock-Instant] Reason: ${request.reason}`);

  return {
    refundId: request.refundId,
    status: 'completed',
    message: 'Mock refund completed instantly',
  };
}

/**
 * Mock refund with configurable delay (default 1 minute)
 * Simulates real VNPay processing time for testing
 */
async function mockRefundWithDelay(request: RefundRequest): Promise<RefundResponse> {
  const delayMs = parseInt(process.env.REFUND_MOCK_DELAY_MS || '60000'); // Default 1 minute
  
  console.log(`[Refund Mock-Delayed] Processing refund ${request.refundId}`);
  console.log(`[Refund Mock-Delayed] Amount: ${request.amount} VND`);
  console.log(`[Refund Mock-Delayed] Reason: ${request.reason}`);
  console.log(`[Refund Mock-Delayed] Will confirm in ${(delayMs / 1000).toFixed(0)}s`);

  // Return pending immediately
  const response = {
    refundId: request.refundId,
    status: 'pending' as const,
    message: `Mock refund will complete in ${(delayMs / 1000).toFixed(0)}s`,
  };

  // Schedule webhook callback after delay
  setTimeout(async () => {
    try {
      await sendRefundWebhookCallback(request.webhookUrl, {
        refundId: request.refundId,
        status: 'completed',
        message: 'Mock refund completed',
        transactionNo: request.transactionNo,
      });
    } catch (error) {
      console.error('[Refund Mock] Failed to send webhook callback:', error);
    }
  }, delayMs);

  return response;
}

/**
 * Send webhook callback to backend when refund is confirmed
 */
async function sendRefundWebhookCallback(
  webhookUrl: string,
  data: {
    refundId: string;
    status: 'completed' | 'failed';
    message: string;
    transactionNo?: string;
  }
): Promise<void> {
  try {
    console.log(`[Refund Webhook] Sending callback to ${webhookUrl}`);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error(`[Refund Webhook] Error: ${response.status} ${response.statusText}`);
      throw new Error(`Webhook returned ${response.status}`);
    }

    const result = await response.json();
    console.log(`[Refund Webhook] Callback successful:`, result);
  } catch (error) {
    console.error('[Refund Webhook] Error:', error);
    throw error;
  }
}

export { sendRefundWebhookCallback };
