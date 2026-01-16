import { AccessToken } from 'livekit-server-sdk'

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET

export interface LessonTokenParams {
  lessonId: string
  identity: string
  ttlSeconds?: number
  metadata?: Record<string, unknown> | string
}

function assertLiveKitConfig() {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error('LiveKit API credentials are not configured.')
  }
}

export function createLessonAccessToken({
  lessonId,
  identity,
  ttlSeconds = 60 * 60,
  metadata,
}: LessonTokenParams) {
  assertLiveKitConfig()

  const token = new AccessToken(LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!, {
    identity,
    ttl: ttlSeconds,
  })

  if (metadata !== undefined) {
    token.metadata =
      typeof metadata === 'string' ? metadata : JSON.stringify(metadata)
  }

  token.addGrant({
    room: `lesson-${lessonId}`,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })

  return token.toJwt()
}

