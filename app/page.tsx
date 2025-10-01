import { ReactElement } from 'react'
import { HomeHero } from '@/components/home/HomeHero'
import { ResourceGrid } from '@/components/home/ResourceGrid'

export default function Page(): ReactElement {
  return (
    <div className="space-y-16">
      <HomeHero />
      <ResourceGrid />
    </div>
  )
}
