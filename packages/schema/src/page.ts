import type { ContentBlock } from './blocks.js'

export enum PageArchetype {
  Home = 'home',
  About = 'about',
  Services = 'services',
  Contact = 'contact',
  Blog = 'blog',
  BlogPost = 'blog_post',
  Team = 'team',
  Pricing = 'pricing',
  FAQ = 'faq',
  Gallery = 'gallery',
  Generic = 'generic',
}

export interface PageSchema {
  url: string
  title: string
  archetype: PageArchetype
  metaDescription?: string
  ogImage?: string
  blocks: ContentBlock[]
}
