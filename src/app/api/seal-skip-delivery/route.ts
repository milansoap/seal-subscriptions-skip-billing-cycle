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
    const { email } = await request.json();
    const apiToken = 'seal_token_j30a29iwbawrw81un1tspxdy0wn26qq1jjdu9ixk';

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Missing email' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    const apiBase = 'https://app.sealsubscriptions.com/shopify/merchant/api';

    // Step 1: Search for subscriptions by email
    const searchResponse = await fetch(
      `${apiBase}/subscriptions?query=${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Seal-Token': apiToken
        }
      }
    );

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      throw new Error(`Failed to search subscriptions: ${searchResponse.status} - ${errorText}`);
    }

    const searchData = await searchResponse.json();

    if (!searchData.success || !searchData.payload || !searchData.payload.subscriptions || searchData.payload.subscriptions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No subscriptions found for this email' },
        {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Get the first subscription from the search results
    const subscriptionData = searchData.payload.subscriptions[0];

    // Now get the full subscription details with billing attempts
    const fullSubscriptionResponse = await fetch(
      `${apiBase}/subscription?id=${subscriptionData.id}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Seal-Token': apiToken
        }
      }
    );

    if (!fullSubscriptionResponse.ok) {
      const errorText = await fullSubscriptionResponse.text();
      throw new Error(`Failed to fetch full subscription: ${fullSubscriptionResponse.status} - ${errorText}`);
    }

    const fullSubscriptionData = await fullSubscriptionResponse.json();
    
    // Check if billing_attempts is in the full subscription response
    const billingAttempts = fullSubscriptionData.payload?.billing_attempts || [];
    
    // Find the next billing attempt (first one with empty status or 'scheduled' status)
    const nextAttempt = billingAttempts.find((attempt: any) => 
      !attempt.status || attempt.status === '' || attempt.status === 'scheduled'
    );

    if (!nextAttempt) {
      // Check if the next attempt is already skipped
      const nextSkippedAttempt = billingAttempts.find((attempt: any) => 
        attempt.skipped_on && (!attempt.status || attempt.status === '')
      );
      
      if (nextSkippedAttempt) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Next billing cycle is already skipped!',
            skippedOn: nextSkippedAttempt.skipped_on
          },
          {
            status: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
            }
          }
        );
      }

      return NextResponse.json(
        { 
          success: false, 
          error: 'No upcoming billing attempt found'
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
        subscription_id: fullSubscriptionData.payload.id,
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
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}
