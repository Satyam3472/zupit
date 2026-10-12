export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  name: string;
  sendOtp(phone: string, otp: string): Promise<SendSmsResult>;
  sendSms(phone: string, message: string, templateId?: string): Promise<SendSmsResult>;
}

/**
 * MockProvider: Prints OTP to stdout for local testing & development
 */
export class MockProvider implements SmsProvider {
  name = 'mock';

  async sendOtp(phone: string, otp: string): Promise<SendSmsResult> {
    const formattedPhone = phone.startsWith('+91') ? phone : `+91 ${phone}`;
    console.log('\n======================================================');
    console.log(`📱 [MOCK SMS PROVIDER] OTP Dispatch`);
    console.log(`   To:   ${formattedPhone}`);
    console.log(`   OTP:  🔑 ${otp} (valid for 5 minutes)`);
    console.log(`   Time: ${new Date().toLocaleTimeString()} Jamui Hub`);
    console.log('======================================================\n');
    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }

  async sendSms(phone: string, message: string, templateId?: string): Promise<SendSmsResult> {
    const formattedPhone = phone.startsWith('+91') ? phone : `+91 ${phone}`;
    console.log(`📱 [MOCK SMS] To: ${formattedPhone} [Template: ${templateId || 'N/A'}] | Message: "${message}"`);
    return {
      success: true,
      messageId: `mock_${Date.now()}`,
    };
  }
}

/**
 * Msg91Provider: Dispatches via MSG91 SendOTP / SMS API
 */
export class Msg91Provider implements SmsProvider {
  name = 'msg91';
  private authKey: string;
  private templateId?: string;
  private senderId?: string;

  constructor() {
    this.authKey = process.env.MSG91_AUTH_KEY || '';
    this.templateId = process.env.MSG91_OTP_TEMPLATE_ID;
    this.senderId = process.env.MSG91_SENDER_ID || 'ZUPITM';
  }

  async sendOtp(phone: string, otp: string): Promise<SendSmsResult> {
    // Sanitize 10-digit mobile number with 91 prefix for MSG91
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const destination = `91${cleanPhone}`;

    if (!this.authKey) {
      console.warn('⚠️ [MSG91] Missing MSG91_AUTH_KEY. Falling back to console output:');
      console.log(`📱 [MSG91 SIMULATED] OTP for ${destination}: ${otp}`);
      return {
        success: true,
        messageId: `msg91_sim_${Date.now()}`,
      };
    }

    try {
      const url = `https://control.msg91.com/api/v5/otp?template_id=${this.templateId || ''}&mobile=${destination}&authkey=${this.authKey}&otp=${otp}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await response.json()) as { type?: string; message?: string };

      if (response.ok && data.type !== 'error') {
        return {
          success: true,
          messageId: data.message || `msg91_${Date.now()}`,
        };
      }
      return {
        success: false,
        error: data.message || 'MSG91 API error',
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('❌ [MSG91] Error sending OTP:', errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  async sendSms(phone: string, message: string, templateId?: string): Promise<SendSmsResult> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const destination = `91${cleanPhone}`;

    if (!this.authKey) {
      console.log(`📱 [MSG91 SIMULATED SMS] To ${destination}: "${message}"`);
      return { success: true, messageId: `msg91_sim_${Date.now()}` };
    }

    try {
      const response = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: this.authKey,
        },
        body: JSON.stringify({
          template_id: templateId || this.templateId,
          short_url: '0',
          recipients: [{ mobiles: destination, message }],
        }),
      });
      const data = await response.json();
      return { success: response.ok, messageId: JSON.stringify(data) };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}

/**
 * Factory to get the active SMS provider chosen by SMS_PROVIDER env var
 */
export function getSmsProvider(): SmsProvider {
  const providerType = (process.env.SMS_PROVIDER || 'mock').toLowerCase();
  if (providerType === 'msg91') {
    return new Msg91Provider();
  }
  return new MockProvider();
}

export const smsProvider: SmsProvider = getSmsProvider();
