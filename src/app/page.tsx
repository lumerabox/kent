import { KentApp } from '@/components/kent/KentApp.client'

export const dynamic = 'force-dynamic'

export default function Page() {
  return <KentApp ready={Boolean(process.env.AI_API_KEY?.trim())} />
}
