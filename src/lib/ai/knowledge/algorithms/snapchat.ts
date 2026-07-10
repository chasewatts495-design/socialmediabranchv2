const content = `
# Snapchat Algorithm Playbook

Snapchat is two systems: an intimacy graph (Stories, Snaps, streaks - ranked by relationship
closeness) and a discovery engine (Spotlight - TikTok-style, plus the Discover/Stories tab for
public creators). Brands win with frequency, rawness, and Spotlight's loop mechanics.

## Ranking signals

1. **Story completion rate.** Widely observed as the key quality signal for public Stories: if
   viewers tap through to the end, the Story ranks higher in the Stories tab and for subscribers.
   Long, padded Stories that get abandoned mid-way sink the account's placement.
2. **Relationship closeness (friend graph).** For friend Stories, ranking follows interaction
   history - snaps exchanged, chats, streaks. For creators this maps to reply behaviour: viewers
   who reply to your Story see your next one first, so reply prompts are a compounding lever.
3. **Posting frequency and streak-like consistency.** Widely observed: accounts posting Stories
   daily (or near-daily) sustain dramatically higher view-through than sporadic posters; gaps
   reset viewer habit. The platform's whole culture is built on streaks - consistency is the
   algorithm and the psychology at once.
4. **Spotlight: loops, watch time, and shares.** Spotlight ranking mirrors TikTok - completion
   and rewatch loops dominate, favouriting and sharing escalate a snap through progressively
   larger audiences, and engagement velocity in the first hours decides the test.
5. **Freshness and topicality.** Spotlight explicitly favours recent submissions using trending
   topics, sounds, and lenses.
6. **Profile actions.** Subscribes-from-Spotlight and Story replies signal creator quality and
   feed the Discover tab's suggestions.

## Format meta (current)

- **Stories:** 9:16 full-screen vertical; 3 to 10 snaps per Story is a widely observed sweet spot
  - long enough to build habit, short enough to hold completion. Raw, unpolished,
  camera-first content is the native dialect; over-produced footage reads as an ad.
- **Spotlight:** vertical video up to 60 seconds; sub-10-second loops perform best; no visible
  watermarks from other apps; use Snap sounds, lenses, and topic hashtags for classification.
- **Interactive elements:** polls, sliders, and reply prompts inside Stories drive the reply
  signal that improves subsequent placement.
- **Public Profile:** post both Stories and Spotlight from a public creator profile so wins
  convert to subscribers.

## Timing and cadence

- Widely observed windows: after-school and evening hours, 4 to 10pm audience-local; the
  demographic skews 13 to 34 and mobile-native.
- Cadence: Stories daily (treat it like a streak with your audience); Spotlight 1 to 3 snaps per
  day for accounts in growth mode - Spotlight rewards volume because each snap is an independent
  lottery ticket into the test loop.
- Decay: Stories expire in 24 hours by design - the platform is a frequency machine, not an
  archive. Spotlight snaps can resurface for days to weeks while loops hold.

## Penalties and traps

- **Watermarked recycled TikToks** are ineligible or suppressed in Spotlight per Snap's own
  guidelines.
- **Padded Stories:** every weak snap in the middle bleeds completion; cut ruthlessly.
- **Overt link-pushing:** swipe-up/link stickers convert with warm audiences but link-heavy
  Stories depress completion; earn attention first.
- **Inconsistency:** the fastest way to lose Story placement is a two-week gap - viewer habit and
  ranking decay together.
- **Engagement-bait Spotlight text** ("wait for the end" with no payoff) burns rewatch trust.

## Levers ranked by impact

1. Post a Story every day; protect the streak with your audience above all else.
2. Open every Story with the strongest snap - completion is decided in the first two taps.
3. End Stories with a reply prompt or poll to farm the relationship signal.
4. Flood Spotlight with short, loopable, sound-on snaps; volume plus loops is the formula.
5. Repurpose top Reels/TikToks WITHOUT watermarks, re-cut to loop.
6. Use trending lenses and sounds within the first days of their rise.
`;
export default content;
