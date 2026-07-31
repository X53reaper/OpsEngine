#!/usr/bin/env python3
"""Write skill files directly to server"""
import paramiko

HOST = "192.168.18.50"
USER = "root"
PASS = "123456789"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, USER, PASS)

# Create directories
for cat in ['wildlife', 'psychology', 'copywriting', 'competitors', 'traveler-profiles']:
    client.exec_command(f'mkdir -p /opt/safarizetu-ops-engine/skills/{cat}')

skills = {
    "wildlife/zimbabwe-parks.md": """# Zimbabwe Safari Parks

## Hwange National Park
- Largest park in Zimbabwe (14,600 km2)
- Famous for: Massive elephant herds (50,000+), wild dogs, lion prides
- Best time: Oct-Dec (dry season, animals congregate at waterholes)
- Memory angle: The sound of 200 elephants at a waterhole at dusk
- Not just Big 5 - Hwange has 100+ mammal species

## Mana Pools National Park
- UNESCO World Heritage Site
- Famous for: Walking safaris, canoeing with wildlife
- Best time: Jun-Oct (dry season, animals along Zambezi river)
- Memory angle: You're walking. No vehicle. Just you and the elephant 20 meters away.

## Victoria Falls
- One of the 7 Natural Wonders of the World
- 1,708m wide, 108m high
- Best time: Feb-May (peak flow), Aug-Dec (Devil's Pool)
- Memory angle: The spray is so thick you can't see the bottom.

## Gonarezhou National Park
- Place of Elephants in Shona
- Famous for: Massive tuskers, Chilojo Cliffs
- Memory angle: Red sand cliffs, elephants below, no one else for 50km

## Matobo Hills
- UNESCO World Heritage Site
- Famous for: Ancient San rock art, rhino tracking on foot
- Memory angle: You're standing where humans stood 2,000 years ago.

## Lake Kariba
- World's largest man-made lake
- Famous for: Tiger fishing, houseboat safaris
- Memory angle: A houseboat. Nothing but water and sky.""",

    "wildlife/animal-behavior.md": """# Animal Behavior - Stories That Write Themselves

## Elephants
- Matriarchal societies - oldest female leads the herd
- They mourn their dead, visit bones of deceased family members
- Can remember water sources from 50+ years ago
- STORY: The matriarch stopped. She remembered this waterhole from 30 years ago. Her herd followed.

## Lions
- Prides are female-led - males are kicked out at 3 years
- Males sleep 20 hours a day
- Can roar from 5 miles away
- STORY: The lioness didn't move. She watched us. We watched her. Nobody breathed.

## Wild Dogs
- Most successful hunters in Africa (85% kill rate vs lion's 25%)
- They vote on hunting direction by sneezing
- Only ~6,600 left in the wild
- STORY: The pack gathered. They sneezed. The majority decided: we hunt east.

## Leopards
- Most solitary of the big cats
- Can carry prey 3x their weight up a tree
- Mostly nocturnal - sightings are special
- STORY: We heard the impala alarm call. Then silence. The leopard was already gone.

## Hippos
- Kill more people in Africa than any other large animal
- They can run 30 km/h on land
- They're vegetarian
- STORY: The hippo yawned. It wasn't being friendly. It was showing us its teeth.

## Rhinos
- White rhinos are actually grey - name comes from wijd (Dutch for wide)
- Only ~5,000 black rhinos left
- STORY: A white rhino. Older than the hills. Slower than time.""",

    "psychology/travel-desire.md": """# Travel Desire Psychology - Why People Actually Book Safaris

## Anticipation Dopamine
- Brain releases MORE dopamine during ANTICIPATION than the experience itself
- Planning a trip is neurologically more exciting than taking it
- APPLICATION: Content that triggers planning outperforms destination content

## Peak-End Rule
- People judge experiences by the PEAK moment and the END
- One extraordinary moment outweighs hours of mediocrity
- APPLICATION: Find THE moment in every image

## Neural Replay
- Reading vivid sensory language literally simulates the experience
- APPLICATION: Sensory language isn't decoration - it's activation

## Default Mode Network
- Activated by you language
- APPLICATION: Second person puts the reader IN the scene

## The Sublime (Burke and Kant)
- Encountering something vast creates AWE + HUMILITY
- Use: vast, endless, ancient, beyond words

## What NOT to Do
- Never use Book now - it kills anticipation
- Never use urgency that feels manufactured
- Never sell features - sell the feeling
- Never start with emojis - earn the emotion first

## What TO Do
- Write in present tense for immediacy
- Use sensory language (sight, sound, smell, texture, temperature)
- Create open loops (Day 3. You wake before dawn. The guide whispers.)
- Let silence do the work - short sentences, fragments""",

    "psychology/booking-psychology.md": """# Booking Psychology - From Interest to Action

## The Booking Funnel
1. Wonder (Awareness): Beautiful image, compelling story - Goal: Make them FEEL something
2. Research (Consideration): Could I actually do this? - Goal: Make it feel achievable
3. Planning (Intent): When should I go? - Goal: Let them co-create the experience
4. Booking (Conversion): This is the one - Goal: Remove all barriers
5. Memory (Advocacy): Post-trip storytelling - Goal: Turn them into storytellers

## Conversion Triggers
- Loss aversion: There are 12 camps in Mana Pools. Only 3 have this view.
- Social proof: Last year, 340 people saw this exact scene. 280 said it changed them.
- Identity: Not everyone understands why you need to go. That's how you know it matters.
- Specificity: R5,200 per night. All meals. Game drives. Walking safari. No hidden costs.

## Anti-Patterns (What Kills Bookings)
- Limited time offer - Feels like a car dealership
- Book now before it's too late - Creates anxiety, not desire
- Luxury accommodations await - Generic, forgettable
- Counting down timers - Aggressive, cheapens the experience

## Premium Conversion Approach
- Be specific, not urgent
- Be informative, not pushy
- Be human, not corporate
- Let the experience sell itself""",

    "copywriting/memory-storytelling.md": """# Memory Storytelling - Writing That Feels Like Remembering

## Structure
1. Timestamp (optional): Day 3. / 5:47am. / Just before sunset.
2. Scene setting: One sensory detail that grounds the moment
3. The moment: What happened - specific, not generic
4. The feeling: What it meant (implied, not stated)
5. The open end: A question, a silence, or a gentle trailing off

## Examples
BAD: Amazing sunset safari in Hwange! Who wants to be here?
MEMORY STORY: The elephant didn't move. Neither did we. Twenty minutes of nothing but breathing. That was the best twenty minutes of the year.
MEMORY STORY: 5:47am. Coffee in hand. The bush is making sounds you don't have words for. This is the part they don't put in the brochure.
MEMORY STORY: Day 3. The guide stopped the vehicle. Pointed. We all looked. A leopard, draped over a branch, completely uninterested in us.

## Sensory Details
- Temperature: warm dust, cool morning air, heat rising off the road
- Sound: the bush making sounds you don't have words for, silence - the real kind
- Smell: wild sage, rain on red earth, campfire smoke in your hair
- Texture: red dust between your fingers, rough bark of an acacia
- Taste: bush coffee, cold beer after a game drive

## Memory Types
- First Time: You've never seen an elephant this close.
- The Quiet Moment: Nobody talks. The sun moves. You watch.
- The Story Worth Telling: This is the part you'll tell at dinner.
- The Perspective Shift: Somewhere between day 2 and day 3, the city stopped mattering.

## What Makes It Premium
- No exclamation marks (let the content breathe)
- No emojis as first characters
- No Discover or Experience as first word
- The story IS the selling. The CTA is separate.""",

    "copywriting/premium-voice.md": """# Premium Voice - How Safari Zetu Sounds

## Voice Identity
- A well-traveled friend who's been to Africa many times
- Warm but not gushing
- Knowledgeable but not lecturing
- Premium but not pretentious

## Tone Spectrum
- Inspiring: Some places change how you see the world.
- Educational: Elephants can remember water sources from 50 years ago.
- Funny: The leopard thinks it's hiding. It's not hiding.
- Adventurous: Day 3. You wake before dawn. The guide whispers.

## Word Choice
- USE: the bush, game drive, sundowner, bush coffee, the lodge, tracker
- AVOID: luxury, exclusive, once-in-a-lifetime, unforgettable, breathtaking, paradise, hidden gem, bucket list, authentic, immersive

## Formatting Rules
- Line breaks between paragraphs (fragments are good)
- One idea per paragraph
- CTA goes AFTER the story, not inside it

## Platform Adjustments
- Instagram: Sensory, present tense, 2-4 short paragraphs
- Facebook: Slightly longer, ask a question
- TikTok: Hook in 3 words, fast-paced
- LinkedIn: Professional but human, business story
- Email: Personal, warm, feels like a friend writing
- SMS: Max 160 chars, feels like a text from someone who knows you""",

    "competitors/counter-strategies.md": """# Competitor Counter-Strategies - How We Win

## Known Competitors
- Wilderness Safaris: Conservation authority - We counter with OPTIONS (47 camps vs 1)
- andBeyond: Luxury aspiration - We counter with accessibility (same elephants, 1/10 price)
- Natural Selection: Authentic wilderness - We counter with authenticity + accessibility
- Asilia Africa: Package convenience - We counter with convenience + customization
- Rovos Rail: Nostalgic luxury - We counter with nostalgia for the future

## Differentiation Principles
1. Marketplace advantage - variety single lodges don't have
2. Memory-first content - sell the feeling, not features
3. Personalization - we learn what works for each person
4. Adaptability - our content evolves
5. Honesty - no manufactured urgency

## Content Rules
- Never copy competitor tone
- Never mention competitors by name
- Always lead with MEMORY, not with OFFER
- Always be SPECIFIC, not general
- Always let the reader be the PROTAGONIST""",

    "traveler-profiles/persona-templates.md": """# Traveler Profiles - Know Who You're Talking To

## The Luxury Seeker (35-60)
- Values: Exclusivity, craftsmanship, privacy
- Triggers: This is not for everyone, personal service
- Tone: Elegant, understated, specific
- Ad angle: Some experiences can't be bought. They can be earned.

## The Adventure First (25-45)
- Values: Discovery, challenge, authentic experiences
- Triggers: You'll never forget this, physical challenges
- Tone: Energetic, specific, present-tense
- Ad angle: This is not a vacation. This is a story.

## The Family Planner (30-50)
- Values: Safety, convenience, bonding, education
- Triggers: Safe for kids, educational, family memories
- Tone: Warm, reassuring, practical
- Ad angle: Some trips you take. Some trips become the stories your kids tell their kids.

## The Honeymoon Planner (25-40)
- Values: Romance, privacy, once-in-a-lifetime
- Triggers: Just the two of you, exclusive, special
- Tone: Romantic, intimate, sensory
- Ad angle: Your story starts here.

## The Solo Traveler (25-45)
- Values: Freedom, self-discovery, safety
- Triggers: You don't need a group, self-paced
- Tone: Confident, empowering, personal
- Ad angle: You don't need a group to see Africa.

## The Corporate Group (30-55)
- Values: Team building, unique venues, prestige
- Triggers: Your team will never forget this
- Tone: Professional but human, business value
- Ad angle: Your team doesn't need another conference room.

## Universal Rules
- Personalize: Use their name, reference their interests
- Be specific: Hwange at sunset beats African safari
- Tell stories: Every profile responds to stories over features
- Don't sell: Let the experience speak"""
}

for filepath, content in skills.items():
    # Write content to temp file locally, then SCP
    local_path = f"/tmp/skill_{filepath.replace('/', '_')}"
    with open(local_path, 'w') as f:
        f.write(content)
    
    remote_path = f"/opt/safarizetu-ops-engine/skills/{filepath}"
    sftp = client.open_sftp()
    sftp.put(local_path, remote_path)
    sftp.close()
    print(f"  Written: {filepath}")

# Verify
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/api/skills')
print("\n=== Skills after restart ===")
print(stdout.read().decode().strip()[:500])

# Restart to load skills
import time
client.exec_command('docker restart ops_engine')
time.sleep(5)

stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/api/skills')
print("\n=== Skills after restart ===")
print(stdout.read().decode().strip()[:500])

client.close()
