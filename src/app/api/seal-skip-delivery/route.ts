import { NextRequest, NextResponse } from 'next/server';

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Seal-Token',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { subscriptionId } = await request.json();
    const apiToken = 'seal_token_j30a29iwbawrw81un1tspxdy0wn26qq1jjdu9ixk';

    if (!subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'Missing subscriptionId' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    const apiBase = 'https://app.sealsubscriptions.com/shopify/merchant/api';

    // Step 1: Fetch subscription details
    const subscriptionResponse = await fetch(
      `${apiBase}/subscription?id=${subscriptionId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Seal-Token': apiToken
        }
      }
    );

    if (!subscriptionResponse.ok) {
      throw new Error(`Failed to fetch subscription: ${subscriptionResponse.status}`);
    }

    const subscriptionData = await subscriptionResponse.json();
    console.log('Subscription data received:', subscriptionData);
    
    // Check if billing_attempts is in the response
    const billingAttempts = subscriptionData.billing_attempts || [];
    console.log('Billing attempts found:', billingAttempts);
    
    const nextAttempt = billingAttempts.find(attempt => attempt.status === 'scheduled');

    if (!nextAttempt) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No scheduled billing attempt found',
          debug: {
            subscriptionData: subscriptionData,
            billingAttempts: billingAttempts
          }
        },
        {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Step 2: Skip the billing attempt
    const skipResponse = await fetch(`${apiBase}/subscription-billing-attempt`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Seal-Token': apiToken
      },
      body: JSON.stringify({
        id: nextAttempt.id,
        subscription_id: subscriptionId,
        action: 'skip'
      })
    });

    if (!skipResponse.ok) {
      throw new Error(`Failed to skip billing attempt: ${skipResponse.status}`);
    }

    const skipData = await skipResponse.json();

    return NextResponse.json(
      { success: true, data: skipData },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );

  } catch (error) {
    console.error('Error in skip delivery:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}
