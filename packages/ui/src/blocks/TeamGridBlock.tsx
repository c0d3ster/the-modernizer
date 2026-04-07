import type { TeamGridBlock as TeamGridBlockData } from '@modernizer/schema'
import { Avatar, AvatarImage, AvatarFallback } from '../shadcn/avatar'
import { cn } from '../lib/cn'
import { container, section } from '../styles/tokens'

interface TeamGridBlockProps {
  block: TeamGridBlockData
}

export const TeamGridBlock = ({ block }: TeamGridBlockProps): React.ReactElement => {
  const { heading, members } = block

  return (
    <section className={cn(section, 'bg-muted/40')}>
      <div className={container}>
        {heading && (
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight lg:text-4xl">{heading}</h2>
        )}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {members.map((member, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <Avatar className="mb-4 h-24 w-24">
                {member.photoUrl && <AvatarImage src={member.photoUrl} alt={member.name} />}
                <AvatarFallback className="text-lg">{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <h3 className="font-semibold">{member.name}</h3>
              {member.role && <p className="text-sm text-primary">{member.role}</p>}
              {member.bio && <p className="mt-2 text-sm text-muted-foreground">{member.bio}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
