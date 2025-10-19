import { NextResponse } from 'next/server';

import { makeCoinbase, makePaxum, makeStripe, type PaymentProvider } from '@server/payments/payment-providers';
import { auth, clearAuthRequestContext, setAuthRequestContext } from '../../_lib/auth';

type ProviderSummary = {
  name: PaymentProvider['name'];
  enabled: boolean;
  status: 'active' | 'disabled' | 'misconfigured';
};

function describeProvider(factory: () => PaymentProvider, name: ProviderSummary['name']): ProviderSummary {
  try {
    const provider = factory();
    return {
      name,
      enabled: provider.enabled,
      status: provider.enabled ? 'active' : 'disabled',
    };
  } catch (error) {
    console.error(`Payment provider ${name} misconfigured:`, error);
    return {
      name,
      enabled: false,
      status: 'misconfigured',
    };
  }
}

export async function GET(request: Request) {
  try {
    setAuthRequestContext(request);
    const { userId } = auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const providers: ProviderSummary[] = [
      describeProvider(makePaxum, 'paxum'),
      describeProvider(makeCoinbase, 'coinbase'),
      describeProvider(makeStripe, 'stripe'),
    ];

    return NextResponse.json({ success: true, data: providers });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    clearAuthRequestContext();
  }
}
