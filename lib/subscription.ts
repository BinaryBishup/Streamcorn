export type SubscriptionPlan = 'basic' | 'premium' | 'ultra';
export type SubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'expired';

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  device_limit: number;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export const SUBSCRIPTION_PLANS = {
  basic: {
    name: 'Basic',
    qualities: ['480p'],
    deviceLimit: 1,
    price: '$4.99/month',
  },
  premium: {
    name: 'Premium',
    qualities: ['480p', '720p'],
    deviceLimit: 2,
    price: '$9.99/month',
  },
  ultra: {
    name: 'Ultra',
    qualities: ['480p', '720p', '1080p'],
    deviceLimit: 4,
    price: '$14.99/month',
  },
} as const;

export type VideoQuality = '480p' | '720p' | '1080p' | 'auto';

export interface QualityOption {
  value: VideoQuality;
  label: string;
  available: boolean;
  locked: boolean;
}

/**
 * Get available quality options based on subscription plan
 */
export function getAvailableQualities(plan: SubscriptionPlan): QualityOption[] {
  const planQualities = SUBSCRIPTION_PLANS[plan].qualities as readonly string[];

  return [
    {
      value: 'auto',
      label: 'Auto',
      available: true,
      locked: false,
    },
    {
      value: '480p',
      label: 'SD (480p)',
      available: planQualities.includes('480p'),
      locked: !planQualities.includes('480p'),
    },
    {
      value: '720p',
      label: 'HD (720p)',
      available: planQualities.includes('720p'),
      locked: !planQualities.includes('720p'),
    },
    {
      value: '1080p',
      label: 'Full HD (1080p)',
      available: planQualities.includes('1080p'),
      locked: !planQualities.includes('1080p'),
    },
  ];
}

/**
 * Get the subscription plan name for upgrade prompts
 */
export function getRequiredPlanForQuality(quality: VideoQuality): SubscriptionPlan | null {
  if (quality === 'auto' || quality === '480p') return null;
  if (quality === '720p') return 'premium';
  if (quality === '1080p') return 'ultra';
  return null;
}

export interface SubtitleTrack {
  language: string;
  label: string;
  url: string;
}

export interface AudioTrack {
  language: string;
  label: string;
  url?: string;
}
