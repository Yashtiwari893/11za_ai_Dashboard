import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// Get call analytics for a phone number
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phoneNumber: string }> }
) {
  try {
    const { phoneNumber } = await params;
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Build query
    let query = supabase
      .from('call_sessions')
      .select(`
        *,
        call_transcripts (
          speaker,
          text,
          intent,
          confidence,
          sentiment,
          timestamp
        )
      `)
      .eq('phone_number', phoneNumber)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Add date filters if provided
    if (startDate) {
      query = query.gte('started_at', startDate);
    }
    if (endDate) {
      query = query.lte('started_at', endDate);
    }

    const { data: calls, error } = await query;

    if (error) {
      console.error('Error fetching call analytics:', error);
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }

    // Calculate analytics
    const analytics = calculateAnalytics(calls || []);

    return NextResponse.json({
      analytics,
      calls: calls || [],
      pagination: {
        limit,
        offset,
        hasMore: calls ? calls.length === limit : false
      }
    });

  } catch (error) {
    console.error('Error in call analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function calculateAnalytics(calls: any[]): {
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  completionRate: number;
  escalationRate: number;
  averageSentiment: number;
  callStatusBreakdown: Record<string, number>;
  hourlyDistribution: Record<string, number>;
  intentBreakdown: Record<string, number>;
} {
  if (calls.length === 0) {
    return {
      totalCalls: 0,
      totalDuration: 0,
      averageDuration: 0,
      completionRate: 0,
      escalationRate: 0,
      averageSentiment: 0,
      callStatusBreakdown: {},
      hourlyDistribution: {},
      intentBreakdown: {}
    };
  }

  const totalCalls = calls.length;
  const totalDuration = calls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0);
  const averageDuration = totalDuration / totalCalls;

  const completedCalls = calls.filter(call => call.status === 'ended').length;
  const escalatedCalls = calls.filter(call => call.status === 'transferred').length;

  const completionRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;
  const escalationRate = totalCalls > 0 ? (escalatedCalls / totalCalls) * 100 : 0;

  // Calculate average sentiment
  let totalSentiment = 0;
  let sentimentCount = 0;

  calls.forEach(call => {
    if (call.call_transcripts) {
      call.call_transcripts.forEach((transcript: any) => {
        if (transcript.sentiment !== null && transcript.sentiment !== undefined) {
          const sentimentValue = transcript.sentiment === 'positive' ? 1 :
                                transcript.sentiment === 'negative' ? -1 : 0;
          totalSentiment += sentimentValue;
          sentimentCount++;
        }
      });
    }
  });

  const averageSentiment = sentimentCount > 0 ? totalSentiment / sentimentCount : 0;

  // Status breakdown
  const callStatusBreakdown: Record<string, number> = {};
  calls.forEach(call => {
    callStatusBreakdown[call.status] = (callStatusBreakdown[call.status] || 0) + 1;
  });

  // Hourly distribution
  const hourlyDistribution: Record<string, number> = {};
  calls.forEach(call => {
    if (call.started_at) {
      const hour = new Date(call.started_at).getHours();
      const hourKey = `${hour.toString().padStart(2, '0')}:00`;
      hourlyDistribution[hourKey] = (hourlyDistribution[hourKey] || 0) + 1;
    }
  });

  // Intent breakdown
  const intentBreakdown: Record<string, number> = {};
  calls.forEach(call => {
    if (call.call_transcripts) {
      call.call_transcripts.forEach((transcript: any) => {
        if (transcript.intent) {
          intentBreakdown[transcript.intent] = (intentBreakdown[transcript.intent] || 0) + 1;
        }
      });
    }
  });

  return {
    totalCalls,
    totalDuration,
    averageDuration,
    completionRate,
    escalationRate,
    averageSentiment,
    callStatusBreakdown,
    hourlyDistribution,
    intentBreakdown
  };
}