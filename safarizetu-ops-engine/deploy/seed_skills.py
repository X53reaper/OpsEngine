#!/usr/bin/env python3
"""Manually seed skills by calling the API"""
import paramiko, json

HOST = "192.168.18.50"
USER = "root"
PASS = "123456789"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, USER, PASS)

skills = {
    "wildlife": {
        "zimbabwe-parks": "# Zimbabwe Safari Parks\n\n## Hwange National Park\n- Largest park in Zimbabwe (14,600 km2)\n- Famous for: Massive elephant herds (50,000+), wild dogs, lion prides\n- Best time: Oct-Dec (dry season)\n- Memory angle: The sound of 200 elephants at a waterhole at dusk\n\n## Mana Pools National Park\n- UNESCO World Heritage Site\n- Famous for: Walking safaris, canoeing with wildlife\n- Best time: Jun-Oct\n- Memory angle: You're walking. No vehicle. Just you and the elephant 20 meters away.\n\n## Victoria Falls\n- One of the 7 Natural Wonders of the World\n- 1,708m wide, 108m high\n- Best time: Feb-May (peak flow)\n- Memory angle: The spray is so thick you can't see the bottom.\n\n## Gonarezhou National Park\n- Place of Elephants in Shona\n- Famous for: Massive tuskers, Chilojo Cliffs\n- Memory angle: Red sand cliffs, elephants below, no one else for 50km\n\n## Matobo Hills\n- UNESCO World Heritage Site\n- Famous for: Ancient San rock art, rhino tracking on foot\n- Memory angle: You're standing where humans stood 2,000 years ago.",
        "animal-behavior": "# Animal Behavior\n\n## Elephants\n- Matriarchal societies, mourn their dead, remember water sources from 50+ years\n- STORY: The matriarch stopped. She remembered this waterhole from 30 years ago.\n\n## Lions\n- Prides are female-led, males sleep 20 hours a day\n- STORY: The lioness didn't move. She watched us. We watched her.\n\n## Wild Dogs\n- Most successful hunters (85% kill rate), vote by sneezing\n- STORY: The pack gathered. They sneezed. The majority decided: we hunt east.\n\n## Leopards\n- Most solitary, can carry prey 3x their weight up a tree\n- STORY: We heard the impala alarm call. Then silence.\n\n## Hippos\n- Kill more people than any other large animal, vegetarian\n- STORY: The hippo yawned. It wasn't being friendly."
    },
    "psychology": {
        "travel-desire": "# Travel Desire Psychology\n\n## Anticipation Dopamine\n- Brain releases MORE dopamine during anticipation than the experience\n- APPLICATION: Content that triggers planning outperforms destination content\n\n## Peak-End Rule\n- People judge by the PEAK moment and the END\n- APPLICATION: Find THE moment in every image\n\n## Neural Replay\n- Reading vivid sensory language simulates the experience\n- APPLICATION: Sensory language isn't decoration, it's activation\n\n## Default Mode Network\n- Activated by you language\n- APPLICATION: Second person puts the reader IN the scene\n\n## What NOT to Do\n- Never use Book now\n- Never use manufactured urgency\n- Never sell features, sell the feeling",
        "booking-psychology": "# Booking Psychology\n\n## The Booking Funnel\n1. Wonder: Beautiful image, compelling story\n2. Research: Could I actually do this?\n3. Planning: When should I go?\n4. Booking: This is the one\n5. Memory: Post-trip storytelling\n\n## Conversion Triggers\n- Loss aversion: Only 3 camps have this view\n- Social proof: 340 people saw this, 280 said it changed them\n- Identity: Not everyone understands why you need to go\n\n## Anti-Patterns\n- Limited time offer (feels like car dealership)\n- Book now before it's too late (creates anxiety)\n- Luxury accommodations await (generic)"
    },
    "copywriting": {
        "memory-storytelling": "# Memory Storytelling\n\n## Structure\n1. Timestamp (optional)\n2. Scene setting (one sensory detail)\n3. The moment (specific, not generic)\n4. The feeling (implied, not stated)\n5. The open end\n\n## Examples\n- BAD: Amazing sunset safari!\n- GOOD: The elephant didn't move. Neither did we. Twenty minutes of nothing but breathing.\n\n## Sensory Details\n- Temperature: warm dust, cool morning air\n- Sound: the bush making sounds you don't have words for\n- Smell: wild sage, rain on red earth\n- Texture: red dust between your fingers\n\n## Tone Rules\n- Present tense for immediacy\n- Fragments are good\n- Don't explain the feeling\n- Short sentences",
        "premium-voice": "# Premium Voice\n\n## Voice Identity\n- A well-traveled friend who's been to Africa many times\n- Warm but not gushing\n- Knowledgeable but not lecturing\n- Premium but not pretentious\n\n## Word Choice\n- USE: the bush, game drive, sundowner, bush coffee\n- AVOID: luxury, exclusive, once-in-a-lifetime, unforgettable\n\n## Formatting\n- Line breaks between paragraphs\n- One idea per paragraph\n- CTA goes AFTER the story"
    },
    "competitors": {
        "counter-strategies": "# Competitor Counter-Strategies\n\n## Wilderness Safaris\n- Tactic: Conservation authority\n- Our counter: We have OPTIONS\n- Wilderness has one camp. We have 47.\n\n## andBeyond\n- Tactic: Luxury aspiration\n- Our counter: Aspiration without exclusivity\n- Their safari costs $2,000/night. Ours starts at $200.\n\n## Natural Selection\n- Tactic: Authentic wilderness\n- Our counter: Authenticity + accessibility\n\n## Differentiation\n1. Marketplace advantage\n2. Memory-first content\n3. Personalization\n4. Adaptability\n5. Honesty"
    },
    "traveler-profiles": {
        "persona-templates": "# Traveler Profiles\n\n## Luxury Seeker (35-60)\n- Values: Exclusivity, craftsmanship\n- Tone: Elegant, understated\n- Ad angle: Some experiences can't be bought.\n\n## Adventure First (25-45)\n- Values: Discovery, challenge\n- Tone: Energetic, present-tense\n- Ad angle: This is not a vacation. This is a story.\n\n## Family Planner (30-50)\n- Values: Safety, convenience\n- Tone: Warm, reassuring\n- Ad angle: Some trips become the stories your kids tell.\n\n## Honeymoon Planner (25-40)\n- Values: Romance, privacy\n- Tone: Romantic, sensory\n- Ad angle: Your story starts here.\n\n## Solo Traveler (25-45)\n- Values: Freedom, self-discovery\n- Tone: Confident, empowering\n- Ad angle: You don't need a group to see Africa.\n\n## Corporate Group (30-55)\n- Values: Team building, prestige\n- Tone: Professional but human\n- Ad angle: Your team doesn't need another conference room."
    }
}

for category, skill_dict in skills.items():
    for name, content in skill_dict.items():
        payload = json.dumps({"content": content}).replace("'", "'\\''")
        cmd = (
            f"curl -s -X POST http://localhost:3000/api/skills "
            f"-H 'Content-Type: application/json' "
            f"-d '{{\"category\": \"{category}\", \"name\": \"{name}\", \"content\": \"{content.replace(chr(10), '\\n').replace('\"', '\\\"')}\"}}'"
        )
        stdin, stdout, stderr = client.exec_command(cmd)
        result = stdout.read().decode().strip()
        print(f"  {category}/{name}: {result[:80]}")

# Verify
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/api/skills')
print("\n=== Final skill count ===")
print(stdout.read().decode().strip()[:500])

client.close()
