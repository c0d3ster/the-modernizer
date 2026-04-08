import {
  HeroBlock,
  TextSectionBlock,
  FeatureGridBlock,
  TestimonialBlock,
  TeamGridBlock,
  CTABlock,
  ContactInfoBlock,
  FAQBlock,
  StatsBlock,
  ImageGalleryBlock,
  PricingTableBlock,
  LogoCloudBlock,
  EmbedBlock,
  GenericSection,
} from '@modernizer/ui/blocks'
import { Navbar, Footer } from '@modernizer/ui/layout'

const nav = [
  { label: 'About', url: '/about' },
  { label: 'Services', url: '/services' },
  { label: 'Contact', url: '/contact' },
]

const Page = () => {
  return (
    <>
      <Navbar siteName="Modernizer" nav={nav} ctaText="Get Started" ctaUrl="/contact" />

      <HeroBlock block={{
        type: 'hero',
        heading: 'Modern websites, built instantly',
        subheading: 'We take your existing site and rebuild it as a fast, beautiful Next.js app — automatically.',
        ctaText: 'See how it works',
        ctaUrl: '/demo',
      }} />

      <StatsBlock block={{
        type: 'stats',
        stats: [
          { value: '500+', label: 'Sites rebuilt' },
          { value: '3s', label: 'Average generation time' },
          { value: '98%', label: 'Lighthouse score' },
          { value: '100%', label: 'Open source' },
        ],
      }} />

      <TextSectionBlock block={{
        type: 'text_section',
        heading: 'What is The Modernizer?',
        body: 'The Modernizer is a CLI tool that crawls your existing website, extracts structured content using AI, and regenerates it as a modern Next.js + Tailwind CSS application.\n\nNo manual migration. No copy-pasting. Just run the command and get a production-ready codebase back.',
      }} />

      <FeatureGridBlock block={{
        type: 'feature_grid',
        heading: 'Everything you need',
        features: [
          { title: 'Smart crawling', description: 'Discovers every page on your site automatically, handling pagination and dynamic routes.' },
          { title: 'AI extraction', description: 'Converts messy HTML into structured, typed content blocks using Claude.' },
          { title: 'Modern output', description: 'Generates a full Next.js 15 app with Tailwind CSS, TypeScript, and shadcn/ui components.' },
          { title: 'Brand-aware', description: 'Extracts your brand colors and applies them to the generated design system.' },
          { title: 'Fully typed', description: 'Every generated page is backed by strict TypeScript types and Zod validation.' },
          { title: 'Open source', description: 'MIT licensed. Inspect, fork, and extend however you need.' },
        ],
      }} />

      <TestimonialBlock block={{
        type: 'testimonial',
        heading: 'What people are saying',
        testimonials: [
          { quote: 'Migrated our 40-page WordPress site in under 5 minutes. Unreal.', author: 'Sarah Chen', role: 'CTO, HealthFirst' },
          { quote: 'The generated code is actually readable and follows best practices. I was shocked.', author: 'Marcus Reid', role: 'Lead Engineer, Bluefin' },
          { quote: 'Finally a tool that treats our content as data, not just text.', author: 'Priya Nair', role: 'Product Manager, Volta' },
        ],
      }} />

      <PricingTableBlock block={{
        type: 'pricing_table',
        heading: 'Simple pricing',
        tiers: [
          { name: 'Hobby', price: 'Free', description: 'For personal projects.', features: ['5 pages', 'Clean preset', 'CLI access'], ctaText: 'Get started', ctaUrl: '/signup' },
          { name: 'Pro', price: '$29/mo', description: 'For professional use.', features: ['Unlimited pages', 'All design presets', 'Asset downloads', 'Priority support'], ctaText: 'Start free trial', ctaUrl: '/signup?plan=pro' },
          { name: 'Team', price: '$99/mo', description: 'For agencies and teams.', features: ['Everything in Pro', 'Team workspaces', 'API access', 'SLA'], ctaText: 'Contact sales', ctaUrl: '/contact' },
        ],
      }} />

      <TeamGridBlock block={{
        type: 'team_grid',
        heading: 'The team',
        members: [
          { name: 'Alex Torres', role: 'Founder & Engineer' },
          { name: 'Jamie Lin', role: 'Design Systems' },
          { name: 'Sam Okafor', role: 'ML & Extraction' },
        ],
      }} />

      <FAQBlock block={{
        type: 'faq',
        heading: 'Frequently asked questions',
        items: [
          { question: 'Does it work on any website?', answer: 'It works best on brochure-style sites built on WordPress, Squarespace, or similar CMSes. Dynamic apps with authenticated content are not supported yet.' },
          { question: 'How accurate is the extraction?', answer: 'Very accurate for standard content patterns. Complex layouts fall back to a GenericSection block that renders raw HTML cleanly.' },
          { question: 'Can I customize the output?', answer: 'Yes — you can choose design presets, override brand colors, and edit the generated code freely. It\'s just a Next.js app.' },
        ],
      }} />

      <ImageGalleryBlock block={{
        type: 'image_gallery',
        heading: 'Before and after',
        images: [
          { url: 'https://placehold.co/800x450/e2e8f0/64748b?text=Before', alt: 'Before screenshot', caption: 'Original WordPress site' },
          { url: 'https://placehold.co/800x450/2563eb/ffffff?text=After', alt: 'After screenshot', caption: 'Generated Next.js app' },
          { url: 'https://placehold.co/800x450/f1f5f9/64748b?text=Lighthouse', alt: 'Lighthouse score', caption: '98/100 Lighthouse score' },
        ],
      }} />

      <ContactInfoBlock block={{
        type: 'contact_info',
        heading: 'Get in touch',
        email: 'hello@modernizer.dev',
        phone: '+1 (555) 000-0000',
        address: '123 Developer Way, San Francisco, CA 94103',
      }} />

      <LogoCloudBlock block={{
        type: 'logo_cloud',
        heading: 'Trusted by teams at',
        logos: [
          { name: 'Vercel', imageUrl: 'https://placehold.co/120x40/ffffff/64748b?text=Vercel' },
          { name: 'Netlify', imageUrl: 'https://placehold.co/120x40/ffffff/64748b?text=Netlify' },
          { name: 'Cloudflare', imageUrl: 'https://placehold.co/120x40/ffffff/64748b?text=Cloudflare' },
        ],
      }} />

      <EmbedBlock block={{
        type: 'embed',
        heading: 'Watch a demo',
        embedHtml: '<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Demo video" frameborder="0" allowfullscreen></iframe>',
      }} />

      <GenericSection block={{
        type: 'generic_section',
        heading: 'Legal',
        rawHtml: '<p>Use of this tool is subject to our <a href="/terms">Terms of Service</a>. The Modernizer is provided as-is, without warranty of any kind.</p>',
      }} />

      <CTABlock block={{
        type: 'cta',
        heading: 'Ready to modernize?',
        subheading: 'Run one command and get a production-ready Next.js app.',
        ctaText: 'Get started free',
        ctaUrl: '/signup',
      }} />

      <Footer siteName="Acme Corp" nav={nav} email="hello@modernizer.dev" phone="+1 (555) 000-0000" />
    </>
  )
}

export default Page
